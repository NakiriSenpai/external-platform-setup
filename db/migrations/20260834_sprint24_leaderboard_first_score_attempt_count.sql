-- =====================================================================
-- SPRINT 24 — LEADERBOARD: COMPLETED ATTEMPT COUNT + FIRST SCORE
-- Jalankan seluruh isi file ini di SQL Editor project eksternal.
-- Prasyarat: Sprint 23 (20260833) sudah pernah dijalankan.
--
-- KONTRAK:
--   attempt_count       = jumlah SEMUA attempt selesai per user pada scope
--                         ujian yang dipilih (in_progress/cancelled tidak masuk).
--   first_attempt_score = mode Per Exam: skor attempt selesai pertama;
--                         mode Semua: SUM skor attempt selesai pertama per exam.
--
-- Tidak ada UPDATE/DELETE data. Seluruh historical attempt tetap utuh.
-- Nama dan parameter RPC tetap agar call site tetap stabil. Return columns
-- dipisahkan secara eksplisit, sehingga fungsi perlu di-drop lalu dibuat ulang.
-- =====================================================================

drop function if exists public.leaderboard_my_first_attempt_rank(uuid);
drop function if exists public.leaderboard_first_attempt_ranking(uuid, integer, integer);

create function public.leaderboard_first_attempt_ranking(
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
  attempt_count bigint,
  first_attempt_score numeric,
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
  with completed_attempts as (
    select
      r.id,
      r.user_id,
      r.exam_id,
      r.score,
      r.submitted_at,
      r.created_at
    from public.exam_attempt_results r
    join public.exam_attempts a on a.id = r.attempt_id
    join public.profiles p on p.id = r.user_id
    where
      p.tenant_id is not distinct from v_tenant
      and (r.tenant_id is null or r.tenant_id is not distinct from v_tenant)
      and p.role = 'siswa'
      and p.is_active = true
      and a.status::text in ('submitted', 'expired')
      and (p_exam_id is null or r.exam_id = p_exam_id)
  ),
  per_exam as (
    select
      c.user_id,
      c.exam_id,
      count(*)::bigint as attempt_count,
      (array_agg(
        c.score order by c.submitted_at asc, c.created_at asc, c.id asc
      ))[1]::numeric as first_attempt_score,
      min(c.submitted_at) as first_qualified_at
    from completed_attempts c
    group by c.user_id, c.exam_id
  ),
  base as (
    select
      e.user_id,
      sum(e.attempt_count)::bigint as attempt_count,
      sum(e.first_attempt_score)::numeric as first_attempt_score,
      min(e.first_qualified_at) as first_qualified_at
    from per_exam e
    group by e.user_id
  ),
  ranked as (
    select
      row_number() over (
        order by
          b.first_attempt_score desc,
          b.attempt_count desc,
          b.first_qualified_at asc,
          b.user_id asc
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
    k.attempt_count,
    k.first_attempt_score,
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

create function public.leaderboard_my_first_attempt_rank(
  p_exam_id uuid default null
)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  role text,
  attempt_count bigint,
  first_attempt_score numeric,
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

-- Verifikasi production setelah migration:
-- select r.user_id, r.exam_id, count(*) as attempt_count,
--   (array_agg(r.score order by r.submitted_at, r.created_at, r.id))[1] as first_attempt_score
-- from public.exam_attempt_results r
-- join public.exam_attempts a on a.id = r.attempt_id
-- where left(r.exam_id::text, 8) = 'ca8a543a'
--   and a.status::text in ('submitted', 'expired')
-- group by r.user_id, r.exam_id;