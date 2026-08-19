-- =====================================================================
-- SPRINT 18 — LEADERBOARD FIRST-ATTEMPT SCORING
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 12 (leaderboard & analytics).
--
-- TIDAK mengubah exam engine, attempt lifecycle, scoring ujian, maupun
-- schema apa pun. Hanya menambah fungsi agregasi baru (v2) yang memakai
-- ATTEMPT PERTAMA per (user_id, exam_id).
-- Fungsi lama (leaderboard_ranking / leaderboard_my_rank) dibiarkan utuh.
-- =====================================================================

create index if not exists exam_attempt_results_user_exam_idx
  on public.exam_attempt_results (user_id, exam_id, submitted_at asc);

-- Ranking leaderboard berbasis attempt pertama.
-- p_exam_id null  -> mode "Semua": SUM(first attempt score) per exam distinct.
-- p_exam_id diisi -> mode "Per Exam": skor attempt pertama pada exam tsb.
create or replace function public.leaderboard_first_attempt_ranking(
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
  role text,
  total_score numeric,
  exams_taken bigint,
  first_qualified_at timestamptz,
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
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  with first_attempt as (
    select distinct on (r.user_id, r.exam_id)
      r.user_id,
      r.exam_id,
      r.score,
      r.submitted_at
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      and p.role = 'siswa'
      and p.is_active = true
      and (p_exam_id is null or r.exam_id = p_exam_id)
    order by r.user_id, r.exam_id, r.submitted_at asc, r.created_at asc, r.id asc
  ),
  base as (
    select
      f.user_id,
      sum(f.score)::numeric as total_score,
      count(distinct f.exam_id)::bigint as exams_taken,
      min(f.submitted_at) as first_qualified_at
    from first_attempt f
    group by f.user_id
  ),
  ranked as (
    select
      row_number() over (
        order by b.total_score desc, b.exams_taken desc, b.first_qualified_at asc, b.user_id asc
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
    pr.role::text,
    k.total_score,
    k.exams_taken,
    k.first_qualified_at,
    (k.user_id = auth.uid()) as is_current_user,
    k.total_rows
  from ranked k
  join public.profiles pr on pr.id = k.user_id
  order by k.rank
  limit v_limit offset v_offset;
end;
$$;

grant execute on function public.leaderboard_first_attempt_ranking(uuid, uuid, integer, integer)
  to authenticated;

-- Peringkat pemanggil sendiri (agar tetap terlihat di luar halaman aktif).
create or replace function public.leaderboard_my_first_attempt_rank(
  p_exam_id uuid default null,
  p_tenant_id uuid default null
)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  role text,
  total_score numeric,
  exams_taken bigint,
  first_qualified_at timestamptz,
  is_current_user boolean,
  total_rows bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.leaderboard_first_attempt_ranking(p_exam_id, p_tenant_id, 100, 0) t
  where t.is_current_user
  limit 1;
$$;

grant execute on function public.leaderboard_my_first_attempt_rank(uuid, uuid) to authenticated;
