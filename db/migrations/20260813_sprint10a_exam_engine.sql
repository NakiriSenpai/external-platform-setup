-- =====================================================================
-- SPRINT 10A — EXAM ENGINE CORE
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, 4, 6, 7, 8, dan 9 sudah dijalankan.
--
-- ARSITEKTUR:
-- Satu klik "Mulai Ujian" => satu Attempt + satu Snapshot IMMUTABLE.
-- Snapshot menyimpan seluruh isi ujian (exam, setting, section, question,
-- answer, explanation, grammar tag, lesson reference, media) sebagai JSONB.
-- Setelah dibuat, snapshot tidak boleh berubah (trigger penjaga).
-- =====================================================================

-- 1. ENUM --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'exam_attempt_status') then
    create type public.exam_attempt_status as enum
      ('in_progress', 'submitted', 'expired', 'cancelled');
  end if;
end$$;

-- 2. ATTEMPT -----------------------------------------------------------
create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  status public.exam_attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  duration_minutes integer not null default 0,
  total_questions integer not null default 0,
  fullscreen_violations integer not null default 0,
  fullscreen_limit integer not null default 4,
  auto_submitted boolean not null default false,
  submit_reason text,
  score numeric(6, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ANTI DUPLICATE: hanya satu attempt aktif per (exam, user).
create unique index if not exists exam_attempts_active_unique
  on public.exam_attempts (exam_id, user_id)
  where status = 'in_progress';

create index if not exists exam_attempts_user_idx on public.exam_attempts (user_id, created_at desc);
create index if not exists exam_attempts_exam_idx on public.exam_attempts (exam_id);

-- 3. SNAPSHOT IMMUTABLE ------------------------------------------------
-- payload        : snapshot lengkap (termasuk kunci jawaban & pembahasan)
-- student_payload: snapshot untuk siswa (tanpa is_correct & explanation)
create table if not exists public.exam_attempt_snapshots (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.exam_attempts (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  payload jsonb not null,
  student_payload jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.freeze_exam_snapshot()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Snapshot ujian bersifat immutable dan tidak dapat diubah.';
end;
$$;

drop trigger if exists exam_attempt_snapshots_immutable on public.exam_attempt_snapshots;
create trigger exam_attempt_snapshots_immutable before update on public.exam_attempt_snapshots
  for each row execute function public.freeze_exam_snapshot();

-- 4. JAWABAN (auto save) ----------------------------------------------
create table if not exists public.exam_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null,
  question_index integer not null default 0,
  selected_label text check (selected_label in ('A', 'B', 'C', 'D')),
  is_flagged boolean not null default false,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists exam_attempt_answers_attempt_idx
  on public.exam_attempt_answers (attempt_id);

-- 5. TRIGGER updated_at ------------------------------------------------
drop trigger if exists exam_attempts_touch_updated_at on public.exam_attempts;
create trigger exam_attempts_touch_updated_at before update on public.exam_attempts
  for each row execute function public.touch_updated_at();

drop trigger if exists exam_attempt_answers_touch_updated_at on public.exam_attempt_answers;
create trigger exam_attempt_answers_touch_updated_at before update on public.exam_attempt_answers
  for each row execute function public.touch_updated_at();

-- 6. GRANTS ------------------------------------------------------------
grant select, insert, update on public.exam_attempts to authenticated;
grant select, insert, update, delete on public.exam_attempt_answers to authenticated;
-- Kolom `payload` (berisi kunci jawaban) TIDAK diberikan ke authenticated.
grant insert on public.exam_attempt_snapshots to authenticated;
grant select (id, attempt_id, exam_id, student_payload, created_at)
  on public.exam_attempt_snapshots to authenticated;
grant all on public.exam_attempts to service_role;
grant all on public.exam_attempt_snapshots to service_role;
grant all on public.exam_attempt_answers to service_role;

-- 7. RLS ---------------------------------------------------------------
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_snapshots enable row level security;
alter table public.exam_attempt_answers enable row level security;

drop policy if exists "exam_attempts_owner_all" on public.exam_attempts;
create policy "exam_attempts_owner_all" on public.exam_attempts for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "exam_attempts_self_select" on public.exam_attempts;
create policy "exam_attempts_self_select" on public.exam_attempts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "exam_attempts_self_insert" on public.exam_attempts;
create policy "exam_attempts_self_insert" on public.exam_attempts for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "exam_attempts_self_update" on public.exam_attempts;
create policy "exam_attempts_self_update" on public.exam_attempts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "exam_snapshots_owner_all" on public.exam_attempt_snapshots;
create policy "exam_snapshots_owner_all" on public.exam_attempt_snapshots for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "exam_snapshots_self_select" on public.exam_attempt_snapshots;
create policy "exam_snapshots_self_select" on public.exam_attempt_snapshots for select to authenticated
  using (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  ));

drop policy if exists "exam_snapshots_self_insert" on public.exam_attempt_snapshots;
create policy "exam_snapshots_self_insert" on public.exam_attempt_snapshots for insert to authenticated
  with check (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  ));

drop policy if exists "exam_answers_owner_all" on public.exam_attempt_answers;
create policy "exam_answers_owner_all" on public.exam_attempt_answers for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "exam_answers_self_all" on public.exam_attempt_answers;
create policy "exam_answers_self_all" on public.exam_attempt_answers for all to authenticated
  using (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.exam_attempts a
    where a.id = attempt_id and a.user_id = auth.uid() and a.status = 'in_progress'
  ));

-- 8. AKSES SISWA KE EXAM PUBLISHED -------------------------------------
drop policy if exists "exams_published_select" on public.exams;
create policy "exams_published_select" on public.exams for select to authenticated
  using (status = 'published' and (tenant_id is null or tenant_id = public.current_tenant_id()));
