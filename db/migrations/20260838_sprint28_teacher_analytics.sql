-- =====================================================================
-- SPRINT 28 — TEACHER / PLATFORM ANALYTICS (REDESIGN)
-- Jalankan seluruh isi file ini di Supabase SQL Editor.
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: Sprint 2..27 sudah dijalankan.
--
-- SEMANTIK RESMI:
--   * Total Ujian / attempt count  = SELURUH completed attempt.
--   * Rata-rata nilai & kelulusan  = ATTEMPT PERTAMA per siswa per exam.
-- Tidak mengubah snapshot, scoring, timer, leaderboard, maupun color test.
-- =====================================================================

-- 0. INDEX PENDUKUNG (aditif, tidak mengubah data) ---------------------
create index if not exists exam_attempt_results_user_exam_idx
  on public.exam_attempt_results (user_id, exam_id, submitted_at asc);

-- 1. FLAG SISWA UNTUK PERHITUNGAN ANALITIK -----------------------------
alter table public.profiles
  add column if not exists analytics_excluded boolean not null default false;

create or replace function public.set_student_analytics_excluded(
  p_user_ids uuid[],
  p_excluded boolean,
  p_tenant_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
  v_count integer := 0;
begin
  update public.profiles p
  set analytics_excluded = coalesce(p_excluded, false)
  where p.id = any (coalesce(p_user_ids, '{}'::uuid[]))
    and p.role = 'siswa'
    and p.tenant_id is not distinct from v_tenant;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.set_student_analytics_excluded(uuid[], boolean, uuid)
  to authenticated;

-- 2. ATTENDANCE (AKTIVITAS HARIAN SISWA) -------------------------------
create table if not exists public.student_activity_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  activity_date date not null default (now() at time zone 'utc')::date,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  hits integer not null default 1,
  unique (user_id, activity_date)
);

create index if not exists student_activity_tenant_idx
  on public.student_activity_sessions (tenant_id, activity_date desc);

grant select on public.student_activity_sessions to authenticated;
grant all on public.student_activity_sessions to service_role;

alter table public.student_activity_sessions enable row level security;

drop policy if exists "activity_self_select" on public.student_activity_sessions;
create policy "activity_self_select" on public.student_activity_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "activity_staff_select" on public.student_activity_sessions;
create policy "activity_staff_select" on public.student_activity_sessions
  for select to authenticated using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.role <> 'siswa'
        and (p.role = 'owner' or p.tenant_id is not distinct from student_activity_sessions.tenant_id)
    )
  );

-- Heartbeat dipanggil aplikasi saat siswa aktif (foreground).
create or replace function public.record_student_activity()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_uid is null then
    return;
  end if;

  select tenant_id into v_tenant from public.profiles where id = v_uid and is_active = true;

  insert into public.student_activity_sessions (user_id, tenant_id, activity_date)
  values (v_uid, v_tenant, v_today)
  on conflict (user_id, activity_date) do update
    set last_seen_at = now(),
        hits = public.student_activity_sessions.hits + 1,
        duration_seconds = greatest(
          public.student_activity_sessions.duration_seconds,
          extract(epoch from (now() - public.student_activity_sessions.first_seen_at))::int
        ),
        tenant_id = coalesce(public.student_activity_sessions.tenant_id, excluded.tenant_id);
end;
$$;

grant execute on function public.record_student_activity() to authenticated;

-- 3. OVERVIEW ----------------------------------------------------------
create or replace function public.analytics_overview_v2(
  p_from date default null,
  p_to date default null,
  p_exam_id uuid default null,
  p_student_id uuid default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
  v_total_students integer := 0;
  v_result jsonb;
begin
  select count(*) into v_total_students
  from public.profiles
  where tenant_id is not distinct from v_tenant
    and role = 'siswa' and is_active = true and analytics_excluded = false;

  with scoped as (
    select r.*
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and p.analytics_excluded = false
      and (p_from is null or r.submitted_at >= p_from::timestamptz)
      and (p_to is null or r.submitted_at < (p_to + 1)::timestamptz)
      and (p_exam_id is null or r.exam_id = p_exam_id)
      and (p_student_id is null or r.user_id = p_student_id)
  ), firsts as (
    select distinct on (user_id, exam_id) *
    from scoped
    order by user_id, exam_id, submitted_at asc
  )
  select jsonb_build_object(
    'total_students', v_total_students,
    'active_students', (select count(distinct user_id) from scoped),
    'total_attempts', (select count(*) from scoped),
    'graded_attempts', (select count(*) from firsts),
    'average_score', coalesce((select round(avg(score), 2) from firsts), 0),
    'pass_rate', coalesce((
      select round(100.0 * count(*) filter (where passed) / nullif(count(*), 0), 2) from firsts
    ), 0),
    'average_duration_seconds', coalesce((select round(avg(duration_seconds))::int from scoped), 0),
    'correct_count', coalesce((select sum(correct_count) from firsts), 0),
    'wrong_count', coalesce((select sum(wrong_count) from firsts), 0),
    'skipped_count', coalesce((select sum(skipped_count) from firsts), 0),
    'exam_count', (select count(distinct exam_id) from scoped)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.analytics_overview_v2(date, date, uuid, uuid, uuid) to authenticated;

-- 4. TREND HARIAN ------------------------------------------------------
create or replace function public.analytics_daily_trend(
  p_from date default null,
  p_to date default null,
  p_exam_id uuid default null,
  p_student_id uuid default null,
  p_tenant_id uuid default null
)
returns table (
  day date,
  attempts bigint,
  students bigint,
  average_score numeric,
  pass_rate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
begin
  return query
  with scoped as (
    select r.*
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and p.analytics_excluded = false
      and (p_from is null or r.submitted_at >= p_from::timestamptz)
      and (p_to is null or r.submitted_at < (p_to + 1)::timestamptz)
      and (p_exam_id is null or r.exam_id = p_exam_id)
      and (p_student_id is null or r.user_id = p_student_id)
  ), firsts as (
    select distinct on (user_id, exam_id) *
    from scoped
    order by user_id, exam_id, submitted_at asc
  ), by_day as (
    select (submitted_at at time zone 'utc')::date as d,
           count(*)::bigint as attempts,
           count(distinct user_id)::bigint as students
    from scoped group by 1
  ), first_by_day as (
    select (submitted_at at time zone 'utc')::date as d,
           round(avg(score), 2) as average_score,
           round(100.0 * count(*) filter (where passed) / nullif(count(*), 0), 2) as pass_rate
    from firsts group by 1
  )
  select b.d, b.attempts, b.students,
         coalesce(f.average_score, 0), coalesce(f.pass_rate, 0)
  from by_day b
  left join first_by_day f on f.d = b.d
  order by b.d asc;
end;
$$;

grant execute on function public.analytics_daily_trend(date, date, uuid, uuid, uuid) to authenticated;

-- 5. PERFORMA PER SET UJIAN --------------------------------------------
create or replace function public.analytics_exam_performance(
  p_from date default null,
  p_to date default null,
  p_student_id uuid default null,
  p_tenant_id uuid default null
)
returns table (
  exam_id uuid,
  exam_title text,
  attempts bigint,
  students bigint,
  average_score numeric,
  pass_rate numeric,
  last_submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
begin
  return query
  with scoped as (
    select r.*
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and p.analytics_excluded = false
      and (p_from is null or r.submitted_at >= p_from::timestamptz)
      and (p_to is null or r.submitted_at < (p_to + 1)::timestamptz)
      and (p_student_id is null or r.user_id = p_student_id)
  ), firsts as (
    select distinct on (user_id, exam_id) *
    from scoped
    order by user_id, exam_id, submitted_at asc
  ), agg as (
    select s.exam_id,
           max(s.exam_title) as exam_title,
           count(*)::bigint as attempts,
           count(distinct s.user_id)::bigint as students,
           max(s.submitted_at) as last_submitted_at
    from scoped s group by s.exam_id
  ), first_agg as (
    select f.exam_id,
           round(avg(f.score), 2) as average_score,
           round(100.0 * count(*) filter (where f.passed) / nullif(count(*), 0), 2) as pass_rate
    from firsts f group by f.exam_id
  )
  select a.exam_id, a.exam_title, a.attempts, a.students,
         coalesce(fa.average_score, 0), coalesce(fa.pass_rate, 0), a.last_submitted_at
  from agg a
  left join first_agg fa on fa.exam_id = a.exam_id
  order by a.attempts desc;
end;
$$;

grant execute on function public.analytics_exam_performance(date, date, uuid, uuid) to authenticated;

-- 6. DAFTAR SISWA ------------------------------------------------------
create or replace function public.analytics_student_rows(
  p_from date default null,
  p_to date default null,
  p_exam_id uuid default null,
  p_search text default null,
  p_include_excluded boolean default false,
  p_tenant_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  analytics_excluded boolean,
  is_active boolean,
  last_login_at timestamptz,
  attempts bigint,
  exams_taken bigint,
  average_score numeric,
  pass_rate numeric,
  last_submitted_at timestamptz,
  total_rows bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
begin
  return query
  with students as (
    select p.id, coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Siswa') as name,
           p.username, p.avatar_url, p.analytics_excluded, p.is_active, p.last_login_at
    from public.profiles p
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and (coalesce(p_include_excluded, false) or p.analytics_excluded = false)
      and (
        p_search is null or p_search = '' or
        coalesce(p.display_name, '') ilike '%' || p_search || '%' or
        coalesce(p.full_name, '') ilike '%' || p_search || '%' or
        coalesce(p.username, '') ilike '%' || p_search || '%'
      )
  ), scoped as (
    select r.*
    from public.exam_attempt_results r
    join students s on s.id = r.user_id
    where (p_from is null or r.submitted_at >= p_from::timestamptz)
      and (p_to is null or r.submitted_at < (p_to + 1)::timestamptz)
      and (p_exam_id is null or r.exam_id = p_exam_id)
  ), firsts as (
    select distinct on (user_id, exam_id) *
    from scoped order by user_id, exam_id, submitted_at asc
  ), all_agg as (
    -- Agregasi sekali jalan (bukan subquery per siswa).
    select x.user_id,
           count(*)::bigint as attempts,
           count(distinct x.exam_id)::bigint as exams_taken,
           max(x.submitted_at) as last_submitted_at
    from scoped x group by x.user_id
  ), first_agg as (
    select f.user_id,
           round(avg(f.score), 2) as average_score,
           round(100.0 * count(*) filter (where f.passed) / nullif(count(*), 0), 2) as pass_rate
    from firsts f group by f.user_id
  )
  select s.id, s.name, s.username, s.avatar_url, s.analytics_excluded, s.is_active, s.last_login_at,
         coalesce(aa.attempts, 0), coalesce(aa.exams_taken, 0),
         coalesce(fa.average_score, 0), coalesce(fa.pass_rate, 0), aa.last_submitted_at,
         (select count(*) from students)::bigint as total_rows
  from students s
  left join all_agg aa on aa.user_id = s.id
  left join first_agg fa on fa.user_id = s.id
  order by coalesce(aa.attempts, 0) desc, s.name asc
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

grant execute on function public.analytics_student_rows(date, date, uuid, text, boolean, uuid, integer, integer)
  to authenticated;

-- 7. RIWAYAT ATTEMPT SATU SISWA ---------------------------------------
create or replace function public.analytics_student_attempts(
  p_student_id uuid,
  p_from date default null,
  p_to date default null,
  p_exam_id uuid default null,
  p_tenant_id uuid default null
)
returns table (
  attempt_id uuid,
  exam_id uuid,
  exam_title text,
  attempt_number integer,
  is_first boolean,
  score numeric,
  passed boolean,
  correct_count integer,
  wrong_count integer,
  skipped_count integer,
  total_questions integer,
  duration_seconds integer,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
begin
  return query
  with scoped as (
    select r.*,
           row_number() over (partition by r.exam_id order by r.submitted_at asc)::int as n
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and r.user_id = p_student_id
      and (p_from is null or r.submitted_at >= p_from::timestamptz)
      and (p_to is null or r.submitted_at < (p_to + 1)::timestamptz)
      and (p_exam_id is null or r.exam_id = p_exam_id)
  )
  select s.attempt_id, s.exam_id, s.exam_title, s.n, s.n = 1, s.score, s.passed,
         s.correct_count, s.wrong_count, s.skipped_count, s.total_questions,
         s.duration_seconds, s.submitted_at
  from scoped s
  order by s.submitted_at desc;
end;
$$;

grant execute on function public.analytics_student_attempts(uuid, date, date, uuid, uuid) to authenticated;

-- 8. TABEL NILAI (MATRIKS SISWA x SET UJIAN) ---------------------------
drop function if exists public.analytics_score_matrix(date, date, uuid, uuid);
create or replace function public.analytics_score_matrix(
  p_from date default null,
  p_to date default null,
  p_exam_id uuid default null,
  p_student_id uuid default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
  v_result jsonb;
begin
  with students as (
    select p.id, coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Siswa') as name,
           p.username
    from public.profiles p
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa' and p.analytics_excluded = false
      and (p_student_id is null or p.id = p_student_id)
  ), scoped as (
    select r.*
    from public.exam_attempt_results r
    join students s on s.id = r.user_id
    where (p_from is null or r.submitted_at >= p_from::timestamptz)
      and (p_to is null or r.submitted_at < (p_to + 1)::timestamptz)
      and (p_exam_id is null or r.exam_id = p_exam_id)
  ), firsts as (
    select distinct on (user_id, exam_id) *
    from scoped order by user_id, exam_id, submitted_at asc
  ), exams as (
    select f.exam_id, max(f.exam_title) as exam_title, count(*)::int as result_count
    from firsts f group by f.exam_id order by max(f.exam_title)
  )
  select jsonb_build_object(
    'exams', coalesce((select jsonb_agg(jsonb_build_object(
        'exam_id', e.exam_id, 'exam_title', e.exam_title, 'result_count', e.result_count
      ) order by e.exam_title) from exams e), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(row order by row->>'display_name') from (
        select jsonb_build_object(
          'user_id', s.id,
          'display_name', s.name,
          'username', s.username,
          'scores', coalesce((select jsonb_object_agg(f.exam_id::text, jsonb_build_object(
              'attempt_id', f.attempt_id, 'score', f.score, 'passed', f.passed,
              'submitted_at', f.submitted_at
            )) from firsts f where f.user_id = s.id), '{}'::jsonb),
          'average_score', coalesce((select round(avg(f.score), 2) from firsts f where f.user_id = s.id), 0),
          'taken', (select count(*) from firsts f where f.user_id = s.id)
        ) as row
        from students s
      ) t), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.analytics_score_matrix(date, date, uuid, uuid, uuid) to authenticated;

-- 9. ANALISIS SOAL -----------------------------------------------------
-- Membaca snapshot immutable (payload) hanya untuk kunci jawaban & teks soal.
-- p_scope: 'first' (default, konsisten dengan analitik utama) atau 'all'.
drop function if exists public.analytics_question_stats(uuid, date, date, uuid);
create or replace function public.analytics_question_stats(
  p_exam_id uuid,
  p_from date default null,
  p_to date default null,
  p_student_id uuid default null,
  p_scope text default 'first',
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
  v_scope text := case when lower(coalesce(p_scope, 'first')) = 'all' then 'all' else 'first' end;
  v_result jsonb;
begin
  with base as (
    select r.attempt_id, r.user_id, r.submitted_at,
           row_number() over (partition by r.user_id order by r.submitted_at asc) as rn
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa' and p.analytics_excluded = false
      and r.exam_id = p_exam_id
      and (p_student_id is null or r.user_id = p_student_id)
      and (p_from is null or r.submitted_at >= p_from::timestamptz)
      and (p_to is null or r.submitted_at < (p_to + 1)::timestamptz)
  ), scoped_attempts as (
    select b.attempt_id from base b
    where v_scope = 'all' or b.rn = 1
  ), keys as (
    select distinct on (q->>'question_id')
      (q->>'question_id')::uuid as question_id,
      coalesce((q->>'index')::int, 0) as question_index,
      coalesce(q->>'text', '') as question_text,
      q->>'correct_label' as correct_label
    from public.exam_attempt_snapshots s
    join scoped_attempts sa on sa.attempt_id = s.attempt_id
    cross join lateral jsonb_array_elements(s.payload->'questions') q
    order by q->>'question_id', coalesce((q->>'index')::int, 0)
  ), answers as (
    select a.attempt_id, a.question_id, a.selected_label
    from public.exam_attempt_answers a
    join scoped_attempts sa on sa.attempt_id = a.attempt_id
  ), stats as (
    select k.question_id, k.question_index, k.question_text, k.correct_label,
           count(a.attempt_id)::int as attempts,
           count(*) filter (where a.selected_label is not null and a.selected_label = k.correct_label)::int as correct_count,
           count(*) filter (where a.selected_label is not null and a.selected_label <> k.correct_label)::int as wrong_count,
           count(*) filter (where a.attempt_id is not null and a.selected_label is null)::int as skipped_count,
           jsonb_build_object(
             'A', count(*) filter (where a.selected_label = 'A'),
             'B', count(*) filter (where a.selected_label = 'B'),
             'C', count(*) filter (where a.selected_label = 'C'),
             'D', count(*) filter (where a.selected_label = 'D')
           ) as distribution
    from keys k
    left join answers a on a.question_id = k.question_id
    group by k.question_id, k.question_index, k.question_text, k.correct_label
  )
  select jsonb_build_object(
    'scope', v_scope,
    'attempts', (select count(*) from scoped_attempts),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
        'question_id', st.question_id,
        'question_index', st.question_index,
        'question_text', st.question_text,
        'correct_label', st.correct_label,
        'attempts', st.attempts,
        'correct_count', st.correct_count,
        'wrong_count', st.wrong_count,
        'skipped_count', st.skipped_count,
        'accuracy', case when st.attempts = 0 then 0
                         else round(100.0 * st.correct_count / st.attempts, 2) end,
        'distribution', st.distribution
      ) order by st.question_index) from stats st), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.analytics_question_stats(uuid, date, date, uuid, text, uuid) to authenticated;

-- 10. ATTENDANCE -------------------------------------------------------
create or replace function public.analytics_attendance(
  p_from date default null,
  p_to date default null,
  p_student_id uuid default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_require_staff(p_tenant_id);
  v_result jsonb;
  v_days integer;
begin
  v_days := greatest(1, coalesce(p_to, current_date) - coalesce(p_from, current_date - 29) + 1);

  with students as (
    select p.id, coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Siswa') as name,
           p.username, p.avatar_url, p.last_login_at
    from public.profiles p
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa' and p.analytics_excluded = false
      and (p_student_id is null or p.id = p_student_id)
  ), scoped as (
    select a.*
    from public.student_activity_sessions a
    join students s on s.id = a.user_id
    where (p_from is null or a.activity_date >= p_from)
      and (p_to is null or a.activity_date <= p_to)
  )
  select jsonb_build_object(
    'range_days', v_days,
    'total_students', (select count(*) from students),
    'active_students', (select count(distinct user_id) from scoped),
    'total_sessions', (select count(*) from scoped),
    'average_daily_active', coalesce((
      select round(avg(c), 2) from (
        select count(distinct user_id) as c from scoped group by activity_date
      ) d
    ), 0),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
        'day', d.activity_date, 'students', d.students, 'sessions', d.sessions
      ) order by d.activity_date) from (
        select activity_date, count(distinct user_id) as students, count(*) as sessions
        from scoped group by activity_date
      ) d), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', s.id,
        'display_name', s.name,
        'username', s.username,
        'avatar_url', s.avatar_url,
        'days_present', (select count(*) from scoped x where x.user_id = s.id),
        'last_seen_at', coalesce((select max(x.last_seen_at) from scoped x where x.user_id = s.id), s.last_login_at),
        'attendance_rate', round(100.0 * (select count(*) from scoped x where x.user_id = s.id) / v_days, 2)
      ) order by (select count(*) from scoped x where x.user_id = s.id) desc, s.name)
      from students s), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.analytics_attendance(date, date, uuid, uuid) to authenticated;
