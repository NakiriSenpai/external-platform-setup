-- =========================================================================
-- Sprint 31 — Urutan Lesson Persisten (lessons.sort_order + swap_lesson_order)
-- Target  : SUPABASE EKSTERNAL. Jalankan MANUAL di SQL Editor setelah ditinjau.
-- Sifat   : ADDITIVE ONLY. Tidak ada DROP TABLE / DELETE data. Tidak mengubah
--           RLS tabel lain, lesson_progress, exam, leaderboard, atau Color Test.
-- Idempoten: aman dijalankan ulang (if not exists / create or replace).
-- =========================================================================

begin;

-- 1) Kolom sort_order pada public.lessons
alter table public.lessons add column if not exists sort_order integer;

-- Nilai awal deterministik: urutan pembuatan dari yang paling awal (cocok untuk
-- silabus materi berurutan #001 -> #002 -> dst.).
with ranked as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.lessons
  where sort_order is null
)
update public.lessons l
set sort_order = r.rn + coalesce((select max(sort_order) from public.lessons), 0)
from ranked r
where l.id = r.id;

alter table public.lessons alter column sort_order set default 0;
create index if not exists lessons_sort_order_idx
  on public.lessons (tenant_id, category, sort_order, created_at asc);

-- Lesson baru otomatis masuk ke urutan paling akhir (melanjutkan urutan belajar).
create or replace function public.lessons_assign_sort_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sort_order is null or new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order from public.lessons;
  end if;
  return new;
end;
$$;

drop trigger if exists lessons_assign_sort_order on public.lessons;
create trigger lessons_assign_sort_order
before insert on public.lessons
for each row execute function public.lessons_assign_sort_order();

-- 2) Tukar urutan dua lesson secara atomik (Owner only). Tidak menyentuh kolom lain.
create or replace function public.swap_lesson_order(p_lesson_a uuid, p_lesson_b uuid)
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
    raise exception 'Hanya Owner yang dapat mengubah urutan lesson.';
  end if;
  if p_lesson_a = p_lesson_b then
    return;
  end if;

  -- Kunci kedua baris dengan urutan id stabil (anti deadlock).
  perform 1 from public.lessons where id in (p_lesson_a, p_lesson_b) order by id for update;

  select sort_order into v_a from public.lessons where id = p_lesson_a;
  select sort_order into v_b from public.lessons where id = p_lesson_b;
  if v_a is null or v_b is null then
    raise exception 'Lesson tidak ditemukan.';
  end if;

  if v_a = v_b then
    update public.lessons set sort_order = v_b + 1 where id = p_lesson_b;
    return;
  end if;

  update public.lessons set sort_order = v_b where id = p_lesson_a;
  update public.lessons set sort_order = v_a where id = p_lesson_b;
end;
$$;

revoke all on function public.swap_lesson_order(uuid, uuid) from public;
grant execute on function public.swap_lesson_order(uuid, uuid) to authenticated;

commit;
