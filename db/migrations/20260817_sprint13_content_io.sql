-- =====================================================================
-- SPRINT 13 — CONTENT IMPORT / EXPORT + CONTENT VALIDATION
-- Jalankan di Supabase SQL Editor (project eksternal).
-- Idempotent: aman dijalankan ulang. Tidak menghapus data apapun.
-- Tidak menyentuh snapshot / attempt lifecycle.
--
-- ISI:
-- 1. public.questions.external_key  -> stable identifier portable
--    (import/export TIDAK boleh bergantung pada UUID database asal)
-- 2. public.content_io_audit        -> audit metadata import/export
-- =====================================================================

-- 1. STABLE IDENTIFIER UNTUK QUESTION ---------------------------------
alter table public.questions
  add column if not exists external_key text;

-- default stabil untuk baris baru
alter table public.questions
  alter column external_key set default ('q_' || replace(gen_random_uuid()::text, '-', ''));

-- backfill baris lama (deterministik dari id, jadi re-run tidak mengubah nilai)
update public.questions
set external_key = 'q_' || replace(id::text, '-', '')
where external_key is null;

create unique index if not exists questions_external_key_key
  on public.questions (external_key)
  where external_key is not null;

-- 2. AUDIT LOG IMPORT / EXPORT ----------------------------------------
create table if not exists public.content_io_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  item_count integer not null default 0,
  result text not null default 'success',
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_io_audit_tenant_idx
  on public.content_io_audit (tenant_id, created_at desc);

grant select, insert on public.content_io_audit to authenticated;
grant all on public.content_io_audit to service_role;

alter table public.content_io_audit enable row level security;

drop policy if exists "audit insert by self" on public.content_io_audit;
create policy "audit insert by self"
  on public.content_io_audit
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "audit read scoped" on public.content_io_audit;
create policy "audit read scoped"
  on public.content_io_audit
  for select
  to authenticated
  using (public.is_owner() or tenant_id = public.current_tenant_id());
