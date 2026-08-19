-- =====================================================================
-- SPRINT 12 — LEADERBOARD & TEACHER ANALYTICS
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, 4, 6, 7, 8, 9, 10A, 10B, 11.4.
--
-- ARSITEKTUR:
-- Sprint ini TIDAK mengubah exam engine, snapshot, scoring, maupun attempt
-- lifecycle. Seluruh angka dibaca dari data yang SUDAH tersimpan
-- (exam_attempt_results, exam_attempt_answers, exam_attempt_snapshots).
-- Agregasi dilakukan di database (SECURITY DEFINER + tenant scoping),
-- bukan di browser.
-- =====================================================================

-- 0. INDEX PENDUKUNG ---------------------------------------------------
create index if not exists exam_attempt_results_tenant_idx
  on public.exam_attempt_results (tenant_id, submitted_at desc);
create index if not exists exam_attempt_results_exam_submitted_idx
  on public.exam_attempt_results (exam_id, submitted_at desc);
create index if not exists exam_attempt_answers_question_idx
  on public.exam_attempt_answers (question_id);

-- 1. SCOPE HELPER ------------------------------------------------------
-- Menentukan tenant yang boleh dibaca pemanggil.
-- owner  : bebas memilih tenant (p_tenant_id), default tenant profilnya.
-- lainnya: selalu tenant pada profilnya sendiri (p_tenant_id diabaikan).
create or replace function public.analytics_scope_tenant(p_tenant_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_tenant uuid;
begin
  select role, tenant_id into v_role, v_tenant
  from public.profiles
  where id = auth.uid() and is_active = true;

  if v_role is null then
    raise exception 'Sesi tidak valid.';
  end if;

  if v_role = 'owner' then
    return coalesce(p_tenant_id, v_tenant);
  end if;

  return v_tenant;
end;
$$;

grant execute on function public.analytics_scope_tenant(uuid) to authenticated;

-- Guard analytics pengajar: siswa tidak boleh mengakses.
create or replace function public.analytics_require_staff(p_tenant_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active = true;
  if v_role is null or v_role = 'siswa' then
    raise exception 'Anda tidak memiliki akses ke analitik pengajar.';
  end if;
  return public.analytics_scope_tenant(p_tenant_id);
end;
$$;

grant execute on function public.analytics_require_staff(uuid) to authenticated;

create or replace function public.analytics_since(p_range text)
returns timestamptz
language sql
immutable
as $$
  select case lower(coalesce(p_range, 'all'))
    when 'week' then date_trunc('week', now())
    when 'month' then date_trunc('month', now())
    when '7' then now() - interval '7 days'
    when '30' then now() - interval '30 days'
    when '90' then now() - interval '90 days'
    else '-infinity'::timestamptz
  end;
$$;

grant execute on function public.analytics_since(text) to authenticated;

-- 2. LEADERBOARD -------------------------------------------------------
create or replace function public.leaderboard_ranking(
  p_range text default 'all',
  p_exam_id uuid default null,
  p_tenant_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  average_score numeric,
  exams_completed bigint,
  last_submitted_at timestamptz,
  is_current_user boolean,
  total_rows bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_scope_tenant(p_tenant_id);
  v_since timestamptz := public.analytics_since(p_range);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  with base as (
    select
      r.user_id,
      round(avg(r.score), 2) as average_score,
      count(*)::bigint as exams_completed,
      max(r.submitted_at) as last_submitted_at
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and p.is_active = true
      and r.submitted_at >= v_since
      and (p_exam_id is null or r.exam_id = p_exam_id)
    group by r.user_id
  ),
  ranked as (
    select
      row_number() over (
        order by b.average_score desc, b.exams_completed desc, b.last_submitted_at desc
      ) as rank,
      b.*,
      count(*) over () as total_rows
    from base b
  )
  select
    k.rank,
    k.user_id,
    coalesce(nullif(pr.display_name, ''), nullif(pr.full_name, ''), 'Siswa') as display_name,
    pr.username,
    pr.avatar_url,
    k.average_score,
    k.exams_completed,
    k.last_submitted_at,
    (k.user_id = auth.uid()) as is_current_user,
    k.total_rows
  from ranked k
  join public.profiles pr on pr.id = k.user_id
  order by k.rank
  limit v_limit offset v_offset;
end;
$$;

grant execute on function public.leaderboard_ranking(text, uuid, uuid, integer, integer)
  to authenticated;

-- Peringkat pemanggil sendiri (agar selalu terlihat walau di luar halaman).
create or replace function public.leaderboard_my_rank(
  p_range text default 'all',
  p_exam_id uuid default null,
  p_tenant_id uuid default null
)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  average_score numeric,
  exams_completed bigint,
  last_submitted_at timestamptz,
  is_current_user boolean,
  total_rows bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.leaderboard_ranking(p_range, p_exam_id, p_tenant_id, 100, 0) t
  where t.is_current_user
  limit 1;
$$;

grant execute on function public.leaderboard_my_rank(text, uuid, uuid) to authenticated;

-- Daftar exam yang punya hasil pada tenant (untuk filter leaderboard).
create or replace function public.leaderboard_exam_options(p_tenant_id uuid default null)
returns table (exam_id uuid, exam_title text, result_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.analytics_scope_tenant(p_tenant_id);
begin
  return query
  select r.exam_id, max(r.exam_title) as exam_title, count(*)::bigint
  from public.exam_attempt_results r
  join public.profiles p on p.id = r.user_id
  where p.tenant_id is not distinct from v_tenant
  group by r.exam_id
  order by max(r.submitted_at) desc;
end;
$$;

grant execute on function public.leaderboard_exam_options(uuid) to authenticated;

-- 3. TEACHER ANALYTICS — OVERVIEW -------------------------------------
create or replace function public.teacher_analytics_overview(
  p_range text default 'all',
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
  v_since timestamptz := public.analytics_since(p_range);
  v_total_students integer := 0;
  v_active_students integer := 0;
  v_result jsonb;
begin
  select count(*) into v_total_students
  from public.profiles
  where tenant_id is not distinct from v_tenant and role = 'siswa' and is_active = true;

  with scoped as (
    select r.*
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and r.submitted_at >= v_since
      and (p_exam_id is null or r.exam_id = p_exam_id)
      and (p_student_id is null or r.user_id = p_student_id)
  )
  select
    count(distinct s.user_id)::int,
    jsonb_build_object(
      'total_attempts', count(*),
      'average_score', coalesce(round(avg(s.score), 2), 0),
      'pass_rate', case when count(*) = 0 then 0
                        else round(100.0 * count(*) filter (where s.passed) / count(*), 2) end,
      'average_duration_seconds', coalesce(round(avg(s.duration_seconds))::int, 0)
    )
  into v_active_students, v_result
  from scoped s;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'total_students', v_total_students,
    'active_students', coalesce(v_active_students, 0)
  );
end;
$$;

grant execute on function public.teacher_analytics_overview(text, uuid, uuid, uuid)
  to authenticated;

-- 4. TEACHER ANALYTICS — PER EXAM -------------------------------------
create or replace function public.teacher_exam_analytics(
  p_range text default 'all',
  p_student_id uuid default null,
  p_tenant_id uuid default null,
  p_limit integer default 50
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
  v_since timestamptz := public.analytics_since(p_range);
begin
  return query
  select
    r.exam_id,
    max(r.exam_title) as exam_title,
    count(*)::bigint as attempts,
    count(distinct r.user_id)::bigint as students,
    round(avg(r.score), 2) as average_score,
    round(100.0 * count(*) filter (where r.passed) / nullif(count(*), 0), 2) as pass_rate,
    max(r.submitted_at) as last_submitted_at
  from public.exam_attempt_results r
  join public.profiles p on p.id = r.user_id
  where p.tenant_id is not distinct from v_tenant
    and p.role = 'siswa'
    and r.submitted_at >= v_since
    and (p_student_id is null or r.user_id = p_student_id)
  group by r.exam_id
  order by count(*) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

grant execute on function public.teacher_exam_analytics(text, uuid, uuid, integer)
  to authenticated;

-- 5. TEACHER ANALYTICS — PER SISWA ------------------------------------
create or replace function public.teacher_student_analytics(
  p_range text default 'all',
  p_exam_id uuid default null,
  p_search text default null,
  p_tenant_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  attempts bigint,
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
  v_since timestamptz := public.analytics_since(p_range);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  return query
  with students as (
    select p.id, p.display_name, p.full_name, p.username, p.avatar_url
    from public.profiles p
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and p.is_active = true
      and (
        v_search is null
        or p.display_name ilike '%' || v_search || '%'
        or p.full_name ilike '%' || v_search || '%'
        or p.username ilike '%' || v_search || '%'
      )
  ),
  stats as (
    select
      s.id,
      count(r.id)::bigint as attempts,
      round(avg(r.score), 2) as average_score,
      round(100.0 * count(*) filter (where r.passed) / nullif(count(r.id), 0), 2) as pass_rate,
      max(r.submitted_at) as last_submitted_at
    from students s
    left join public.exam_attempt_results r
      on r.user_id = s.id
     and r.submitted_at >= v_since
     and (p_exam_id is null or r.exam_id = p_exam_id)
    group by s.id
  )
  select
    s.id,
    coalesce(nullif(s.display_name, ''), nullif(s.full_name, ''), 'Siswa'),
    s.username,
    s.avatar_url,
    coalesce(st.attempts, 0),
    coalesce(st.average_score, 0),
    coalesce(st.pass_rate, 0),
    st.last_submitted_at,
    count(*) over ()
  from students s
  join stats st on st.id = s.id
  order by coalesce(st.attempts, 0) desc, coalesce(st.average_score, 0) desc
  limit v_limit offset v_offset;
end;
$$;

grant execute on function public.teacher_student_analytics(text, uuid, text, uuid, integer, integer)
  to authenticated;

-- 6. DETAIL SISWA ------------------------------------------------------
create or replace function public.teacher_student_detail(
  p_student_id uuid,
  p_range text default 'all',
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
  v_since timestamptz := public.analytics_since(p_range);
  v_profile jsonb;
  v_summary jsonb;
  v_recent jsonb;
  v_exams jsonb;
begin
  select jsonb_build_object(
    'user_id', p.id,
    'display_name', coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Siswa'),
    'username', p.username,
    'avatar_url', p.avatar_url
  )
  into v_profile
  from public.profiles p
  where p.id = p_student_id
    and p.tenant_id is not distinct from v_tenant
    and p.role = 'siswa';

  if v_profile is null then
    raise exception 'Siswa tidak ditemukan pada lembaga ini.';
  end if;

  select jsonb_build_object(
    'total_attempts', count(*),
    'average_score', coalesce(round(avg(r.score), 2), 0),
    'pass_rate', case when count(*) = 0 then 0
                      else round(100.0 * count(*) filter (where r.passed) / count(*), 2) end,
    'average_duration_seconds', coalesce(round(avg(r.duration_seconds))::int, 0),
    'last_submitted_at', max(r.submitted_at)
  )
  into v_summary
  from public.exam_attempt_results r
  where r.user_id = p_student_id and r.submitted_at >= v_since;

  select coalesce(jsonb_agg(t order by t.submitted_at desc), '[]'::jsonb)
  into v_recent
  from (
    select
      r.attempt_id, r.exam_id, r.exam_title, r.score, r.passed,
      r.correct_count, r.wrong_count, r.skipped_count,
      r.total_questions, r.duration_seconds, r.submitted_at
    from public.exam_attempt_results r
    where r.user_id = p_student_id and r.submitted_at >= v_since
    order by r.submitted_at desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(e order by e.attempts desc), '[]'::jsonb)
  into v_exams
  from (
    select
      r.exam_id,
      max(r.exam_title) as exam_title,
      count(*)::int as attempts,
      round(avg(r.score), 2) as average_score,
      round(100.0 * count(*) filter (where r.passed) / count(*), 2) as pass_rate,
      max(r.submitted_at) as last_submitted_at
    from public.exam_attempt_results r
    where r.user_id = p_student_id and r.submitted_at >= v_since
    group by r.exam_id
  ) e;

  return jsonb_build_object(
    'profile', v_profile,
    'summary', coalesce(v_summary, '{}'::jsonb),
    'recent_attempts', v_recent,
    'exam_performance', v_exams
  );
end;
$$;

grant execute on function public.teacher_student_detail(uuid, text, uuid) to authenticated;

-- 7. DETAIL EXAM + QUESTION / GRAMMAR PERFORMANCE ----------------------
create or replace function public.teacher_exam_detail(
  p_exam_id uuid,
  p_range text default 'all',
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
  v_since timestamptz := public.analytics_since(p_range);
  v_summary jsonb;
  v_questions jsonb;
  v_grammar jsonb;
begin
  select jsonb_build_object(
    'exam_id', p_exam_id,
    'exam_title', coalesce(max(r.exam_title), ''),
    'attempts', count(*),
    'students', count(distinct r.user_id),
    'average_score', coalesce(round(avg(r.score), 2), 0),
    'pass_rate', case when count(*) = 0 then 0
                      else round(100.0 * count(*) filter (where r.passed) / count(*), 2) end,
    'average_duration_seconds', coalesce(round(avg(r.duration_seconds))::int, 0)
  )
  into v_summary
  from public.exam_attempt_results r
  join public.profiles p on p.id = r.user_id
  where r.exam_id = p_exam_id
    and p.tenant_id is not distinct from v_tenant
    and p.role = 'siswa'
    and r.submitted_at >= v_since
    and (p_student_id is null or r.user_id = p_student_id);

  with scoped as (
    select
      (item ->> 'question_id')::uuid as question_id,
      coalesce((item ->> 'index')::int, 0) as question_index,
      coalesce(item ->> 'text', '') as question_text,
      l.title as lesson_title,
      coalesce(item -> 'grammar_tags', '[]'::jsonb) as grammar_tags,
      (ans.selected_label is not null and ans.selected_label = item ->> 'correct_label') as is_correct,
      (ans.selected_label is not null) as answered
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    join public.exam_attempt_snapshots s on s.attempt_id = r.attempt_id
    cross join lateral jsonb_array_elements(s.payload -> 'questions') as item
    left join public.exam_attempt_answers ans
      on ans.attempt_id = r.attempt_id
     and ans.question_id = (item ->> 'question_id')::uuid
    left join public.lessons l on l.id = nullif(item ->> 'lesson_id', '')::uuid
    where r.exam_id = p_exam_id
      and p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and r.submitted_at >= v_since
      and (p_student_id is null or r.user_id = p_student_id)
  ),
  per_question as (
    select
      t.question_id,
      min(t.question_index) as question_index,
      max(t.question_text) as question_text,
      max(t.lesson_title) as lesson_title,
      (array_agg(t.grammar_tags))[1] as grammar_tags,
      count(*)::int as attempts,
      count(*) filter (where t.is_correct)::int as correct_count,
      count(*) filter (where t.answered and not t.is_correct)::int as wrong_count,
      count(*) filter (where not t.answered)::int as skipped_count,
      round(100.0 * count(*) filter (where t.is_correct) / count(*), 2) as accuracy
    from scoped t
    group by t.question_id
  ),
  per_grammar as (
    select
      tag ->> 'id' as tag_id,
      max(tag ->> 'name') as tag_name,
      count(*)::int as attempts,
      count(*) filter (where t.is_correct)::int as correct_count,
      round(100.0 * count(*) filter (where t.is_correct) / count(*), 2) as accuracy
    from scoped t
    cross join lateral jsonb_array_elements(t.grammar_tags) as tag
    group by tag ->> 'id'
  )
  select
    coalesce((select jsonb_agg(q order by q.question_index) from per_question q), '[]'::jsonb),
    coalesce((select jsonb_agg(g order by g.accuracy) from per_grammar g), '[]'::jsonb)
  into v_questions, v_grammar;


  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'questions', v_questions,
    'grammar', v_grammar
  );
end;
$$;

grant execute on function public.teacher_exam_detail(uuid, text, uuid, uuid) to authenticated;
