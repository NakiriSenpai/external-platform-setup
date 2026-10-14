-- Sprint 29 — Persistent Exam order, per-answer explanation, Exam discussion,
--             grouped discussion notifications, shared owner deletion.
-- Target  : SUPABASE EKSTERNAL. Jalankan MANUAL di SQL editor setelah ditinjau.
-- Sifat   : ADDITIVE ONLY. Tidak ada DROP TABLE / DELETE data. Tidak mengubah
--           RLS tabel lain, snapshot, scoring, timer, leaderboard, atau Color Test.
-- Idempoten: aman dijalankan ulang (if not exists / create or replace).

begin;

-- =========================================================================
-- 1) URUTAN EXAM PERSISTEN
--    Satu kolom sort_order per exam. Setiap exam milik satu tenant (atau global),
--    sehingga tiap tenant memakai urutan relatif exam-nya sendiri.
-- =========================================================================
alter table public.exams add column if not exists sort_order integer;

-- Nilai awal deterministik = urutan tampilan lama (created_at terbaru dulu, lalu id).
with ranked as (
  select id, row_number() over (order by created_at desc, id) as rn
  from public.exams
  where sort_order is null
)
update public.exams e
set sort_order = r.rn + coalesce((select max(sort_order) from public.exams), 0)
from ranked r
where e.id = r.id;

alter table public.exams alter column sort_order set default 0;
create index if not exists exams_sort_order_idx on public.exams (tenant_id, sort_order, created_at desc);

-- Exam baru otomatis masuk paling atas (sesuai perilaku lama "terbaru dulu").
create or replace function public.exams_assign_sort_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sort_order is null or new.sort_order = 0 then
    select coalesce(min(sort_order), 1) - 1 into new.sort_order from public.exams;
  end if;
  return new;
end;
$$;

drop trigger if exists exams_assign_sort_order on public.exams;
create trigger exams_assign_sort_order
before insert on public.exams
for each row execute function public.exams_assign_sort_order();

-- Tukar urutan dua exam secara atomik (Owner only). Tidak menyentuh kolom lain.
create or replace function public.swap_exam_order(p_exam_a uuid, p_exam_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a integer;
  v_b integer;
begin
  if not public.is_owner() then
    raise exception 'Hanya Owner yang dapat mengubah urutan exam.';
  end if;
  if p_exam_a = p_exam_b then
    return;
  end if;

  -- Kunci kedua baris dengan urutan id stabil (anti deadlock).
  perform 1 from public.exams where id in (p_exam_a, p_exam_b) order by id for update;

  select sort_order into v_a from public.exams where id = p_exam_a;
  select sort_order into v_b from public.exams where id = p_exam_b;
  if v_a is null or v_b is null then
    raise exception 'Exam tidak ditemukan.';
  end if;

  if v_a = v_b then
    -- Nilai kembar: buat berbeda secara deterministik.
    update public.exams set sort_order = v_b - 1 where id = p_exam_b;
    return;
  end if;

  update public.exams set sort_order = v_b where id = p_exam_a;
  update public.exams set sort_order = v_a where id = p_exam_b;
end;
$$;

revoke all on function public.swap_exam_order(uuid, uuid) from public;
grant execute on function public.swap_exam_order(uuid, uuid) to authenticated;

-- =========================================================================
-- 2) EXPLANATION PER PILIHAN JAWABAN
--    Identitas stabil pilihan = (question_id, label asli). Label tidak berubah
--    oleh shuffle; snapshot menyimpan label asli setiap pilihan.
--    Explanation teks bebas lama (questions.explanation) TIDAK diubah.
-- =========================================================================
alter table public.question_answers add column if not exists explanation text;

-- =========================================================================
-- 3) DISKUSI SOAL
-- =========================================================================

-- Helper: apakah user aktif boleh membuka diskusi exam pada tenant tertentu.
--  - owner              : semua
--  - admin / guru       : exam published yang dapat diakses (tenant sama / global),
--                         dan thread pada tenant miliknya
--  - siswa              : hanya setelah memiliki attempt selesai sah
--                         (submitted / expired). cancelled & in_progress tidak.
create or replace function public.can_access_exam_discussion(
  p_exam_id uuid,
  p_tenant_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then false
    when public.has_role(p_user_id, 'owner') then true
    else exists (
      select 1
      from public.profiles p
      join public.exams e on e.id = p_exam_id
      where p.id = p_user_id
        and p.is_active = true
        and p.tenant_id is not null
        and p.tenant_id = p_tenant_id
        and (e.tenant_id is null or e.tenant_id = p.tenant_id)
        and (
          (p.role in ('admin', 'guru') and e.status = 'published')
          or (
            p.role = 'siswa'
            and exists (
              select 1 from public.exam_attempts a
              where a.exam_id = p_exam_id
                and a.user_id = p_user_id
                and a.status in ('submitted', 'expired')
            )
          )
        )
    )
  end;
$$;

revoke all on function public.can_access_exam_discussion(uuid, uuid, uuid) from public;
grant execute on function public.can_access_exam_discussion(uuid, uuid, uuid) to authenticated;

create table if not exists public.exam_question_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  answer_label text check (answer_label in ('A', 'B', 'C', 'D')),
  parent_id uuid references public.exam_question_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  unique (author_id, client_request_id)
);

create index if not exists eqc_thread_idx
  on public.exam_question_comments (tenant_id, exam_id, question_id, created_at);
create index if not exists eqc_parent_idx on public.exam_question_comments (parent_id);
create index if not exists eqc_author_idx on public.exam_question_comments (author_id);

grant select on public.exam_question_comments to authenticated;
grant all on public.exam_question_comments to service_role;

alter table public.exam_question_comments enable row level security;

-- Baca langsung hanya bila berhak. Semua penulisan lewat RPC di bawah.
drop policy if exists "eqc_select_allowed" on public.exam_question_comments;
create policy "eqc_select_allowed"
on public.exam_question_comments for select to authenticated
using (public.can_access_exam_discussion(exam_id, tenant_id));

-- Tenant thread: owner boleh memilih tenant; role lain dipaksa tenant profil sendiri.
create or replace function public.discussion_resolve_tenant(p_exam_id uuid, p_tenant_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if public.is_owner() then
    v_tenant := coalesce(
      p_tenant_id,
      (select tenant_id from public.exams where id = p_exam_id),
      (select tenant_id from public.profiles where id = auth.uid())
    );
  else
    select tenant_id into v_tenant from public.profiles where id = auth.uid() and is_active = true;
  end if;
  return v_tenant;
end;
$$;

grant execute on function public.discussion_resolve_tenant(uuid, uuid) to authenticated;

-- Daftar komentar satu exam (opsional satu soal) + identitas publik penulis.
create or replace function public.list_exam_discussion(
  p_exam_id uuid,
  p_question_id uuid default null,
  p_tenant_id uuid default null
)
returns table (
  id uuid,
  tenant_id uuid,
  exam_id uuid,
  question_id uuid,
  question_number integer,
  answer_label text,
  parent_id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  author_role public.app_role,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  is_deleted boolean,
  can_edit boolean,
  can_delete boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.discussion_resolve_tenant(p_exam_id, p_tenant_id);
  v_me uuid := auth.uid();
  v_owner boolean := public.is_owner();
begin
  if v_tenant is null or not public.can_access_exam_discussion(p_exam_id, v_tenant) then
    raise exception 'Anda belum dapat membuka diskusi ujian ini.';
  end if;

  return query
  with numbered as (
    select eq.question_id as qid,
           row_number() over (order by s.order_index, eq.order_index, eq.id)::int as n
    from public.exam_questions eq
    join public.exam_sections s on s.id = eq.section_id
    where eq.exam_id = p_exam_id
  )
  select
    c.id, c.tenant_id, c.exam_id, c.question_id, nb.n, c.answer_label, c.parent_id, c.author_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Pengguna')::text,
    p.avatar_url::text,
    p.role,
    case when c.deleted_at is null then c.body else '' end,
    c.created_at,
    c.edited_at,
    c.deleted_at is not null,
    (c.deleted_at is null and c.author_id = v_me),
    (c.deleted_at is null and (c.author_id = v_me or v_owner))
  from public.exam_question_comments c
  left join public.profiles p on p.id = c.author_id
  left join numbered nb on nb.qid = c.question_id
  where c.exam_id = p_exam_id
    and c.tenant_id = v_tenant
    and (p_question_id is null or c.question_id = p_question_id)
  order by c.created_at asc, c.id asc;
end;
$$;

grant execute on function public.list_exam_discussion(uuid, uuid, uuid) to authenticated;

-- Kirim komentar / reply (idempoten per client_request_id).
create or replace function public.post_exam_comment(
  p_exam_id uuid,
  p_question_id uuid,
  p_body text,
  p_client_request_id uuid,
  p_parent_id uuid default null,
  p_answer_label text default null,
  p_tenant_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_tenant uuid := public.discussion_resolve_tenant(p_exam_id, p_tenant_id);
  v_body text := btrim(coalesce(p_body, ''));
  v_existing uuid;
  v_parent public.exam_question_comments%rowtype;
  v_id uuid;
begin
  if v_me is null then raise exception 'Sesi tidak ditemukan.'; end if;
  if v_body = '' then raise exception 'Komentar tidak boleh kosong.'; end if;
  if char_length(v_body) > 2000 then raise exception 'Komentar terlalu panjang (maks 2000 karakter).'; end if;
  if p_client_request_id is null then raise exception 'Permintaan tidak valid.'; end if;

  select id into v_existing from public.exam_question_comments
  where author_id = v_me and client_request_id = p_client_request_id;
  if v_existing is not null then return v_existing; end if;

  if v_tenant is null or not public.can_access_exam_discussion(p_exam_id, v_tenant) then
    raise exception 'Anda belum dapat berkomentar pada ujian ini.';
  end if;

  if not exists (
    select 1 from public.exam_questions eq
    where eq.exam_id = p_exam_id and eq.question_id = p_question_id
  ) then
    raise exception 'Soal tidak termasuk dalam ujian ini.';
  end if;

  if p_answer_label is not null and p_answer_label not in ('A', 'B', 'C', 'D') then
    raise exception 'Pilihan jawaban tidak valid.';
  end if;

  if p_parent_id is not null then
    select * into v_parent from public.exam_question_comments where id = p_parent_id;
    if not found
       or v_parent.exam_id <> p_exam_id
       or v_parent.question_id <> p_question_id
       or v_parent.tenant_id <> v_tenant then
      raise exception 'Komentar induk tidak ditemukan.';
    end if;
  end if;

  insert into public.exam_question_comments
    (tenant_id, exam_id, question_id, answer_label, parent_id, author_id, body, client_request_id)
  values
    (v_tenant, p_exam_id, p_question_id,
     coalesce(p_answer_label, v_parent.answer_label), p_parent_id, v_me, v_body, p_client_request_id)
  on conflict (author_id, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.exam_question_comments
    where author_id = v_me and client_request_id = p_client_request_id;
  end if;
  return v_id;
end;
$$;

grant execute on function public.post_exam_comment(uuid, uuid, text, uuid, uuid, text, uuid) to authenticated;

-- Edit komentar sendiri.
create or replace function public.edit_exam_comment(p_comment_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_row public.exam_question_comments%rowtype;
begin
  if v_body = '' then raise exception 'Komentar tidak boleh kosong.'; end if;
  if char_length(v_body) > 2000 then raise exception 'Komentar terlalu panjang (maks 2000 karakter).'; end if;
  select * into v_row from public.exam_question_comments where id = p_comment_id for update;
  if not found or v_row.author_id <> auth.uid() or v_row.deleted_at is not null then
    raise exception 'Komentar tidak dapat diedit.';
  end if;
  if not public.can_access_exam_discussion(v_row.exam_id, v_row.tenant_id) then
    raise exception 'Komentar tidak dapat diedit.';
  end if;
  update public.exam_question_comments set body = v_body, edited_at = now() where id = p_comment_id;
end;
$$;

grant execute on function public.edit_exam_comment(uuid, text) to authenticated;

-- Hapus (soft) komentar: penulis sendiri atau Owner. Reply tetap utuh.
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
  if not (public.is_owner() or v_row.author_id = auth.uid()) then
    raise exception 'Anda tidak berhak menghapus komentar ini.';
  end if;
  update public.exam_question_comments
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_comment_id;
end;
$$;

grant execute on function public.delete_exam_comment(uuid) to authenticated;

-- =========================================================================
-- 4) NOTIFIKASI DISKUSI BERKELOMPOK (per tenant + exam, dengan generasi)
--    Penerima dihitung saat dibaca memakai can_access_exam_discussion,
--    sehingga user tanpa hak tidak pernah melihat/menghitung notifikasi.
-- =========================================================================
create table if not exists public.discussion_notification_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

-- Maksimal SATU kelompok aktif per (tenant, exam). Kelompok terhapus = generasi lama.
create unique index if not exists dng_active_unique
  on public.discussion_notification_groups (tenant_id, exam_id)
  where deleted_at is null;
create index if not exists dng_tenant_activity_idx
  on public.discussion_notification_groups (tenant_id, last_activity_at desc)
  where deleted_at is null;

grant select on public.discussion_notification_groups to authenticated;
grant all on public.discussion_notification_groups to service_role;
alter table public.discussion_notification_groups enable row level security;

drop policy if exists "dng_select_allowed" on public.discussion_notification_groups;
create policy "dng_select_allowed"
on public.discussion_notification_groups for select to authenticated
using (deleted_at is null and public.can_access_exam_discussion(exam_id, tenant_id));

create table if not exists public.discussion_notification_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.discussion_notification_groups (id) on delete cascade,
  comment_id uuid not null unique references public.exam_question_comments (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null,
  kind text not null check (kind in ('comment', 'reply')),
  parent_author_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists dne_group_idx on public.discussion_notification_events (group_id, created_at desc);

grant select on public.discussion_notification_events to authenticated;
grant all on public.discussion_notification_events to service_role;
alter table public.discussion_notification_events enable row level security;

drop policy if exists "dne_select_allowed" on public.discussion_notification_events;
create policy "dne_select_allowed"
on public.discussion_notification_events for select to authenticated
using (exists (
  select 1 from public.discussion_notification_groups g
  where g.id = group_id
    and g.deleted_at is null
    and public.can_access_exam_discussion(g.exam_id, g.tenant_id)
));

create table if not exists public.discussion_notification_reads (
  group_id uuid not null references public.discussion_notification_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

grant select on public.discussion_notification_reads to authenticated;
grant all on public.discussion_notification_reads to service_role;
alter table public.discussion_notification_reads enable row level security;

drop policy if exists "dnr_select_own" on public.discussion_notification_reads;
create policy "dnr_select_own"
on public.discussion_notification_reads for select to authenticated
using (user_id = auth.uid());

-- Trigger: setiap komentar baru → kelompok aktif (dibuat/diperbarui) + satu event.
-- Atomik & tahan request bersamaan: partial unique index + on conflict.
create or replace function public.discussion_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_parent_author uuid;
begin
  insert into public.discussion_notification_groups (tenant_id, exam_id, last_activity_at)
  values (new.tenant_id, new.exam_id, new.created_at)
  on conflict (tenant_id, exam_id) where deleted_at is null
  do update set last_activity_at = greatest(public.discussion_notification_groups.last_activity_at, excluded.last_activity_at)
  returning id into v_group;

  if new.parent_id is not null then
    select author_id into v_parent_author from public.exam_question_comments where id = new.parent_id;
  end if;

  insert into public.discussion_notification_events
    (group_id, comment_id, actor_id, question_id, kind, parent_author_id, created_at)
  values
    (v_group, new.id, new.author_id, new.question_id,
     case when new.parent_id is null then 'comment' else 'reply' end,
     v_parent_author, new.created_at)
  on conflict (comment_id) do nothing;

  return new;
end;
$$;

drop trigger if exists discussion_comment_notify on public.exam_question_comments;
create trigger discussion_comment_notify
after insert on public.exam_question_comments
for each row execute function public.discussion_comment_notify();

-- Daftar kelompok untuk user aktif. Mengecualikan kelompok terhapus & aktivitas sendiri.
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
    and (public.is_owner() or g.tenant_id = public.notif_current_tenant())
    and public.can_access_exam_discussion(g.exam_id, g.tenant_id)
  group by g.id, g.tenant_id, g.exam_id, e.title, r.last_read_at
  order by max(ev.created_at) desc
  limit 50;
$$;

grant execute on function public.list_discussion_notification_groups() to authenticated;

-- Detail aktivitas satu kelompok, lengkap dengan nomor soal kanonik exam.
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
declare
  v_group public.discussion_notification_groups%rowtype;
  v_read timestamptz;
begin
  select * into v_group from public.discussion_notification_groups where id = p_group_id;
  if not found or v_group.deleted_at is not null
     or not (public.is_owner() or v_group.tenant_id = public.notif_current_tenant())
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

grant execute on function public.list_discussion_notification_events(uuid) to authenticated;

-- Tandai kelompok dibaca (per user). Tidak memengaruhi user lain.
create or replace function public.mark_discussion_group_read(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.discussion_notification_groups%rowtype;
begin
  select * into v_group from public.discussion_notification_groups where id = p_group_id;
  if not found or v_group.deleted_at is not null
     or not public.can_access_exam_discussion(v_group.exam_id, v_group.tenant_id) then
    return;
  end if;
  insert into public.discussion_notification_reads (group_id, user_id, last_read_at)
  values (p_group_id, auth.uid(), now())
  on conflict (group_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

grant execute on function public.mark_discussion_group_read(uuid) to authenticated;

-- =========================================================================
-- 5) HAPUS KELOMPOK NOTIFIKASI BERSAMA (Owner only)
--    Menandai deleted_at → hilang dari daftar, badge, unread SEMUA user.
--    Komentar & reply TIDAK dihapus. Aktivitas baru membuat kelompok (generasi) baru.
-- =========================================================================
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
  where id = p_group_id and deleted_at is null;
  -- Idempoten: double click / retry / request bersamaan tidak error.
end;
$$;

revoke all on function public.delete_discussion_notification_group(uuid) from public;
grant execute on function public.delete_discussion_notification_group(uuid) to authenticated;

-- =========================================================================
-- 6) REVIEW: izinkan guru/admin tenant yang sama tidak diubah (tetap seperti lama).
--    Tidak ada perubahan pada get_exam_attempt_review / snapshot / scoring.
-- =========================================================================

commit;
