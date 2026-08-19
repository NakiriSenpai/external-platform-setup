-- =====================================================================
-- SPRINT 18D — LEADERBOARD NULL-TENANT FIX (RESULT TENANT = GUARD SAJA)
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: Sprint 18 (20260825) + Sprint 18B (20260826).
--
-- MASALAH (root cause terbukti):
--   Sprint 18B memfilter `r.tenant_id is not distinct from v_tenant`.
--   exam_attempt_results.tenant_id mewarisi exams.tenant_id, dan exam
--   GLOBAL punya tenant_id = NULL → seluruh result exam global tersaring
--   → leaderboard kosong.
--
-- PERBAIKAN:
--   Sumber tenant isolation = profiles.tenant_id milik pemilik result
--   (selalu dari auth.uid() via leaderboard_scope_tenant(), tanpa parameter).
--   exam_attempt_results.tenant_id hanya GUARD: NULL diterima, beda tenant
--   ditolak.
--
--   p.tenant_id is not distinct from v_tenant
--   AND (r.tenant_id is null OR r.tenant_id is not distinct from v_tenant)
--
-- TIDAK ada: ALTER TABLE / UPDATE / DELETE / INSERT / ALTER ENUM /
-- perubahan RLS / perubahan schema / perubahan Exam & Lesson Engine.
-- Hanya CREATE OR REPLACE FUNCTION. Signature RPC TIDAK berubah, jadi
-- frontend tidak perlu diubah dan p_tenant_id tetap tidak ada.
-- =====================================================================

-- 1. Ranking leaderboard — tenant dari profil siswa, result tenant = guard.
--    Signature tetap: (p_exam_id uuid, p_limit integer, p_offset integer).
create or replace function public.leaderboard_first_attempt_ranking(
  p_exam_id uuid default null,
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
  v_tenant uuid := public.leaderboard_scope_tenant();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  with first_attempt as (
    -- Attempt PERTAMA per (user, exam). Ordering tidak diubah dari Sprint 18/18B.
    select distinct on (r.user_id, r.exam_id)
      r.user_id,
      r.exam_id,
      r.score,
      r.submitted_at
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where
      -- SUMBER TENANT ISOLATION: profil pemilik result.
      p.tenant_id is not distinct from v_tenant
      -- GUARD: result tanpa tenant (exam global) tetap valid;
      -- result milik tenant lain ditolak.
      and (r.tenant_id is null or r.tenant_id is not distinct from v_tenant)
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

grant execute on function public.leaderboard_first_attempt_ranking(uuid, integer, integer)
  to authenticated;

-- 2. My rank — tetap turunan dari ranking di atas (otomatis ikut perbaikan).
create or replace function public.leaderboard_my_first_attempt_rank(
  p_exam_id uuid default null
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
  from public.leaderboard_first_attempt_ranking(p_exam_id, 100, 0) t
  where t.is_current_user
  limit 1;
$$;

grant execute on function public.leaderboard_my_first_attempt_rank(uuid) to authenticated;

-- 3. Opsi filter exam — aturan tenant yang sama, exam global tidak hilang.
create or replace function public.leaderboard_exam_options_v2()
returns table (exam_id uuid, exam_title text, result_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.leaderboard_scope_tenant();
begin
  return query
  select r.exam_id, max(r.exam_title) as exam_title, count(*)::bigint
  from public.exam_attempt_results r
  join public.profiles p on p.id = r.user_id
  where p.tenant_id is not distinct from v_tenant
    and (r.tenant_id is null or r.tenant_id is not distinct from v_tenant)
    and p.role = 'siswa'
    and p.is_active = true
  group by r.exam_id
  order by max(r.submitted_at) desc;
end;
$$;

grant execute on function public.leaderboard_exam_options_v2() to authenticated;
