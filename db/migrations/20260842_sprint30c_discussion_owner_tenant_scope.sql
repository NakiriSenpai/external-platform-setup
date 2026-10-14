-- =========================================================================
-- Sprint 30c — Batasi Owner ke tenant sendiri pada notifikasi diskusi (OPSIONAL)
-- STATUS: DRAFT, BELUM DIJALANKAN. Jalankan SETELAH Sprint 29 (mengganti 4 fungsi
-- Sprint 29 dengan tanda tangan yang sama). Tidak mengubah tabel, data, policy.
-- Perubahan: hanya menghapus bypass "is_owner() lintas tenant" pada:
--   list_discussion_notification_groups, list_discussion_notification_events,
--   delete_discussion_notification_group, delete_exam_comment.
-- Tidak diubah: can_access_exam_discussion (Owner tetap boleh membuka diskusi
-- exam global), post/edit/list_exam_discussion.
-- ROLLBACK: jalankan ulang blok fungsi yang sama dari file Sprint 29.
-- =========================================================================

begin;

create or replace function public.list_discussion_notification_groups()
returns table (
  group_id uuid,
  tenant_id uuid,
  exam_id uuid,
  exam_title text,
  activity_count integer,
  unread_count integer,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id, g.tenant_id, g.exam_id, e.title::text,
    count(ev.id)::int as activity_count,
    count(ev.id) filter (where ev.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz))::int,
    max(ev.created_at)
  from public.discussion_notification_groups g
  join public.exams e on e.id = g.exam_id
  join public.discussion_notification_events ev
    on ev.group_id = g.id and ev.actor_id <> auth.uid()
  left join public.discussion_notification_reads r
    on r.group_id = g.id and r.user_id = auth.uid()
  where g.deleted_at is null
    and g.tenant_id = public.notif_current_tenant()
    and public.can_access_exam_discussion(g.exam_id, g.tenant_id)
  group by g.id, g.tenant_id, g.exam_id, e.title, r.last_read_at
  order by max(ev.created_at) desc
  limit 50;
$$;

create or replace function public.list_discussion_notification_events(p_group_id uuid)
returns table (
  event_id uuid,
  comment_id uuid,
  question_id uuid,
  question_number integer,
  kind text,
  actor_name text,
  parent_author_name text,
  created_at timestamptz,
  is_unread boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_group public.discussion_notification_groups%rowtype;
  v_read timestamptz;
begin
  select * into v_group from public.discussion_notification_groups where id = p_group_id;
  if not found or v_group.deleted_at is not null
     or v_group.tenant_id is distinct from public.notif_current_tenant()
     or not public.can_access_exam_discussion(v_group.exam_id, v_group.tenant_id) then
    raise exception 'Notifikasi tidak ditemukan.';
  end if;

  select last_read_at into v_read from public.discussion_notification_reads
  where group_id = p_group_id and user_id = auth.uid();

  return query
  with numbered as (
    select eq.question_id,
           row_number() over (order by s.order_index, eq.order_index, eq.id)::int as n
    from public.exam_questions eq
    join public.exam_sections s on s.id = eq.section_id
    where eq.exam_id = v_group.exam_id
  )
  select ev.id, ev.comment_id, ev.question_id, nb.n, ev.kind,
         coalesce(nullif(pa.full_name, ''), nullif(pa.username, ''), 'Pengguna')::text,
         coalesce(nullif(pp.full_name, ''), nullif(pp.username, ''))::text,
         ev.created_at,
         ev.created_at > coalesce(v_read, '-infinity'::timestamptz)
  from public.discussion_notification_events ev
  left join numbered nb on nb.question_id = ev.question_id
  left join public.profiles pa on pa.id = ev.actor_id
  left join public.profiles pp on pp.id = ev.parent_author_id
  where ev.group_id = p_group_id and ev.actor_id <> auth.uid()
  order by ev.created_at desc
  limit 200;
end;
$$;

create or replace function public.delete_discussion_notification_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Hanya Owner yang dapat menghapus notifikasi diskusi.';
  end if;
  update public.discussion_notification_groups
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_group_id and deleted_at is null
    and tenant_id = public.notif_current_tenant();
  if not found and exists (
    select 1 from public.discussion_notification_groups
    where id = p_group_id and tenant_id is distinct from public.notif_current_tenant()
  ) then
    raise exception 'Notifikasi ini bukan milik tenant Anda.';
  end if;
  -- Idempoten: double click / retry / request bersamaan tidak error.
end;
$$;

create or replace function public.delete_exam_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.exam_question_comments%rowtype;
begin
  select * into v_row from public.exam_question_comments where id = p_comment_id for update;
  if not found then raise exception 'Komentar tidak ditemukan.'; end if;
  if v_row.deleted_at is not null then return; end if;
  if not (v_row.author_id = auth.uid()
          or (public.is_owner() and v_row.tenant_id = public.notif_current_tenant())) then
    raise exception 'Anda tidak berhak menghapus komentar ini.';
  end if;
  update public.exam_question_comments
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_comment_id;
end;
$$;

commit;
