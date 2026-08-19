-- =====================================================================
-- SPRINT 17 — LESSON PROGRESS FIX (ALL ROLES + ANALYTICS SISWA ONLY)
-- Jalankan seluruh isi file ini di Supabase SQL Editor.
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: 20260819_sprint16_student_lesson_progress.sql
--
-- PERUBAHAN:
-- 1. Semua role (owner/admin/guru/siswa) kini memiliki personal lesson
--    progress. Sebelumnya RPC mengembalikan NULL untuk staf sehingga
--    lesson viewer gagal menyimpan progress (sumber toast berulang).
-- 2. Teacher Analytics HANYA menghitung progress profiles.role = 'siswa'.
-- 3. Tenant isolation tetap: tenant_id diambil dari profil terautentikasi.
-- =====================================================================

-- 1. CORE WRITER: semua role menghasilkan progress -------------------
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

  select * into v_lesson from public.lessons where id = p_lesson_id;
  if v_lesson.id is null
     or v_lesson.status <> 'published'
     or (
       v_lesson.tenant_id is not null
       and v_role <> 'owner'
       and v_lesson.tenant_id is distinct from v_tenant
     ) then
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

-- 2. ANALYTICS: hanya role siswa --------------------------------------
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
  join public.profiles p on p.id = lp.user_id and p.role = 'siswa'
  where lp.tenant_id is not distinct from v_tenant
    and lp.last_activity_at >= v_since;

  return v_result;
end;
$$;

grant execute on function public.teacher_lesson_overview(text, uuid) to authenticated;

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
  join public.profiles p on p.id = lp.user_id and p.role = 'siswa'
  where lp.tenant_id is not distinct from v_tenant
    and lp.last_activity_at >= v_since
    and (p_student_id is null or lp.user_id = p_student_id)
  group by l.id, l.title, l.category
  order by count(lp.id) desc, max(lp.last_activity_at) desc nulls last
  limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

grant execute on function public.teacher_lesson_analytics(text, uuid, uuid, integer) to authenticated;

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
  join public.profiles p on p.id = lp.user_id and p.role = 'siswa'
  where lp.user_id = p_student_id
    and lp.tenant_id is not distinct from v_tenant
    and lp.last_activity_at >= v_since
  order by lp.last_activity_at desc
  limit greatest(coalesce(p_limit, 20), 1);
end;
$$;

grant execute on function public.teacher_student_lesson_progress(uuid, text, uuid, integer) to authenticated;

-- 3. RINGKASAN PROGRESS PRIBADI (semua role, milik sendiri) -----------
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
