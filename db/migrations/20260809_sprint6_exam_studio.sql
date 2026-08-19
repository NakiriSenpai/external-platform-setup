-- =====================================================================
-- SPRINT 6 — EXAM STUDIO FOUNDATION
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, dan 4 sudah dijalankan.
--
-- CATATAN ARSITEKTUR:
-- Exam TIDAK menyimpan salinan soal. Exam hanya menyimpan REFERENSI ke
-- section dan question. Snapshot (salinan soal saat siswa menekan
-- "Mulai Ujian") BELUM diimplementasikan pada sprint ini; struktur di
-- bawah sengaja dibuat agar snapshot dapat ditambahkan tanpa breaking
-- change (exam_attempt_snapshots menyusul di sprint berikutnya).
-- =====================================================================

-- 1. ENUM --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'exam_status') then
    create type public.exam_status as enum ('draft', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'exam_difficulty') then
    create type public.exam_difficulty as enum ('mudah', 'sedang', 'sulit');
  end if;
  if not exists (select 1 from pg_type where typname = 'exam_section_type') then
    create type public.exam_section_type as enum ('reading', 'listening');
  end if;
end$$;

-- 2. TABEL EXAMS -------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  title text not null,
  slug text not null unique,
  category text not null default 'umum',
  description text,
  difficulty public.exam_difficulty not null default 'sedang',
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  duration_minutes integer not null default 60 check (duration_minutes between 1 and 600),
  status public.exam_status not null default 'draft',
  shuffle_questions boolean not null default false,
  shuffle_answers boolean not null default false,
  -- Nilai total selalu 100. Poin per soal dihitung otomatis (100 / jumlah soal).
  total_score integer not null default 100 check (total_score = 100),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. TABEL EXAM SECTIONS ----------------------------------------------
create table if not exists public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  type public.exam_section_type not null default 'reading',
  title text not null,
  instruction text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. TABEL EXAM QUESTIONS ---------------------------------------------
create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  section_id uuid not null references public.exam_sections (id) on delete cascade,
  order_index integer not null default 0,
  text text not null,
  image_url text,
  audio_url text,
  grammar_tag text,
  explanation text,
  lesson_ref text, -- placeholder referensi lesson (Sprint berikutnya)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. TABEL EXAM ANSWERS (A–D) -----------------------------------------
create table if not exists public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D')),
  text text,
  image_url text,
  audio_url text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, label)
);

-- 6. INDEX -------------------------------------------------------------
create index if not exists exams_status_idx on public.exams (status);
create index if not exists exams_category_idx on public.exams (category);
create index if not exists exams_tenant_idx on public.exams (tenant_id);
create index if not exists exams_created_at_idx on public.exams (created_at desc);
create index if not exists exam_sections_exam_idx on public.exam_sections (exam_id, order_index);
create index if not exists exam_questions_exam_idx on public.exam_questions (exam_id, order_index);
create index if not exists exam_questions_section_idx on public.exam_questions (section_id, order_index);
create index if not exists exam_answers_question_idx on public.exam_answers (question_id);

-- 7. TRIGGER updated_at ------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists exams_touch_updated_at on public.exams;
create trigger exams_touch_updated_at before update on public.exams
  for each row execute function public.touch_updated_at();

drop trigger if exists exam_sections_touch_updated_at on public.exam_sections;
create trigger exam_sections_touch_updated_at before update on public.exam_sections
  for each row execute function public.touch_updated_at();

drop trigger if exists exam_questions_touch_updated_at on public.exam_questions;
create trigger exam_questions_touch_updated_at before update on public.exam_questions
  for each row execute function public.touch_updated_at();

-- 8. GRANTS ------------------------------------------------------------
grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.exam_sections to authenticated;
grant select, insert, update, delete on public.exam_questions to authenticated;
grant select, insert, update, delete on public.exam_answers to authenticated;
grant all on public.exams to service_role;
grant all on public.exam_sections to service_role;
grant all on public.exam_questions to service_role;
grant all on public.exam_answers to service_role;

-- 9. RLS ---------------------------------------------------------------
alter table public.exams enable row level security;
alter table public.exam_sections enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_answers enable row level security;

-- Owner: akses penuh ke seluruh exam.
drop policy if exists "exams_owner_all" on public.exams;
create policy "exams_owner_all" on public.exams for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Pengguna tenant: hanya membaca exam yang sudah published.
drop policy if exists "exams_select_published" on public.exams;
create policy "exams_select_published" on public.exams for select to authenticated
  using (
    status = 'published'::public.exam_status
    and (tenant_id is null or tenant_id = public.current_tenant_id())
  );

-- Section / Question / Answer mengikuti hak akses exam induknya.
drop policy if exists "exam_sections_owner_all" on public.exam_sections;
create policy "exam_sections_owner_all" on public.exam_sections for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "exam_sections_select_published" on public.exam_sections;
create policy "exam_sections_select_published" on public.exam_sections for select to authenticated
  using (exists (
    select 1 from public.exams e
    where e.id = exam_id
      and e.status = 'published'::public.exam_status
      and (e.tenant_id is null or e.tenant_id = public.current_tenant_id())
  ));

drop policy if exists "exam_questions_owner_all" on public.exam_questions;
create policy "exam_questions_owner_all" on public.exam_questions for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "exam_questions_select_published" on public.exam_questions;
create policy "exam_questions_select_published" on public.exam_questions for select to authenticated
  using (exists (
    select 1 from public.exams e
    where e.id = exam_id
      and e.status = 'published'::public.exam_status
      and (e.tenant_id is null or e.tenant_id = public.current_tenant_id())
  ));

drop policy if exists "exam_answers_owner_all" on public.exam_answers;
create policy "exam_answers_owner_all" on public.exam_answers for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "exam_answers_select_published" on public.exam_answers;
create policy "exam_answers_select_published" on public.exam_answers for select to authenticated
  using (exists (
    select 1
    from public.exam_questions q
    join public.exams e on e.id = q.exam_id
    where q.id = question_id
      and e.status = 'published'::public.exam_status
      and (e.tenant_id is null or e.tenant_id = public.current_tenant_id())
  ));
