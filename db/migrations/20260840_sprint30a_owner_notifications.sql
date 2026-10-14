-- =========================================================================
-- Sprint 30a — Notifikasi Owner (HANYA notifikasi; tanpa migrasi pembahasan)
-- STATUS: DRAFT, BELUM DIJALANKAN. Tinjau sebelum menjalankan di SQL Editor.
--
-- Aman dijalankan ulang (idempoten). Tidak menghapus data, tidak mengubah
-- snapshot/attempt, tidak mengubah RLS selain policy SELECT notifications.
-- Tidak menyentuh questions/question_answers/pembahasan sama sekali.
-- Bergantung hanya pada: notifications, profiles, is_owner() (Sprint 3),
-- notif_current_role()/notif_current_tenant() (Sprint 20). Tidak bergantung Sprint 29.
--
-- PEMULIHAN:
--   * Notifikasi terhapus: update public.notifications
--       set deleted_at = null, deleted_by = null where id = '<id>';
--   * Membatalkan seluruh skema: lihat blok ROLLBACK di akhir file.
-- =========================================================================

begin;

-- -------------------------------------------------------------------------
-- 1) Notifikasi: soft delete
-- -------------------------------------------------------------------------
alter table public.notifications add column if not exists deleted_at timestamptz;
alter table public.notifications
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

create index if not exists notifications_batch_idx
  on public.notifications ((metadata ->> 'batch_id'));

-- Policy SELECT lama + "deleted_at is null" (satu-satunya perubahan RLS).
drop policy if exists "notifications_select_scope" on public.notifications;
create policy "notifications_select_scope"
on public.notifications for select to authenticated
using (
  deleted_at is null
  and (target_user_id is null or target_user_id = auth.uid())
  and (target_role is null or target_role = public.notif_current_role())
  and (tenant_id is null or tenant_id = public.notif_current_tenant())
);

-- Daftar notifikasi user aktif.
--   Owner  : semua notifikasi tenant-nya sendiri + notifikasi global
--            (semua role/target), satu baris per aktivitas (batch_id).
--            TIDAK melihat tenant lain.
--   Lainnya: aturan yang sama persis dengan policy SELECT.
create or replace function public.list_my_notifications(p_limit integer default 50)
returns setof public.notifications
language sql
stable
security definer
set search_path = public
as $$
  select n.* from (
    select distinct on (coalesce(x.metadata ->> 'batch_id', x.id::text)) x.*
    from public.notifications x
    where x.deleted_at is null
      and (
        (public.is_owner()
         and (x.tenant_id is null or x.tenant_id = public.notif_current_tenant()))
        or (
          (x.target_user_id is null or x.target_user_id = auth.uid())
          and (x.target_role is null or x.target_role = public.notif_current_role())
          and (x.tenant_id is null or x.tenant_id = public.notif_current_tenant())
        )
      )
    order by coalesce(x.metadata ->> 'batch_id', x.id::text), x.created_at desc, x.id
  ) n
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.list_my_notifications(integer) from public;
grant execute on function public.list_my_notifications(integer) to authenticated;

-- Hapus notifikasi (soft delete) + salinan per-role satu batch.
--   Owner : notifikasi tenant sendiri (semua role/target). Global: ditolak.
--   Admin : hanya notifikasi tenant-nya sendiri (tenant_id tidak null).
--   Guru/siswa: ditolak.
-- Data sumber (exam/lesson/pengumuman) tidak disentuh. Idempoten.
create or replace function public.delete_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notifications%rowtype;
  v_role public.app_role := public.notif_current_role();
  v_tenant uuid := public.notif_current_tenant();
begin
  if auth.uid() is null then
    raise exception 'Sesi tidak valid.';
  end if;

  select * into v_row from public.notifications where id = p_notification_id;
  if not found then return; end if;

  -- Notifikasi global (tenant_id null) dibagikan ke semua tenant, sehingga
  -- tidak boleh dihapus dari dalam satu tenant (termasuk oleh Owner).
  if v_row.tenant_id is null then
    raise exception 'Notifikasi global tidak dapat dihapus dari tenant.';
  end if;
  if public.is_owner() then
    if v_tenant is null or v_row.tenant_id is distinct from v_tenant then
      raise exception 'Notifikasi ini bukan milik tenant Anda.';
    end if;
  else
    if v_role is distinct from 'admin'
       or v_row.tenant_id is null
       or v_row.tenant_id is distinct from v_tenant then
      raise exception 'Anda tidak berwenang menghapus notifikasi ini.';
    end if;
  end if;

  update public.notifications
  set deleted_at = now(), deleted_by = auth.uid()
  where deleted_at is null
    and tenant_id is not distinct from v_row.tenant_id
    and (
      id = v_row.id
      or (v_row.metadata ->> 'batch_id' is not null
          and metadata ->> 'batch_id' = v_row.metadata ->> 'batch_id')
    );
end;
$$;

revoke all on function public.delete_notification(uuid) from public;
grant execute on function public.delete_notification(uuid) to authenticated;

commit;
