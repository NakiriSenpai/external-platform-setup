-- =====================================================================
-- SPRINT 10B — EXAM RESULT & REVIEW
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, 4, 6, 7, 8, 9, dan 10A sudah dijalankan.
--
-- ARSITEKTUR:
-- Scoring dihitung SATU KALI saat submit, di dalam function SECURITY DEFINER
-- (karena kunci jawaban ada di kolom `payload` yang tidak dapat dibaca siswa).
-- Hasil disimpan permanen di public.exam_attempt_results.
-- Halaman Result & Review hanya MEMBACA, tidak pernah menghitung ulang.
-- =====================================================================

-- 1. TABEL RESULT ------------------------------------------------------
create table if not exists public.exam_attempt_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.exam_attempts (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  exam_title text not null default '',
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  skipped_count integer not null default 0,
  score numeric(6, 2) not null default 0,
  passing_score numeric(6, 2) not null default 0,
  passed boolean not null default false,
  duration_seconds integer not null default 0,
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  auto_submitted boolean not null default false,
  submit_reason text,
  created_at timestamptz not null default now()
);

create index if not exists exam_attempt_results_user_idx
  on public.exam_attempt_results (user_id, submitted_at desc);
create index if not exists exam_attempt_results_exam_idx
  on public.exam_attempt_results (exam_id);

-- Result bersifat final: tidak boleh di-update.
create or replace function public.freeze_exam_result()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Hasil ujian bersifat final dan tidak dapat diubah.';
end;
$$;

drop trigger if exists exam_attempt_results_immutable on public.exam_attempt_results;
create trigger exam_attempt_results_immutable before update on public.exam_attempt_results
  for each row execute function public.freeze_exam_result();

-- 2. KOLOM RINGKASAN PADA ATTEMPT --------------------------------------
alter table public.exam_attempts
  add column if not exists correct_count integer not null default 0,
  add column if not exists wrong_count integer not null default 0,
  add column if not exists skipped_count integer not null default 0,
  add column if not exists passed boolean not null default false,
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists submitted_at timestamptz,
  add column if not exists scored_at timestamptz;

-- 3. GRANTS ------------------------------------------------------------
-- Insert hanya melalui function SECURITY DEFINER di bawah.
grant select on public.exam_attempt_results to authenticated;
grant all on public.exam_attempt_results to service_role;

-- 4. RLS ---------------------------------------------------------------
alter table public.exam_attempt_results enable row level security;

drop policy if exists "exam_results_owner_all" on public.exam_attempt_results;
create policy "exam_results_owner_all" on public.exam_attempt_results for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "exam_results_self_select" on public.exam_attempt_results;
create policy "exam_results_self_select" on public.exam_attempt_results for select to authenticated
  using (user_id = auth.uid());

-- 5. SCORING SATU KALI SAAT SUBMIT -------------------------------------
create or replace function public.submit_exam_attempt(
  p_attempt_id uuid,
  p_reason text default 'manual'
)
returns public.exam_attempt_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_payload jsonb;
  v_result public.exam_attempt_results%rowtype;
  v_total integer := 0;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_skipped integer := 0;
  v_score numeric(6, 2) := 0;
  v_passing numeric(6, 2) := 0;
  v_now timestamptz := now();
  v_reason text := coalesce(nullif(p_reason, ''), 'manual');
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'Attempt tidak ditemukan.';
  end if;
  if v_attempt.user_id <> auth.uid() and not public.is_owner() then
    raise exception 'Anda tidak berhak mengumpulkan attempt ini.';
  end if;

  -- Sudah pernah dinilai: kembalikan hasil yang tersimpan (tidak menghitung ulang).
  select * into v_result from public.exam_attempt_results where attempt_id = p_attempt_id;
  if found then
    return v_result;
  end if;

  select payload into v_payload
  from public.exam_attempt_snapshots
  where attempt_id = p_attempt_id;
  if v_payload is null then
    raise exception 'Snapshot ujian tidak ditemukan.';
  end if;

  v_passing := coalesce((v_payload -> 'exam' ->> 'passing_score')::numeric, 0);

  with q as (
    select
      (item ->> 'question_id')::uuid as question_id,
      item ->> 'correct_label' as correct_label
    from jsonb_array_elements(v_payload -> 'questions') as item
  ),
  scored as (
    select
      q.correct_label,
      a.selected_label
    from q
    left join public.exam_attempt_answers a
      on a.attempt_id = p_attempt_id and a.question_id = q.question_id
  )
  select
    count(*)::int,
    count(*) filter (where selected_label is not null and selected_label = correct_label)::int,
    count(*) filter (where selected_label is not null and selected_label is distinct from correct_label)::int,
    count(*) filter (where selected_label is null)::int
  into v_total, v_correct, v_wrong, v_skipped
  from scored;

  if v_total > 0 then
    v_score := round((v_correct::numeric * 100) / v_total, 2);
  end if;

  update public.exam_attempts
  set
    status = case when v_reason = 'time_up' then 'expired'::public.exam_attempt_status
                  else 'submitted'::public.exam_attempt_status end,
    finished_at = coalesce(finished_at, v_now),
    submitted_at = coalesce(submitted_at, v_now),
    scored_at = v_now,
    auto_submitted = (v_reason <> 'manual'),
    submit_reason = v_reason,
    score = v_score,
    correct_count = v_correct,
    wrong_count = v_wrong,
    skipped_count = v_skipped,
    passed = (v_score >= v_passing),
    duration_seconds = greatest(0, extract(epoch from (v_now - v_attempt.started_at))::int)
  where id = p_attempt_id
  returning * into v_attempt;

  insert into public.exam_attempt_results (
    attempt_id, exam_id, user_id, tenant_id, exam_title,
    total_questions, correct_count, wrong_count, skipped_count,
    score, passing_score, passed,
    duration_seconds, started_at, submitted_at, auto_submitted, submit_reason
  ) values (
    p_attempt_id, v_attempt.exam_id, v_attempt.user_id, v_attempt.tenant_id,
    coalesce(v_payload -> 'exam' ->> 'title', ''),
    v_total, v_correct, v_wrong, v_skipped,
    v_score, v_passing, (v_score >= v_passing),
    v_attempt.duration_seconds, v_attempt.started_at, v_now,
    v_attempt.auto_submitted, v_reason
  )
  on conflict (attempt_id) do nothing
  returning * into v_result;

  if v_result.id is null then
    select * into v_result from public.exam_attempt_results where attempt_id = p_attempt_id;
  end if;

  return v_result;
end;
$$;

grant execute on function public.submit_exam_attempt(uuid, text) to authenticated;

-- 6. REVIEW: SNAPSHOT LENGKAP SETELAH SELESAI --------------------------
-- Mengembalikan payload internal (kunci jawaban + pembahasan) HANYA jika
-- attempt milik pemanggil DAN sudah selesai.
create or replace function public.get_exam_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_payload jsonb;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt tidak ditemukan.';
  end if;
  if v_attempt.user_id <> auth.uid() and not public.is_owner() then
    raise exception 'Anda tidak berhak melihat review ini.';
  end if;
  if v_attempt.status = 'in_progress' then
    raise exception 'Review hanya tersedia setelah ujian dikumpulkan.';
  end if;

  select payload into v_payload
  from public.exam_attempt_snapshots
  where attempt_id = p_attempt_id;
  if v_payload is null then
    raise exception 'Snapshot ujian tidak ditemukan.';
  end if;

  return v_payload;
end;
$$;

grant execute on function public.get_exam_attempt_review(uuid) to authenticated;
