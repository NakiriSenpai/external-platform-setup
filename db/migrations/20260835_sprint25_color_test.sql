-- =====================================================================
-- SPRINT 25 — COLOR TEST / TES BUTA WARNA
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang. TIDAK menyentuh Exam Snapshot,
-- scoring, timer, security, maupun leaderboard yang sudah ada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. QUESTION POOL (terpisah total dari Exam Question Bank)
-- ---------------------------------------------------------------------
create table if not exists public.color_test_questions (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  image_public_id text,
  correct_answer text not null,
  answer_type text not null default 'numeric',
  difficulty text,
  category text,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists color_test_questions_active_idx
  on public.color_test_questions (active)
  where archived_at is null;

grant select on public.color_test_questions to authenticated;
grant all on public.color_test_questions to service_role;
alter table public.color_test_questions enable row level security;

-- Kunci jawaban TIDAK boleh terbaca siswa: hanya owner yang boleh SELECT langsung.
-- Siswa membaca soal lewat RPC SECURITY DEFINER (tanpa correct_answer).
drop policy if exists color_test_questions_owner_all on public.color_test_questions;
create policy color_test_questions_owner_all
  on public.color_test_questions for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- 2. SESSION (satu per exam attempt, immutable setelah dimulai)
-- ---------------------------------------------------------------------
create table if not exists public.color_test_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_attempt_id uuid not null unique references public.exam_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress',
  total_questions integer not null default 12,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  skipped_count integer not null default 0,
  min_correct integer not null default 7,
  max_skip integer not null default 3,
  time_limit_seconds integer not null default 150,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '150 seconds',
  completed_at timestamptz,
  duration_seconds integer,
  passed boolean not null default false,
  finish_reason text,
  created_at timestamptz not null default now()
);

create index if not exists color_test_sessions_user_idx on public.color_test_sessions (user_id);

grant select on public.color_test_sessions to authenticated;
grant all on public.color_test_sessions to service_role;
alter table public.color_test_sessions enable row level security;

drop policy if exists color_test_sessions_select_own on public.color_test_sessions;
create policy color_test_sessions_select_own
  on public.color_test_sessions for select to authenticated
  using (user_id = auth.uid() or public.is_owner());

drop policy if exists color_test_sessions_owner_all on public.color_test_sessions;
create policy color_test_sessions_owner_all
  on public.color_test_sessions for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- 3. SESSION QUESTIONS (question-level result, immutable selection)
-- ---------------------------------------------------------------------
create table if not exists public.color_test_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.color_test_sessions(id) on delete cascade,
  question_id uuid not null references public.color_test_questions(id) on delete restrict,
  question_order integer not null,
  image_url text not null,
  answer_type text not null default 'numeric',
  user_answer text,
  correct_answer text not null,
  result text not null default 'pending',
  skipped boolean not null default false,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, question_id),
  unique (session_id, question_order)
);

create index if not exists color_test_session_questions_session_idx
  on public.color_test_session_questions (session_id);

grant select on public.color_test_session_questions to authenticated;
grant all on public.color_test_session_questions to service_role;
alter table public.color_test_session_questions enable row level security;

-- Kunci jawaban tidak dibaca langsung oleh siswa saat tes berjalan:
-- baris hanya terbaca setelah session selesai (atau oleh owner).
drop policy if exists color_test_session_questions_select_own on public.color_test_session_questions;
create policy color_test_session_questions_select_own
  on public.color_test_session_questions for select to authenticated
  using (
    public.is_owner()
    or exists (
      select 1 from public.color_test_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
        and s.status <> 'in_progress'
    )
  );

drop policy if exists color_test_session_questions_owner_all on public.color_test_session_questions;
create policy color_test_session_questions_owner_all
  on public.color_test_session_questions for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- 4. HELPER: normalisasi jawaban + payload session
-- ---------------------------------------------------------------------
create or replace function public.color_test_normalize(_value text)
returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(_value, ''), '\s', '', 'g'))
$$;

create or replace function public.color_test_payload(_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.color_test_sessions;
  reveal boolean;
  items jsonb;
begin
  select * into s from public.color_test_sessions where id = _session_id;
  if not found then
    raise exception 'Sesi tes buta warna tidak ditemukan.';
  end if;
  if s.user_id <> auth.uid() and not public.is_owner() then
    raise exception 'Tidak diizinkan.';
  end if;

  reveal := s.status <> 'in_progress';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id', q.question_id,
        'question_order', q.question_order,
        'image_url', q.image_url,
        'answer_type', q.answer_type,
        'user_answer', q.user_answer,
        'skipped', q.skipped,
        'answered', q.result <> 'pending',
        'result', case when reveal then q.result else null end,
        'correct_answer', case when reveal then q.correct_answer else null end
      ) order by q.question_order
    ),
    '[]'::jsonb
  )
  into items
  from public.color_test_session_questions q
  where q.session_id = s.id;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id,
      'exam_attempt_id', s.exam_attempt_id,
      'user_id', s.user_id,
      'status', s.status,
      'total_questions', s.total_questions,
      'correct_count', s.correct_count,
      'wrong_count', s.wrong_count,
      'skipped_count', s.skipped_count,
      'min_correct', s.min_correct,
      'max_skip', s.max_skip,
      'time_limit_seconds', s.time_limit_seconds,
      'started_at', s.started_at,
      'expires_at', s.expires_at,
      'completed_at', s.completed_at,
      'duration_seconds', s.duration_seconds,
      'passed', s.passed,
      'finish_reason', s.finish_reason
    ),
    'questions', items,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. FINALISASI (dipakai internal + saat waktu habis / keluar)
-- ---------------------------------------------------------------------
create or replace function public.color_test_finalize(_session_id uuid, _reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.color_test_sessions;
begin
  select * into s from public.color_test_sessions where id = _session_id for update;
  if not found then
    raise exception 'Sesi tes buta warna tidak ditemukan.';
  end if;
  if s.user_id <> auth.uid() and not public.is_owner() then
    raise exception 'Tidak diizinkan.';
  end if;

  if s.status <> 'in_progress' then
    return public.color_test_payload(s.id);
  end if;

  -- Soal yang belum dijawab dinilai SALAH (bukan skip).
  update public.color_test_session_questions
     set result = 'wrong'
   where session_id = s.id and result = 'pending';

  update public.color_test_sessions t
     set correct_count = c.correct_count,
         wrong_count = c.wrong_count,
         skipped_count = c.skipped_count,
         completed_at = now(),
         duration_seconds = greatest(0, extract(epoch from (now() - t.started_at))::int),
         passed = (c.correct_count >= t.min_correct and _reason <> 'exit' and _reason <> 'skip_limit'),
         status = case
                    when c.correct_count >= t.min_correct and _reason not in ('exit', 'skip_limit')
                      then 'passed' else 'failed' end,
         finish_reason = _reason
    from (
      select
        count(*) filter (where result = 'correct') as correct_count,
        count(*) filter (where result = 'wrong') as wrong_count,
        count(*) filter (where result = 'skipped') as skipped_count
      from public.color_test_session_questions where session_id = s.id
    ) c
   where t.id = s.id;

  return public.color_test_payload(s.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. START / RESUME SESSION (randomisasi server-side + anti-repeat)
-- ---------------------------------------------------------------------
create or replace function public.start_color_test(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.exam_attempts;
  s public.color_test_sessions;
  v_total integer := 12;
  v_pool integer;
begin
  select * into a from public.exam_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt tidak ditemukan.';
  end if;
  if a.user_id <> auth.uid() then
    raise exception 'Tidak diizinkan.';
  end if;
  if a.status = 'in_progress' then
    raise exception 'Ujian belum dikumpulkan.';
  end if;

  -- Session immutable: bila sudah ada, kembalikan apa adanya.
  select * into s from public.color_test_sessions where exam_attempt_id = p_attempt_id;
  if found then
    if s.status = 'in_progress' and now() > s.expires_at then
      return public.color_test_finalize(s.id, 'time_up');
    end if;
    return public.color_test_payload(s.id);
  end if;

  select count(*) into v_pool
  from public.color_test_questions
  where active and archived_at is null;

  if v_pool < 1 then
    raise exception 'Bank soal tes buta warna masih kosong.';
  end if;
  if v_pool < v_total then
    v_total := v_pool;
  end if;

  insert into public.color_test_sessions (exam_attempt_id, user_id, total_questions, started_at, expires_at)
  values (p_attempt_id, a.user_id, v_total, now(), now() + make_interval(secs => 150))
  returning * into s;

  -- Randomisasi server-side. Prioritas: soal yang BELUM pernah diterima user.
  insert into public.color_test_session_questions
    (session_id, question_id, question_order, image_url, answer_type, correct_answer)
  select s.id, q.id, row_number() over (), q.image_url, q.answer_type, q.correct_answer
  from (
    select cq.id, cq.image_url, cq.answer_type, cq.correct_answer
    from public.color_test_questions cq
    where cq.active and cq.archived_at is null
    order by
      exists (
        select 1
        from public.color_test_session_questions used
        join public.color_test_sessions us on us.id = used.session_id
        where used.question_id = cq.id and us.user_id = a.user_id
      ) asc,
      random()
    limit v_total
  ) q;

  return public.color_test_payload(s.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. BACA SESSION (auto finalisasi bila waktu habis)
-- ---------------------------------------------------------------------
create or replace function public.get_color_test(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.color_test_sessions;
begin
  select * into s from public.color_test_sessions where exam_attempt_id = p_attempt_id;
  if not found then
    return null;
  end if;
  if s.user_id <> auth.uid() and not public.is_owner() then
    raise exception 'Tidak diizinkan.';
  end if;
  if s.status = 'in_progress' and now() > s.expires_at then
    return public.color_test_finalize(s.id, 'time_up');
  end if;
  return public.color_test_payload(s.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. JAWAB / SKIP (penilaian server-side)
-- ---------------------------------------------------------------------
create or replace function public.answer_color_test(
  p_session_id uuid,
  p_question_id uuid,
  p_answer text,
  p_skip boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.color_test_sessions;
  q public.color_test_session_questions;
  v_result text;
begin
  select * into s from public.color_test_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sesi tes buta warna tidak ditemukan.';
  end if;
  if s.user_id <> auth.uid() then
    raise exception 'Tidak diizinkan.';
  end if;
  if s.status <> 'in_progress' then
    return public.color_test_payload(s.id);
  end if;
  if now() > s.expires_at then
    return public.color_test_finalize(s.id, 'time_up');
  end if;

  select * into q from public.color_test_session_questions
   where session_id = s.id and question_id = p_question_id for update;
  if not found then
    raise exception 'Soal tidak ada pada sesi ini.';
  end if;
  if q.result <> 'pending' then
    return public.color_test_payload(s.id);
  end if;

  if p_skip then
    v_result := 'skipped';
  elsif public.color_test_normalize(p_answer) = '' then
    raise exception 'Jawaban kosong.';
  elsif public.color_test_normalize(p_answer) = public.color_test_normalize(q.correct_answer) then
    v_result := 'correct';
  else
    v_result := 'wrong';
  end if;

  update public.color_test_session_questions
     set user_answer = case when p_skip then null else p_answer end,
         result = v_result,
         skipped = p_skip,
         answered_at = now()
   where id = q.id;

  update public.color_test_sessions t
     set correct_count = c.correct_count,
         wrong_count = c.wrong_count,
         skipped_count = c.skipped_count
    from (
      select
        count(*) filter (where result = 'correct') as correct_count,
        count(*) filter (where result = 'wrong') as wrong_count,
        count(*) filter (where result = 'skipped') as skipped_count
      from public.color_test_session_questions where session_id = s.id
    ) c
   where t.id = s.id
  returning t.* into s;

  -- Batas skip tercapai → langsung GAGAL.
  if s.skipped_count >= s.max_skip then
    return public.color_test_finalize(s.id, 'skip_limit');
  end if;

  -- Tidak mungkin lagi mencapai minimal benar → selesai otomatis.
  if (s.total_questions - s.wrong_count - s.skipped_count) < s.min_correct then
    return public.color_test_finalize(s.id, 'wrong_limit');
  end if;

  -- Seluruh soal sudah dinilai.
  if (s.correct_count + s.wrong_count + s.skipped_count) >= s.total_questions then
    return public.color_test_finalize(s.id, 'completed');
  end if;

  return public.color_test_payload(s.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. SELESAI MANUAL / KELUAR (back button)
-- ---------------------------------------------------------------------
create or replace function public.finish_color_test(p_session_id uuid, p_reason text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reason not in ('manual', 'exit', 'time_up') then
    p_reason := 'manual';
  end if;
  return public.color_test_finalize(p_session_id, p_reason);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. RINGKASAN UNTUK RESULT / RIWAYAT (batch, read-only)
-- ---------------------------------------------------------------------
create or replace function public.list_color_test_summaries(p_attempt_ids uuid[])
returns table (
  exam_attempt_id uuid,
  status text,
  passed boolean,
  correct_count integer,
  wrong_count integer,
  skipped_count integer,
  total_questions integer,
  max_skip integer,
  duration_seconds integer,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.exam_attempt_id, s.status, s.passed, s.correct_count, s.wrong_count,
         s.skipped_count, s.total_questions, s.max_skip, s.duration_seconds, s.completed_at
  from public.color_test_sessions s
  where s.exam_attempt_id = any(p_attempt_ids)
    and (s.user_id = auth.uid() or public.is_owner())
$$;

grant execute on function public.start_color_test(uuid) to authenticated;
grant execute on function public.get_color_test(uuid) to authenticated;
grant execute on function public.answer_color_test(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.finish_color_test(uuid, text) to authenticated;
grant execute on function public.list_color_test_summaries(uuid[]) to authenticated;
grant execute on function public.color_test_payload(uuid) to authenticated;
grant execute on function public.color_test_finalize(uuid, text) to authenticated;
