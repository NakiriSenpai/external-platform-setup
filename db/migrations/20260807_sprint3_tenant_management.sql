-- =====================================================================
-- SPRINT 3 — TENANT MANAGEMENT FOUNDATION
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2 sudah dijalankan.
-- =====================================================================

-- 1. KOLOM BARU: tenants ----------------------------------------------
alter table public.tenants add column if not exists tenant_code text;
alter table public.tenants add column if not exists timezone text not null default 'Asia/Jakarta';
alter table public.tenants add column if not exists created_by uuid references auth.users (id) on delete set null;

-- Isi tenant_code untuk baris lama agar unique index dapat dibuat.
update public.tenants
set tenant_code = upper(regexp_replace(slug, '[^a-zA-Z0-9]', '', 'g'))
where tenant_code is null or tenant_code = '';

create unique index if not exists tenants_tenant_code_key on public.tenants (lower(tenant_code));
create unique index if not exists tenants_slug_key on public.tenants (lower(slug));
create index if not exists tenants_created_at_idx on public.tenants (created_at desc);

-- 2. KOLOM BARU: profiles ---------------------------------------------
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.profiles add column if not exists last_login_at timestamptz;

create unique index if not exists profiles_username_key on public.profiles (lower(username))
  where username is not null;
create unique index if not exists profiles_email_key on public.profiles (lower(email))
  where email is not null;

-- 3. HELPER TENANT (security definer — mencegah rekursi RLS) ----------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_tenant_id() to authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'owner');
$$;

grant execute on function public.is_owner() to authenticated;

-- 4. TRIGGER: catat waktu login terakhir ------------------------------
create or replace function public.handle_user_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles set last_login_at = new.last_sign_in_at where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_login on auth.users;
create trigger on_auth_user_login
  after update on auth.users
  for each row execute function public.handle_user_login();

-- 5. AUTO PROFILE (diperbarui: display_name, username, created_by) ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role public.app_role;
begin
  begin
    meta_role := (new.raw_user_meta_data ->> 'role')::public.app_role;
  exception when others then
    meta_role := null;
  end;

  insert into public.profiles (
    id, email, full_name, display_name, username, avatar_url, role, tenant_id, created_by
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(meta_role, 'siswa'::public.app_role),
    nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid,
    nullif(new.raw_user_meta_data ->> 'created_by', '')::uuid
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. RLS ---------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

-- profiles: siswa & semua user → baris sendiri
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- profiles: owner → semua
drop policy if exists "profiles_select_owner" on public.profiles;
create policy "profiles_select_owner"
  on public.profiles for select to authenticated
  using (public.is_owner());

-- profiles: admin & guru → tenant sendiri
drop policy if exists "profiles_select_tenant" on public.profiles;
create policy "profiles_select_tenant"
  on public.profiles for select to authenticated
  using (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'guru'))
  );

-- profiles: update baris sendiri (kolom sensitif dilindungi trigger di bawah)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- profiles: owner boleh update semua
drop policy if exists "profiles_update_owner" on public.profiles;
create policy "profiles_update_owner"
  on public.profiles for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Cegah eskalasi hak akses: non-owner tidak boleh mengubah role/tenant_id.
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

-- tenants: anggota tenant (admin/guru/siswa) → tenant sendiri
drop policy if exists "tenants_select_member" on public.tenants;
create policy "tenants_select_member"
  on public.tenants for select to authenticated
  using (id = public.current_tenant_id());

-- tenants: owner → semua tenant
drop policy if exists "tenants_select_owner" on public.tenants;
create policy "tenants_select_owner"
  on public.tenants for select to authenticated
  using (public.is_owner());

-- tenants: hanya owner yang boleh membuat / mengubah / menghapus
drop policy if exists "tenants_insert_owner" on public.tenants;
create policy "tenants_insert_owner"
  on public.tenants for insert to authenticated
  with check (public.is_owner());

drop policy if exists "tenants_update_owner" on public.tenants;
create policy "tenants_update_owner"
  on public.tenants for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "tenants_delete_owner" on public.tenants;
create policy "tenants_delete_owner"
  on public.tenants for delete to authenticated
  using (public.is_owner());

grant select, insert, update, delete on public.tenants to authenticated;
grant select, update on public.profiles to authenticated;
grant all on public.tenants to service_role;
grant all on public.profiles to service_role;
