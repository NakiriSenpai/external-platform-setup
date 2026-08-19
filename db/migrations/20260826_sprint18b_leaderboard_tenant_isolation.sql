-- =====================================================================
-- SPRINT 18B — LEADERBOARD TENANT ISOLATION (HARD SERVER-SIDE SCOPE)
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: Sprint 12 + Sprint 18 (20260825_sprint18_leaderboard_first_attempt.sql).
--
-- Perubahan:
--   1. Tenant leaderboard TIDAK LAGI menerima p_tenant_id dari client.
--      Tenant selalu diambil dari profil user yang terautentikasi.
--   2. First attempt di-scope pada tenant_id + user_id + exam_id.
--   3. Exam options ikut tenant-scoped & hanya menghitung hasil siswa.
--
-- TIDAK mengubah exam engine, lesson engine, schema, maupun RLS tabel.
-- =====================================================================

-- 0. Buang signature lama yang masih menerima p_tenant_id dari client.
drop function if exists public.leaderboard_first_attempt_ranking(uuid, uuid, integer, integer);
drop function if exists public.leaderboard_my_first_attempt_rank(uuid, uuid);

-- 1. Tenant scope leaderboard: HANYA dari session/profil pemanggil.
--    Berbeda dengan analytics_scope_tenant(), fungsi ini tidak punya
--    parameter apa pun sehingga tidak ada jalan bagi client (termasuk
--    owner) untuk meminta leaderboard tenant lain.
create or replace function public.leaderboard_scope_tenant()
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

  return v_tenant;
end;
$$;

grant execute on function public.leaderboard_scope_tenant() to authenticated;

create index if not exists exam_attempt_results_tenant_user_exam_idx
  on public.exam_attempt_results (tenant_id, user_id, exam_id, submitted_at asc);

-- 2. Ranking leaderboard — tenant-scoped, attempt pertama per exam.
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
    select distinct on (r.user_id, r.exam_id)
      r.user_id,
      r.exam_id,
      r.score,
      r.submitted_at
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    where p.tenant_id is not distinct from v_tenant
      -- attempt harus benar-benar milik tenant tsb (bukan hanya user_id+exam_id)
      and r.tenant_id is not distinct from v_tenant
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

-- 3. Peringkat pemanggil sendiri (tenant sama, tidak bisa dipilih client).
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

-- 4. Opsi filter exam — tenant-scoped, hanya hasil siswa tenant tsb.
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
    and r.tenant_id is not distinct from v_tenant
    and p.role = 'siswa'
    and p.is_active = true
  group by r.exam_id
  order by max(r.submitted_at) desc;
end;
$$;

grant execute on function public.leaderboard_exam_options_v2() to authenticated;
