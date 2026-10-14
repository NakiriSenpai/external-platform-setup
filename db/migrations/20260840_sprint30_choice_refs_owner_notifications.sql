-- =========================================================================
-- Sprint 30 — Referensi pilihan di pembahasan + notifikasi Owner
-- STATUS: DRAFT, BELUM DIJALANKAN. Tinjau sebelum menjalankan di SQL Editor.
--
-- Aman dijalankan ulang (idempoten). Tidak menghapus data, tidak mengubah
-- snapshot/attempt, tidak mengubah RLS selain policy SELECT notifications.
--
-- PEMULIHAN:
--   * Pembahasan: select public.restore_explanation_migration('<run_id>');
--     (hanya memulihkan field yang isinya masih sama dengan hasil migrasi).
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
--   Owner  : seluruh notifikasi platform (konsisten dengan is_owner() pada
--            diskusi & tenant), satu baris per aktivitas (batch_id).
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
        public.is_owner()
        or (
          (x.target_user_id is null or x.target_user_id = auth.uid())
          and (x.target_role is null or x.target_role = public.notif_current_role())
          and (x.tenant_id is null or x.tenant_id = public.notif_current_tenant())
        )
      )
    order by coalesce(x.metadata ->> 'batch_id', x.id::text), x.created_at desc
  ) n
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.list_my_notifications(integer) from public;
grant execute on function public.list_my_notifications(integer) to authenticated;

-- Hapus notifikasi (soft delete) + salinan per-role satu batch.
--   Owner : semua notifikasi.
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

  if not public.is_owner() then
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

-- -------------------------------------------------------------------------
-- 2) Migrasi referensi pilihan: backup + apply + restore
-- -------------------------------------------------------------------------
create table if not exists public.explanation_migration_backups (
  id bigserial primary key,
  run_id uuid not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  answer_label text,               -- null = pembahasan umum soal
  original_text text not null,
  migrated_text text not null,
  applied_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz not null default now(),
  restored_at timestamptz
);

create index if not exists emb_run_idx on public.explanation_migration_backups (run_id);

alter table public.explanation_migration_backups enable row level security;
revoke all on public.explanation_migration_backups from anon, authenticated;
grant select on public.explanation_migration_backups to authenticated;
grant all on public.explanation_migration_backups to service_role;

drop policy if exists "emb_select_owner" on public.explanation_migration_backups;
create policy "emb_select_owner"
on public.explanation_migration_backups for select to authenticated
using (public.is_owner());

-- p_changes: [{question_id, answer_label|null, original, migrated}]
-- Field hanya diubah bila isinya SAMA PERSIS dengan `original` saat pratinjau
-- (bila sudah diedit/dimigrasi, dilewati) → aman diulang & dilanjutkan.
create or replace function public.apply_explanation_migration(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run uuid := gen_random_uuid();
  v_item jsonb;
  v_qid uuid;
  v_label text;
  v_orig text;
  v_new text;
  v_count integer;
  v_applied integer := 0;
  v_skipped integer := 0;
begin
  if not public.is_owner() then
    raise exception 'Hanya Owner yang dapat menjalankan migrasi pembahasan.';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'Format perubahan tidak valid.';
  end if;

  for v_item in select * from jsonb_array_elements(p_changes) loop
    v_qid := (v_item ->> 'question_id')::uuid;
    v_label := nullif(v_item ->> 'answer_label', '');
    v_orig := v_item ->> 'original';
    v_new := v_item ->> 'migrated';

    if v_new is null or v_orig is null or v_new = v_orig
       or v_new !~ '\[\[pilihan:[A-D]\]\]' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_label is null then
      update public.questions set explanation = v_new
      where id = v_qid and explanation = v_orig;
    else
      update public.question_answers set explanation = v_new
      where question_id = v_qid and label::text = v_label and explanation = v_orig;
    end if;
    get diagnostics v_count = row_count;

    if v_count > 0 then
      insert into public.explanation_migration_backups
        (run_id, question_id, answer_label, original_text, migrated_text, applied_by)
      values (v_run, v_qid, v_label, v_orig, v_new, auth.uid());
      v_applied := v_applied + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return jsonb_build_object('run_id', v_run, 'applied', v_applied, 'skipped', v_skipped);
end;
$$;

revoke all on function public.apply_explanation_migration(jsonb) from public;
grant execute on function public.apply_explanation_migration(jsonb) to authenticated;

create or replace function public.restore_explanation_migration(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  v_count integer;
  v_restored integer := 0;
begin
  if not public.is_owner() then
    raise exception 'Hanya Owner yang dapat memulihkan pembahasan.';
  end if;
  for b in
    select * from public.explanation_migration_backups
    where run_id = p_run_id and restored_at is null
  loop
    if b.answer_label is null then
      update public.questions set explanation = b.original_text
      where id = b.question_id and explanation = b.migrated_text;
    else
      update public.question_answers set explanation = b.original_text
      where question_id = b.question_id and label::text = b.answer_label
        and explanation = b.migrated_text;
    end if;
    get diagnostics v_count = row_count;
    if v_count > 0 then
      update public.explanation_migration_backups set restored_at = now() where id = b.id;
      v_restored := v_restored + 1;
    end if;
  end loop;
  return v_restored;
end;
$$;

revoke all on function public.restore_explanation_migration(uuid) from public;
grant execute on function public.restore_explanation_migration(uuid) to authenticated;

commit;

-- -------------------------------------------------------------------------
-- AUDIT SPRINT 29 (READ ONLY) — jalankan untuk memeriksa hasil Sprint 29.
-- -------------------------------------------------------------------------
-- select column_name, table_name from information_schema.columns
--  where table_schema='public' and (table_name, column_name) in
--  (('exams','sort_order'),('question_answers','explanation'));
-- select tablename from pg_tables where schemaname='public' and tablename in
--  ('exam_question_comments','discussion_notification_groups',
--   'discussion_notification_events','discussion_notification_reads');
-- select proname, prosecdef, proconfig from pg_proc where pronamespace='public'::regnamespace
--  and proname in ('swap_exam_order','can_access_exam_discussion','list_exam_discussion',
--   'post_exam_comment','edit_exam_comment','delete_exam_comment','discussion_comment_notify',
--   'list_discussion_notification_groups','list_discussion_notification_events',
--   'mark_discussion_group_read','delete_discussion_notification_group','exams_assign_sort_order');
-- select tgname from pg_trigger where tgname in ('exams_assign_sort_order','discussion_comment_notify');
-- select indexname from pg_indexes where indexname in
--  ('exams_sort_order_idx','dng_active_unique','eqc_thread_idx','dne_group_idx');
-- select count(*) filter (where sort_order is null) as exams_tanpa_urutan from public.exams;

-- -------------------------------------------------------------------------
-- ROLLBACK (hanya bila diperlukan; tidak menghapus data notifikasi/soal)
-- -------------------------------------------------------------------------
-- drop function if exists public.list_my_notifications(integer);
-- drop function if exists public.delete_notification(uuid);
-- drop function if exists public.apply_explanation_migration(jsonb);
-- drop function if exists public.restore_explanation_migration(uuid);
-- (policy notifications_select_scope dapat dikembalikan dari Sprint 20.)
