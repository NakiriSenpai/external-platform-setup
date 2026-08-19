-- =====================================================================
-- SPRINT 17 — LESSON PROGRESS ROOT CAUSE FIX
-- Prasyarat: 20260821_sprint17_lesson_progress_fix.sql
-- Idempotent: aman dijalankan ulang.
-- =====================================================================

-- Progress personal hanya boleh dibaca pemiliknya. Analitik staf sudah
-- melalui RPC SECURITY DEFINER yang memvalidasi role dan tenant.
drop policy if exists "lesson_progress_select_staff" on public.lesson_progress;
drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
create policy "lesson_progress_select_own"
on public.lesson_progress for select to authenticated
using (
  user_id = auth.uid()
  and tenant_id is not distinct from public.current_tenant_id()
);

-- Satu writer idempoten untuk first-open, autosave, dan completion.
-- user_id dan tenant_id selalu berasal dari sesi/profil, bukan payload client.
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
  v_user uuid := auth.uid();
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
  if v_user is null then
    raise exception using errcode = '28000', message = 'Sesi tidak valid.';
  end if;

  select role, tenant_id into v_role, v_tenant
  from public.profiles
  where id = v_user and is_active = true;

  if v_role is null then
    raise exception using errcode = '28000', message = 'Profil aktif tidak ditemukan.';
  end if;

  select * into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if v_lesson.id is null
     or v_lesson.status <> 'published'
     or (
       v_lesson.tenant_id is not null
       and v_role <> 'owner'
       and v_lesson.tenant_id is distinct from v_tenant
     ) then
    raise exception using errcode = '42501', message = 'Materi tidak tersedia untuk tenant ini.';
  end if;

  if p_current_block_id is not null and not exists (
    select 1
    from public.lesson_blocks b
    join public.lesson_sections s on s.id = b.section_id
    where b.id = p_current_block_id and s.lesson_id = p_lesson_id
  ) then
    raise exception using errcode = '22023', message = 'Posisi materi tidak valid.';
  end if;

  insert into public.lesson_progress (
    user_id, tenant_id, lesson_id, status, started_at, last_activity_at
  ) values (
    v_user, v_tenant, p_lesson_id, 'in_progress', now(), now()
  )
  on conflict (user_id, lesson_id) do update set
    tenant_id = excluded.tenant_id,
    last_activity_at = excluded.last_activity_at
  returning * into v_row;

  -- Lock ulang baris canonical setelah UPSERT agar mark paralel ter-serialize.
  select * into v_row
  from public.lesson_progress
  where user_id = v_user
    and tenant_id is not distinct from v_tenant
    and lesson_id = p_lesson_id
  for update;

  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'Progress materi gagal dibuat.';
  end if;

  v_was_completed := v_row.status = 'completed';
  v_required := public.lesson_required_units(p_lesson_id);
  v_total := coalesce(array_length(v_required, 1), 0);

  select coalesce(array_agg(distinct u), '{}'::text[]) into v_merged
  from unnest(coalesce(v_row.completed_units, '{}'::text[]) || coalesce(p_units, '{}'::text[])) u
  where u is not null and u <> '';

  if p_complete then
    select coalesce(array_agg(distinct u), '{}'::text[]) into v_merged
    from unnest(v_merged || v_required) u;
  end if;

  select count(*) into v_done
  from unnest(v_required) r
  where r = any (v_merged);

  if v_was_completed or p_complete then
    v_percent := 100;
  elsif v_total = 0 then
    v_percent := 0;
  else
    v_percent := least(100, round(v_done::numeric * 100 / v_total)::integer);
  end if;

  update public.lesson_progress set
    tenant_id = v_tenant,
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
      else null
    end,
    last_activity_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

-- SECURITY DEFINER RPC tidak boleh dapat dipanggil anon/PUBLIC.
revoke all on function public.lesson_progress_touch(uuid, text[], uuid, boolean) from public, anon;
revoke all on function public.lesson_progress_start(uuid) from public, anon;
revoke all on function public.lesson_progress_mark(uuid, text[], uuid) from public, anon;
revoke all on function public.lesson_progress_complete(uuid) from public, anon;
grant execute on function public.lesson_progress_touch(uuid, text[], uuid, boolean) to authenticated;
grant execute on function public.lesson_progress_start(uuid) to authenticated;
grant execute on function public.lesson_progress_mark(uuid, text[], uuid) to authenticated;
grant execute on function public.lesson_progress_complete(uuid) to authenticated;
