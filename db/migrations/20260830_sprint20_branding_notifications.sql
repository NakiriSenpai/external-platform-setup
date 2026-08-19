-- Sprint 20 — Tenant branding (tagline) + Notification system + Web Push subscriptions.
-- Target: SUPABASE EKSTERNAL. Jalankan manual di SQL editor.
-- Tidak mengubah Exam / Lesson / Leaderboard / Analytics.

-- 1) Branding tenant --------------------------------------------------------
alter table public.tenants add column if not exists tagline text;

-- 2) Helper scope (security definer, sumber kebenaran dari profiles) --------
create or replace function public.notif_current_tenant()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.notif_current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

grant execute on function public.notif_current_tenant() to authenticated;
grant execute on function public.notif_current_role() to authenticated;

-- 3) Notifications ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum
      ('material', 'exam', 'announcement', 'maintenance', 'system', 'update');
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  type public.notification_type not null default 'announcement',
  title text not null,
  message text not null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  target_role public.app_role,
  target_user_id uuid references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_tenant_idx on public.notifications (tenant_id, created_at desc);
create index if not exists notifications_target_user_idx on public.notifications (target_user_id);

grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_scope" on public.notifications;
create policy "notifications_select_scope"
on public.notifications for select to authenticated
using (
  (target_user_id is null or target_user_id = auth.uid())
  and (target_role is null or target_role = public.notif_current_role())
  and (tenant_id is null or tenant_id = public.notif_current_tenant())
);

-- Sinkron dengan policy production aktif: tidak ada owner bypass tenant,
-- tenant_id wajib non-null dan sama dengan tenant pemanggil.
drop policy if exists "notifications_insert_staff" on public.notifications;
create policy "notifications_insert_staff"
on public.notifications for insert to authenticated
with check (
  public.notif_current_role() in ('owner', 'admin', 'guru')
  and tenant_id is not null
  and tenant_id = public.notif_current_tenant()
);

drop policy if exists "notifications_delete_staff" on public.notifications;
create policy "notifications_delete_staff"
on public.notifications for delete to authenticated
using (
  public.notif_current_role() in ('owner', 'admin')
  and tenant_id is not null
  and tenant_id = public.notif_current_tenant()
);

-- 4) Status baca per user ---------------------------------------------------
create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

grant select, insert, update, delete on public.notification_reads to authenticated;
grant all on public.notification_reads to service_role;

alter table public.notification_reads enable row level security;

drop policy if exists "notification_reads_own" on public.notification_reads;
create policy "notification_reads_own"
on public.notification_reads for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 5) Web Push subscriptions -------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
