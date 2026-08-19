-- =====================================================================
-- SPRINT 2 — DATABASE FOUNDATION & MULTI-TENANT CORE
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- =====================================================================

-- 1. ENUM ROLE ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('owner', 'admin', 'guru', 'siswa');
  end if;
end
$$;

-- 2. TABEL TENANTS -----------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.tenants to authenticated;
grant all on public.tenants to service_role;

create index if not exists tenants_slug_idx on public.tenants (slug);
create index if not exists tenants_is_active_idx on public.tenants (is_active);

-- 3. TABEL PROFILES ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  role public.app_role not null default 'siswa',
  email text,
  full_name text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

-- 4. TRIGGER updated_at ------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 5. ROLE HELPER (security definer — mencegah rekursi RLS) -------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and role = _role and is_active = true
  );
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- 6. AUTO PROFILE ------------------------------------------------------
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

  insert into public.profiles (id, email, full_name, avatar_url, role, tenant_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(meta_role, 'siswa'::public.app_role),
    nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profil untuk user lama
insert into public.profiles (id, email, full_name, role)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name', 'siswa'::public.app_role
from auth.users u
on conflict (id) do nothing;

-- 7. RLS ---------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_select_owner" on public.profiles;
create policy "profiles_select_owner"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'owner'));

drop policy if exists "tenants_select_member" on public.tenants;
create policy "tenants_select_member"
  on public.tenants for select to authenticated
  using (id in (select p.tenant_id from public.profiles p where p.id = auth.uid()));

drop policy if exists "tenants_select_owner" on public.tenants;
create policy "tenants_select_owner"
  on public.tenants for select to authenticated
  using (public.has_role(auth.uid(), 'owner'));
