-- =====================================================================
-- SPRINT 19.1 — EXAM CATEGORY MANAGEMENT (single source of truth)
-- Jalankan di Supabase SQL Editor (project eksternal).
-- Idempotent: aman dijalankan ulang.
-- Tidak menyentuh Exam Engine / attempt / snapshot / scoring.
-- =====================================================================

-- 1. TABEL -------------------------------------------------------------
create table if not exists public.exam_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  slug text not null,
  label text not null,
  order_index integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unik per tenant (tenant_id NULL = kategori global).
create unique index if not exists exam_categories_tenant_slug_idx
  on public.exam_categories (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create index if not exists exam_categories_tenant_idx on public.exam_categories (tenant_id);

-- 2. TRIGGER -----------------------------------------------------------
drop trigger if exists exam_categories_touch_updated_at on public.exam_categories;
create trigger exam_categories_touch_updated_at before update on public.exam_categories
  for each row execute function public.touch_updated_at();

-- 3. GRANTS ------------------------------------------------------------
grant select, insert, update, delete on public.exam_categories to authenticated;
grant all on public.exam_categories to service_role;

-- 4. RLS ---------------------------------------------------------------
alter table public.exam_categories enable row level security;

-- Owner: akses penuh.
drop policy if exists "exam_categories_owner_all" on public.exam_categories;
create policy "exam_categories_owner_all" on public.exam_categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Pengguna tenant: hanya membaca kategori global atau kategori tenant-nya.
drop policy if exists "exam_categories_select_tenant" on public.exam_categories;
create policy "exam_categories_select_tenant" on public.exam_categories for select to authenticated
  using (tenant_id is null or tenant_id = public.current_tenant_id());

-- 5. SEED dari kategori exam yang sudah ada (tanpa mengubah exam) -------
insert into public.exam_categories (tenant_id, slug, label)
select distinct e.tenant_id, e.category, initcap(replace(e.category, '-', ' '))
from public.exams e
where coalesce(e.category, '') <> ''
on conflict do nothing;

comment on table public.exam_categories is
  'Sumber tunggal kategori ujian. Dikelola dari Exam Studio, dibaca Exam Catalog.';
