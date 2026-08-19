-- =====================================================================
-- SPRINT 27 — COLOR TEST EARLY COMPLETION (server-side authoritative)
-- ---------------------------------------------------------------------
-- Aturan terminal (dievaluasi di dalam answer_color_test, transactional):
--   correct >= min_correct (7) -> PASSED  (reason 'pass_limit')
--   wrong   >= max_wrong   (5) -> FAILED  (reason 'wrong_limit')
--   skipped >= max_skip    (3) -> FAILED  (reason 'skip_limit')
--   selain itu                 -> CONTINUE
-- Timer habis / keluar        -> soal pending dinilai SALAH lalu finalize.
--
-- TIDAK mengubah: exam scoring, snapshot, timer ujian, leaderboard,
-- cancellation flow (Sprint 26), randomisasi soal.
-- Idempotent.
-- =====================================================================

alter table public.color_test_sessions
  add column if not exists max_wrong integer not null default 5;

update public.color_test_sessions set max_wrong = 5 where max_wrong is null;

-- ---------------------------------------------------------------------
-- PAYLOAD: tambah max_wrong + answered_count (soal yang benar-benar
-- dikerjakan), tanpa mengubah field lain.
-- ---------------------------------------------------------------------
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
      'answered_count', s.correct_count + s.wrong_count + s.skipped_count,
      'min_correct', s.min_correct,
      'max_wrong', s.max_wrong,
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
-- FINALISASI: parameter _grade_pending menentukan apakah soal yang belum
-- dikerjakan dinilai SALAH. Pada early completion soal sisa TIDAK
-- dikerjakan sama sekali, sehingga tidak boleh menambah wrong_count.
-- ---------------------------------------------------------------------
create or replace function public.color_test_finalize(
  _session_id uuid,
  _reason text,
  _grade_pending boolean
)
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

  -- Sudah final: idempotent, tidak pernah double finalize.
  if s.status <> 'in_progress' then
    return public.color_test_payload(s.id);
  end if;

  if _grade_pending then
    update public.color_test_session_questions
       set result = 'wrong'
     where session_id = s.id and result = 'pending';
  end if;

  update public.color_test_sessions t
     set correct_count = c.correct_count,
         wrong_count = c.wrong_count,
         skipped_count = c.skipped_count,
         completed_at = now(),
         duration_seconds = greatest(0, extract(epoch from (now() - t.started_at))::int),
         passed = (
           c.correct_count >= t.min_correct
           and _reason <> 'exit'
           and c.skipped_count < t.max_skip
           and c.wrong_count < t.max_wrong
         ),
         status = case
                    when c.correct_count >= t.min_correct
                     and _reason <> 'exit'
                     and c.skipped_count < t.max_skip
                     and c.wrong_count < t.max_wrong
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

-- Wrapper lama (2 argumen) tetap ada: default menilai soal pending = salah.
create or replace function public.color_test_finalize(_session_id uuid, _reason text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.color_test_finalize(_session_id, _reason, true)
$$;

-- ---------------------------------------------------------------------
-- JAWAB / SKIP: evaluasi terminal state setelah setiap jawaban.
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
  -- FOR UPDATE mengunci sesi: jawaban paralel diserialisasi, tidak ada
  -- double finalize maupun perhitungan ganda.
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
    return public.color_test_finalize(s.id, 'time_up', true);
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

  -- === TERMINAL CONDITIONS (early completion) ===
  -- Soal sisa TIDAK dinilai: user memang tidak mengerjakannya.
  if s.correct_count >= s.min_correct then
    return public.color_test_finalize(s.id, 'pass_limit', false);
  end if;

  if s.wrong_count >= s.max_wrong then
    return public.color_test_finalize(s.id, 'wrong_limit', false);
  end if;

  if s.skipped_count >= s.max_skip then
    return public.color_test_finalize(s.id, 'skip_limit', false);
  end if;

  -- Seluruh soal sudah dinilai tanpa mencapai kondisi terminal.
  if (s.correct_count + s.wrong_count + s.skipped_count) >= s.total_questions then
    return public.color_test_finalize(s.id, 'completed', false);
  end if;

  return public.color_test_payload(s.id);
end;
$$;

-- ---------------------------------------------------------------------
-- RINGKASAN: tambah answered_count + max_wrong untuk Result / Riwayat.
-- ---------------------------------------------------------------------
drop function if exists public.list_color_test_summaries(uuid[]);
create or replace function public.list_color_test_summaries(p_attempt_ids uuid[])
returns table (
  exam_attempt_id uuid,
  status text,
  passed boolean,
  correct_count integer,
  wrong_count integer,
  skipped_count integer,
  answered_count integer,
  total_questions integer,
  max_wrong integer,
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
         s.skipped_count,
         (s.correct_count + s.wrong_count + s.skipped_count)::int as answered_count,
         s.total_questions, s.max_wrong, s.max_skip, s.duration_seconds, s.completed_at
  from public.color_test_sessions s
  where s.exam_attempt_id = any(p_attempt_ids)
    and (s.user_id = auth.uid() or public.is_owner())
$$;

grant execute on function public.color_test_payload(uuid) to authenticated;
grant execute on function public.color_test_finalize(uuid, text) to authenticated;
grant execute on function public.color_test_finalize(uuid, text, boolean) to authenticated;
grant execute on function public.answer_color_test(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.list_color_test_summaries(uuid[]) to authenticated;
