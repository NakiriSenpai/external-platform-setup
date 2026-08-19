-- =====================================================================
-- SPRINT 15 — WHITE LABEL, FEATURE FLAGS & MAINTENANCE MODE
-- Jalankan di Supabase SQL Editor (project eksternal).
-- Idempotent: aman dijalankan ulang. Tidak menghapus data apapun.
-- Tidak menyentuh exam engine / snapshot / attempt lifecycle.
--
-- ISI:
-- 1. public.app_settings   -> singleton konfigurasi global (branding,
--                             maintenance mode, versi aplikasi)
-- 2. public.feature_flags  -> feature flag scope global & tenant
-- Catatan: feature flag BUKAN security boundary. Otorisasi tetap RBAC + RLS.
-- =====================================================================

-- 1. APP SETTINGS (SINGLETON) -----------------------------------------
create table if not exists public.app_settings (
  id boolean primary key default true,
  app_name text not null default 'LPK Learning',
  short_name text not null default 'LPK LMS',
  tagline text not null default 'Platform pembelajaran multi-tenant untuk Lembaga Pelatihan Kerja.',
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  background_color text,
  login_branding text,
  support_email text,
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'Aplikasi sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.',
  maintenance_started_at timestamptz,
  app_version text not null default '1.0.0',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

grant select on public.app_settings to anon;
grant select, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

drop policy if exists "app settings readable" on public.app_settings;
create policy "app settings readable"
  on public.app_settings for select to anon, authenticated
  using (true);

drop policy if exists "app settings update owner" on public.app_settings;
create policy "app settings update owner"
  on public.app_settings for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 2. FEATURE FLAGS -----------------------------------------------------
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  description text,
  scope text not null default 'global',
  tenant_id uuid references public.tenants (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint feature_flags_scope_check check (scope in ('global', 'tenant')),
  constraint feature_flags_scope_tenant_check check (
    (scope = 'global' and tenant_id is null) or (scope = 'tenant' and tenant_id is not null)
  )
);

create unique index if not exists feature_flags_global_key_idx
  on public.feature_flags (key) where tenant_id is null;

create unique index if not exists feature_flags_tenant_key_idx
  on public.feature_flags (key, tenant_id) where tenant_id is not null;

grant select on public.feature_flags to anon;
grant select, insert, update, delete on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;

alter table public.feature_flags enable row level security;

drop policy if exists "feature flags read scoped" on public.feature_flags;
create policy "feature flags read scoped"
  on public.feature_flags for select to anon, authenticated
  using (
    tenant_id is null
    or public.is_owner()
    or tenant_id = public.current_tenant_id()
  );

drop policy if exists "feature flags write owner" on public.feature_flags;
create policy "feature flags write owner"
  on public.feature_flags for insert to authenticated
  with check (public.is_owner());

drop policy if exists "feature flags update owner" on public.feature_flags;
create policy "feature flags update owner"
  on public.feature_flags for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "feature flags delete owner" on public.feature_flags;
create policy "feature flags delete owner"
  on public.feature_flags for delete to authenticated
  using (public.is_owner());

-- 3. SEED FLAG GLOBAL BAWAAN ------------------------------------------
insert into public.feature_flags (key, name, description, scope, enabled) values
  ('exam_engine', 'Ujian', 'Akses menu dan pengerjaan ujian untuk pengguna.', 'global', true),
  ('lesson', 'Materi', 'Akses daftar dan pembacaan materi pembelajaran.', 'global', true),
  ('leaderboard', 'Peringkat', 'Papan peringkat siswa antar tenant.', 'global', true),
  ('teacher_analytics', 'Analitik Pengajar', 'Dashboard analitik untuk guru dan admin.', 'global', true),
  ('content_io', 'Import / Export Konten', 'Impor dan ekspor bundle konten JSON.', 'global', true),
  ('media_upload', 'Unggah Media', 'Unggah gambar dan audio terpusat.', 'global', true)
on conflict do nothing;
