-- =====================================================================
-- SPRINT 4 — USER MANAGEMENT
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2 & Sprint 3 sudah dijalankan.
-- =====================================================================

-- 1. INDEX PENDUKUNG PENCARIAN & FILTER -------------------------------
create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_active_idx on public.profiles (is_active);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- Username unik (case-insensitive) bila diisi.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username)) where username is not null;

-- 2. HELPER: apakah user adalah admin dari tenant tertentu -------------
create or replace function public.is_tenant_admin(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.app_role
      and p.is_active = true
      and p.tenant_id is not null
      and p.tenant_id = _tenant_id
  );
$$;

-- 3. RLS PROFILES ------------------------------------------------------
alter table public.profiles enable row level security;

-- SELECT: baris sendiri (guru & siswa cukup ini)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- SELECT: owner melihat semua user
drop policy if exists "profiles_select_owner" on public.profiles;
create policy "profiles_select_owner"
  on public.profiles for select to authenticated
  using (public.is_owner());

-- SELECT: admin melihat seluruh user dalam tenant sendiri
drop policy if exists "profiles_select_tenant" on public.profiles;
create policy "profiles_select_tenant"
  on public.profiles for select to authenticated
  using (tenant_id is not null and public.is_tenant_admin(tenant_id));

-- UPDATE: baris sendiri (kolom sensitif dikunci trigger)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- UPDATE: owner boleh mengubah semua
drop policy if exists "profiles_update_owner" on public.profiles;
create policy "profiles_update_owner"
  on public.profiles for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- UPDATE: admin hanya boleh mengubah guru & siswa dalam tenant sendiri
drop policy if exists "profiles_update_tenant_admin" on public.profiles;
create policy "profiles_update_tenant_admin"
  on public.profiles for update to authenticated
  using (
    tenant_id is not null
    and public.is_tenant_admin(tenant_id)
    and role in ('guru'::public.app_role, 'siswa'::public.app_role)
  )
  with check (
    tenant_id is not null
    and public.is_tenant_admin(tenant_id)
    and role in ('guru'::public.app_role, 'siswa'::public.app_role)
  );

-- 4. GUARD: non-owner tidak boleh mengubah role / tenant_id ------------
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_owner() then
    return new;
  end if;
  new.role := old.role;
  new.tenant_id := old.tenant_id;
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists profiles_guard_changes on public.profiles;
create trigger profiles_guard_changes
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- 5. GRANTS ------------------------------------------------------------
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
