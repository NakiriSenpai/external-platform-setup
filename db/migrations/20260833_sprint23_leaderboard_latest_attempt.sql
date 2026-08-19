-- =====================================================================
-- SPRINT 23 — LEADERBOARD MEMAKAI ATTEMPT SELESAI TERBARU
-- Jalankan seluruh isi file ini di Supabase SQL Editor (project eksternal).
-- Idempotent: aman dijalankan ulang. Hanya CREATE OR REPLACE FUNCTION.
--
-- MASALAH:
--   leaderboard_first_attempt_ranking memakai ATTEMPT PERTAMA
--   (order by submitted_at ASC) per (user, exam).
--
-- PERBAIKAN:
--   Per (user, exam) gunakan ATTEMPT SELESAI TERBARU:
--     order by submitted_at DESC, created_at DESC, id DESC
--   Attempt in_progress / cancelled tidak pernah punya baris di
--   exam_attempt_results, dan tetap di-guard lewat join exam_attempts.
--   BUKAN MAX(score). BUKAN attempt pertama.
--
-- Nama & signature RPC TIDAK berubah agar frontend tetap kompatibel.
-- Tidak ada ALTER TABLE / UPDATE / DELETE / perubahan RLS.
-- =====================================================================

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
  with latest_attempt as (
    -- Attempt SELESAI TERBARU per (user, exam).
    select distinct on (r.user_id, r.exam_id)
      r.user_id,
      r.exam_id,
      r.score,
      r.submitted_at
    from public.exam_attempt_results r
    join public.profiles p on p.id = r.user_id
    join public.exam_attempts a on a.id = r.attempt_id
    where
      p.tenant_id is not distinct from v_tenant
      and (r.tenant_id is null or r.tenant_id is not distinct from v_tenant)
      and p.role = 'siswa'
      and p.is_active = true
      and a.status::text not in ('in_progress', 'cancelled')
      and (p_exam_id is null or r.exam_id = p_exam_id)
    order by r.user_id, r.exam_id, r.submitted_at desc, r.created_at desc, r.id desc
  ),
  base as (
    select
      f.user_id,
      sum(f.score)::numeric as total_score,
      count(distinct f.exam_id)::bigint as exams_taken,
      max(f.submitted_at) as first_qualified_at
    from latest_attempt f
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
