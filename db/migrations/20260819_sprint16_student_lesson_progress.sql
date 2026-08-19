-- =====================================================================
-- SPRINT 16 — STUDENT LESSON PROGRESS
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, 4, 6, 7, 8, 9, 10A, 10B, 11.4, 12.
--
-- ARSITEKTUR:
-- - TIDAK mengubah Exam Engine, Exam Result, maupun Leaderboard.
-- - TIDAK menduplikasi tabel lesson/section/block yang sudah ada.
-- - Progress ditulis HANYA melalui SECURITY DEFINER RPC. Client tidak
--   pernah mengirim progress_percent / status / completed_at.
-- - Unit wajib (required unit) = seluruh lesson_blocks non-divider.
--   Soal latihan lesson TIDAK wajib untuk completion.
-- =====================================================================

-- 1. ENUM --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lesson_progress_status') then
    create type public.lesson_progress_status as enum ('not_started', 'in_progress', 'completed');
  end if;
end$$;

-- 2. TABEL -------------------------------------------------------------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status public.lesson_progress_status not null default 'in_progress',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  completed_units text[] not null default '{}',
  total_units integer not null default 0,
  current_block_id uuid references public.lesson_blocks (id) on delete set null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_progress_user_lesson_key unique (user_id, lesson_id)
);

-- 3. INDEX -------------------------------------------------------------
create index if not exists lesson_progress_user_idx
  on public.lesson_progress (user_id, last_activity_at desc);
create index if not exists lesson_progress_lesson_idx
  on public.lesson_progress (lesson_id, status);
create index if not exists lesson_progress_tenant_idx
  on public.lesson_progress (tenant_id, last_activity_at desc);

-- 4. TRIGGER -----------------------------------------------------------
drop trigger if exists lesson_progress_touch_updated_at on public.lesson_progress;
create trigger lesson_progress_touch_updated_at before update on public.lesson_progress
  for each row execute function public.touch_updated_at();

-- 5. GRANTS ------------------------------------------------------------
grant select on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;

-- 6. RLS ---------------------------------------------------------------
-- Tidak ada policy INSERT/UPDATE/DELETE: penulisan hanya via RPC definer.
alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
create policy "lesson_progress_select_own" on public.lesson_progress for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "lesson_progress_select_staff" on public.lesson_progress;
create policy "lesson_progress_select_staff" on public.lesson_progress for select to authenticated
  using (
    public.is_owner()
    or (
      tenant_id is not distinct from public.current_tenant_id()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_active = true and p.role in ('admin', 'guru')
      )
    )
  );

-- 7. UNIT WAJIB --------------------------------------------------------
-- Unit wajib = block non-divider, diurutkan sesuai urutan tampilan.
create or replace function public.lesson_required_units(p_lesson_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg('block:' || b.id::text order by s.order_index, b.order_index),
    '{}'::text[]
  )
  from public.lesson_sections s
  join public.lesson_blocks b on b.section_id = s.id
  where s.lesson_id = p_lesson_id
    and b.type <> 'divider';
$$;

grant execute on function public.lesson_required_units(uuid) to authenticated;

-- 8. CORE WRITER -------------------------------------------------------
-- Satu-satunya jalur penulisan progress. Hanya role 'siswa' menghasilkan
-- baris progress; owner/admin/guru mengembalikan NULL (boleh membaca materi).
create or replace function public.lesson_progress_touch(
  p_lesson_id uuid,
  p_units text[] default '{}',
  p_current_block_id uuid default null,
  p_complete boolean default false
)
returns public.lesson_progress
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_tenant uuid;
  v_lesson public.lessons%rowtype;
  v_required text[];
  v_merged text[];
  v_total integer;
  v_done integer;
  v_percent integer;
  v_was_completed boolean;
  v_row public.lesson_progress;
begin
  select role, tenant_id into v_role, v_tenant
  from public.profiles
  where id = auth.uid() and is_active = true;

  if v_role is null then
    raise exception 'Sesi tidak valid.';
  end if;

  -- Staf boleh membaca materi tanpa menghasilkan progress siswa.
  if v_role <> 'siswa' then
    return null;
  end if;

  select * into v_lesson from public.lessons where id = p_lesson_id;
  if v_lesson.id is null
     or v_lesson.status <> 'published'
     or (v_lesson.tenant_id is not null and v_lesson.tenant_id is distinct from v_tenant) then
    raise exception 'Materi tidak tersedia.';
  end if;

  insert into public.lesson_progress (user_id, tenant_id, lesson_id, status, started_at, last_activity_at)
  values (auth.uid(), v_tenant, p_lesson_id, 'in_progress', now(), now())
  on conflict (user_id, lesson_id) do nothing;

  select * into v_row
  from public.lesson_progress
  where user_id = auth.uid() and lesson_id = p_lesson_id
  for update;

  v_was_completed := (v_row.status = 'completed');
  v_required := public.lesson_required_units(p_lesson_id);
  v_total := coalesce(array_length(v_required, 1), 0);

  select coalesce(array_agg(distinct u), '{}'::text[]) into v_merged
  from unnest(coalesce(v_row.completed_units, '{}'::text[]) || coalesce(p_units, '{}'::text[])) u
  where u is not null and u <> '';

  if p_complete then
    select coalesce(array_agg(distinct u), '{}'::text[]) into v_merged
    from unnest(v_merged || v_required) u;
  end if;

  select count(*) into v_done from unnest(v_required) r where r = any (v_merged);

  if v_total = 0 then
    v_percent := case when p_complete or v_was_completed then 100 else 0 end;
  else
    v_percent := least(100, round(v_done::numeric * 100 / v_total)::integer);
  end if;

  -- Progress tidak pernah mundur ketika Owner mengedit konten lesson.
  if v_was_completed then
    v_percent := 100;
  end if;

  update public.lesson_progress set
    completed_units = v_merged,
    total_units = v_total,
    progress_percent = v_percent,
    current_block_id = coalesce(p_current_block_id, current_block_id),
    status = case
      when v_was_completed or p_complete or (v_total > 0 and v_done >= v_total) then 'completed'
      else 'in_progress'
    end,
    completed_at = case
      when v_was_completed then completed_at
      when p_complete or (v_total > 0 and v_done >= v_total) then now()
      else completed_at
    end,
    last_activity_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.lesson_progress_touch(uuid, text[], uuid, boolean) to authenticated;

-- 9. RPC PUBLIK --------------------------------------------------------
create or replace function public.lesson_progress_start(p_lesson_id uuid)
returns public.lesson_progress
language sql
volatile
security definer
set search_path = public
as $$
  select public.lesson_progress_touch(p_lesson_id, '{}'::text[], null, false);
$$;

create or replace function public.lesson_progress_mark(
  p_lesson_id uuid,
  p_units text[] default '{}',
  p_current_block_id uuid default null
)
returns public.lesson_progress
language sql
volatile
security definer
set search_path = public
as $$
  select public.lesson_progress_touch(p_lesson_id, p_units, p_current_block_id, false);
$$;

create or replace function public.lesson_progress_complete(p_lesson_id uuid)
returns public.lesson_progress
language sql
volatile
security definer
set search_path = public
as $$
  select public.lesson_progress_touch(p_lesson_id, '{}'::text[], null, true);
$$;

grant execute on function public.lesson_progress_start(uuid) to authenticated;
grant execute on function public.lesson_progress_mark(uuid, text[], uuid) to authenticated;
grant execute on function public.lesson_progress_complete(uuid) to authenticated;

-- 10. ANALYTICS: OVERVIEW LESSON --------------------------------------
-- Definisi metric:
--   started        = jumlah baris progress (siswa yang pernah membuka lesson)
--   in_progress    = started yang belum completed
--   completed      = status completed
--   completion_rate= completed / started (BUKAN completed / total siswa)
--   average_progress = rata-rata progress_percent seluruh baris progress
create or replace function public.teacher_lesson_overview(
  p_range text default '30',
  p_tenant_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_since timestamptz;
  v_result json;
begin
  v_tenant := public.analytics_require_staff(p_tenant_id);
  v_since := public.analytics_since(p_range);

  select json_build_object(
    'total_lessons', (
      select count(*) from public.lessons l
      where l.status = 'published'
        and (l.tenant_id is null or l.tenant_id is not distinct from v_tenant)
    ),
    'started', count(*),
    'in_progress', count(*) filter (where lp.status <> 'completed'),
    'completed', count(*) filter (where lp.status = 'completed'),
    'active_learners', count(distinct lp.user_id),
    'completion_rate', case when count(*) = 0 then 0
      else round(count(*) filter (where lp.status = 'completed')::numeric * 100 / count(*), 1) end,
    'average_progress', coalesce(round(avg(lp.progress_percent)::numeric, 1), 0)
  )
  into v_result
  from public.lesson_progress lp
  where lp.tenant_id is not distinct from v_tenant
    and lp.last_activity_at >= v_since;

  return v_result;
end;
$$;

grant execute on function public.teacher_lesson_overview(text, uuid) to authenticated;

-- 11. ANALYTICS: PER LESSON -------------------------------------------
create or replace function public.teacher_lesson_analytics(
  p_range text default '30',
  p_tenant_id uuid default null,
  p_student_id uuid default null,
  p_limit integer default 50
)
returns table (
  lesson_id uuid,
  lesson_title text,
  category text,
  started bigint,
  in_progress bigint,
  completed bigint,
  completion_rate numeric,
  average_progress numeric,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_since timestamptz;
begin
  v_tenant := public.analytics_require_staff(p_tenant_id);
  v_since := public.analytics_since(p_range);

  return query
  select
    l.id,
    l.title,
    l.category,
    count(lp.id),
    count(lp.id) filter (where lp.status <> 'completed'),
    count(lp.id) filter (where lp.status = 'completed'),
    case when count(lp.id) = 0 then 0::numeric
      else round(count(lp.id) filter (where lp.status = 'completed')::numeric * 100 / count(lp.id), 1) end,
    coalesce(round(avg(lp.progress_percent)::numeric, 1), 0),
    max(lp.last_activity_at)
  from public.lessons l
  join public.lesson_progress lp on lp.lesson_id = l.id
  where lp.tenant_id is not distinct from v_tenant
    and lp.last_activity_at >= v_since
    and (p_student_id is null or lp.user_id = p_student_id)
  group by l.id, l.title, l.category
  order by count(lp.id) desc, max(lp.last_activity_at) desc nulls last
  limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

grant execute on function public.teacher_lesson_analytics(text, uuid, uuid, integer) to authenticated;

-- 12. ANALYTICS: PROGRESS MATERI PER SISWA ----------------------------
create or replace function public.teacher_student_lesson_progress(
  p_student_id uuid,
  p_range text default '30',
  p_tenant_id uuid default null,
  p_limit integer default 20
)
returns table (
  lesson_id uuid,
  lesson_title text,
  category text,
  status public.lesson_progress_status,
  progress_percent integer,
  last_activity_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_since timestamptz;
begin
  v_tenant := public.analytics_require_staff(p_tenant_id);
  v_since := public.analytics_since(p_range);

  return query
  select l.id, l.title, l.category, lp.status, lp.progress_percent, lp.last_activity_at, lp.completed_at
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  where lp.user_id = p_student_id
    and lp.tenant_id is not distinct from v_tenant
    and lp.last_activity_at >= v_since
  order by lp.last_activity_at desc
  limit greatest(coalesce(p_limit, 20), 1);
end;
$$;

grant execute on function public.teacher_student_lesson_progress(uuid, text, uuid, integer) to authenticated;

-- 13. RINGKASAN PROGRESS SISWA (untuk dirinya sendiri) -----------------
create or replace function public.student_lesson_category_progress()
returns table (
  category text,
  lessons_started bigint,
  lessons_completed bigint,
  average_progress numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.category,
    count(lp.id),
    count(lp.id) filter (where lp.status = 'completed'),
    coalesce(round(avg(lp.progress_percent)::numeric, 1), 0)
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  where lp.user_id = auth.uid()
  group by l.category
  order by l.category;
$$;

grant execute on function public.student_lesson_category_progress() to authenticated;
