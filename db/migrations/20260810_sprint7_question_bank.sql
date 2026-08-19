-- =====================================================================
-- SPRINT 7 — QUESTION BANK FOUNDATION
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, 4, dan 6 sudah dijalankan.
--
-- ARSITEKTUR:
-- Soal kini disimpan terpusat di public.questions (Question Bank).
-- Exam TIDAK menduplikasi soal: public.exam_questions berubah menjadi
-- tabel REFERENSI (exam_id + section_id + question_id + order_index).
-- Grammar memakai relasi (grammar_tags & question_grammar_tags).
-- Lesson memakai foreign key lesson_id (nullable).
-- =====================================================================

-- 1. ENUM --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'question_source_type') then
    create type public.question_source_type as enum ('exam', 'lesson', 'import', 'manual');
  end if;
end$$;

-- 2. TABEL LESSONS (minimal, hanya untuk foreign key Sprint 7) ---------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  title text not null,
  slug text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. GRAMMAR TAGS (relasi, bukan string) -------------------------------
create table if not exists public.grammar_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.grammar_tags (slug, name) values
  ('partikel', 'Partikel'),
  ('kata-kerja', 'Kata Kerja'),
  ('kata-sifat', 'Kata Sifat'),
  ('bentuk-te', 'Bentuk Te'),
  ('bentuk-ta', 'Bentuk Ta'),
  ('keigo', 'Keigo'),
  ('pola-kalimat', 'Pola Kalimat'),
  ('kosakata', 'Kosakata'),
  ('kanji', 'Kanji'),
  ('listening', 'Listening')
on conflict (slug) do nothing;

-- 4. QUESTION BANK -----------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  text text not null,
  image_url text,
  audio_url text,
  explanation text,
  category text not null default 'umum',
  difficulty public.exam_difficulty not null default 'sedang',
  lesson_id uuid references public.lessons (id) on delete set null,
  source_type public.question_source_type not null default 'manual',
  created_from uuid,
  used_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D')),
  text text,
  image_url text,
  audio_url text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, label)
);

create table if not exists public.question_grammar_tags (
  question_id uuid not null references public.questions (id) on delete cascade,
  tag_id uuid not null references public.grammar_tags (id) on delete cascade,
  primary key (question_id, tag_id)
);

-- 5. EXAM_QUESTIONS MENJADI TABEL REFERENSI ----------------------------
alter table public.exam_questions
  add column if not exists question_id uuid references public.questions (id) on delete cascade;
alter table public.exam_questions alter column text drop not null;

-- Migrasi data lama: pindahkan soal Sprint 6 ke Question Bank.
do $$
declare
  rec record;
  new_id uuid;
begin
  for rec in
    select * from public.exam_questions where question_id is null
  loop
    insert into public.questions (
      text, image_url, audio_url, explanation, category, source_type,
      created_from, created_at, updated_at
    )
    values (
      coalesce(rec.text, '(tanpa teks)'), rec.image_url, rec.audio_url, rec.explanation,
      'umum', 'exam', rec.exam_id, rec.created_at, rec.updated_at
    )
    returning id into new_id;

    insert into public.question_answers (question_id, label, text, image_url, audio_url, is_correct)
    select new_id, a.label, a.text, a.image_url, a.audio_url, a.is_correct
    from public.exam_answers a
    where a.question_id = rec.id
    on conflict (question_id, label) do nothing;

    if rec.grammar_tag is not null and rec.grammar_tag <> '' then
      insert into public.question_grammar_tags (question_id, tag_id)
      select new_id, t.id from public.grammar_tags t where t.slug = rec.grammar_tag
      on conflict do nothing;
    end if;

    update public.exam_questions set question_id = new_id where id = rec.id;
  end loop;
end$$;

-- 6. STATISTIK PENGGUNAAN ---------------------------------------------
create or replace function public.touch_question_usage(_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.questions
  set used_count = used_count + 1,
      last_used_at = now()
  where id = any(_ids);
$$;

-- 7. INDEX -------------------------------------------------------------
create index if not exists questions_source_idx on public.questions (source_type);
create index if not exists questions_category_idx on public.questions (category);
create index if not exists questions_difficulty_idx on public.questions (difficulty);
create index if not exists questions_lesson_idx on public.questions (lesson_id);
create index if not exists questions_created_at_idx on public.questions (created_at desc);
create index if not exists question_answers_question_idx on public.question_answers (question_id);
create index if not exists question_grammar_tag_idx on public.question_grammar_tags (tag_id);
create index if not exists exam_questions_question_idx on public.exam_questions (question_id);

-- 8. TRIGGER updated_at ------------------------------------------------
drop trigger if exists questions_touch_updated_at on public.questions;
create trigger questions_touch_updated_at before update on public.questions
  for each row execute function public.touch_updated_at();

drop trigger if exists lessons_touch_updated_at on public.lessons;
create trigger lessons_touch_updated_at before update on public.lessons
  for each row execute function public.touch_updated_at();

-- 9. GRANTS ------------------------------------------------------------
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_answers to authenticated;
grant select, insert, update, delete on public.question_grammar_tags to authenticated;
grant select on public.grammar_tags to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant all on public.questions to service_role;
grant all on public.question_answers to service_role;
grant all on public.question_grammar_tags to service_role;
grant all on public.grammar_tags to service_role;
grant all on public.lessons to service_role;
grant execute on function public.touch_question_usage(uuid[]) to authenticated;

-- 10. RLS --------------------------------------------------------------
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;
alter table public.question_grammar_tags enable row level security;
alter table public.grammar_tags enable row level security;
alter table public.lessons enable row level security;

drop policy if exists "questions_owner_all" on public.questions;
create policy "questions_owner_all" on public.questions for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "questions_select_tenant" on public.questions;
create policy "questions_select_tenant" on public.questions for select to authenticated
  using (tenant_id is null or tenant_id = public.current_tenant_id());

drop policy if exists "question_answers_owner_all" on public.question_answers;
create policy "question_answers_owner_all" on public.question_answers for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "question_answers_select" on public.question_answers;
create policy "question_answers_select" on public.question_answers for select to authenticated
  using (exists (
    select 1 from public.questions q
    where q.id = question_id
      and (q.tenant_id is null or q.tenant_id = public.current_tenant_id())
  ));

drop policy if exists "question_grammar_tags_owner_all" on public.question_grammar_tags;
create policy "question_grammar_tags_owner_all" on public.question_grammar_tags for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "question_grammar_tags_select" on public.question_grammar_tags;
create policy "question_grammar_tags_select" on public.question_grammar_tags for select to authenticated
  using (true);

drop policy if exists "grammar_tags_select" on public.grammar_tags;
create policy "grammar_tags_select" on public.grammar_tags for select to authenticated
  using (true);

drop policy if exists "lessons_owner_all" on public.lessons;
create policy "lessons_owner_all" on public.lessons for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "lessons_select_tenant" on public.lessons;
create policy "lessons_select_tenant" on public.lessons for select to authenticated
  using (tenant_id is null or tenant_id = public.current_tenant_id());
