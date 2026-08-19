-- =====================================================================
-- SPRINT 17 — LESSON PROGRESS DATABASE ROOT CAUSE FIX 2 (ERROR 42804)
-- Prasyarat: 20260822_sprint17_lesson_progress_root_fix.sql
-- Idempotent: aman dijalankan ulang. Tidak mengubah schema/tabel/data.
--
-- ROOT CAUSE (PostgreSQL 42804 "structure of query does not match
-- function result type"):
--   lesson_progress_start / _mark / _complete dideklarasikan
--   `returns public.lesson_progress` (tipe komposit), tetapi body SQL-nya
--   `select public.lesson_progress_touch(...)` menghasilkan SATU kolom
--   bertipe lesson_progress. Fungsi SQL yang mengembalikan komposit harus
--   menghasilkan SATU KOLOM PER ATRIBUT, bukan satu kolom komposit.
--   Postgres membandingkan kolom 1 (lesson_progress) dengan atribut 1
--   (id uuid) -> 42804 pada SETIAP pemanggilan: buka lesson ("Progress
--   gagal dibuat"), autosave, dan "Selesaikan Materi".
--   Karena tidak ada baris progress yang pernah tersimpan,
--   "Lanjutkan Materi" juga tidak pernah muncul.
--
-- FIX: wrapper ditulis ulang sebagai plpgsql `return <komposit>;` sehingga
-- tipe hasil identik dengan deklarasi. Bentuk SQL `(fn(...)).*` sengaja
-- TIDAK dipakai karena Postgres mengekspansinya menjadi satu pemanggilan
-- fungsi VOLATILE per kolom. Tanpa cast, tanpa perubahan tipe kolom,
-- trigger, RLS, maupun analytics.
-- =====================================================================

create or replace function public.lesson_progress_start(p_lesson_id uuid)
returns public.lesson_progress
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  return public.lesson_progress_touch(p_lesson_id, '{}'::text[], null, false);
end;
$$;

create or replace function public.lesson_progress_mark(
  p_lesson_id uuid,
  p_units text[] default '{}',
  p_current_block_id uuid default null
)
returns public.lesson_progress
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  return public.lesson_progress_touch(p_lesson_id, p_units, p_current_block_id, false);
end;
$$;

create or replace function public.lesson_progress_complete(p_lesson_id uuid)
returns public.lesson_progress
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  return public.lesson_progress_touch(p_lesson_id, '{}'::text[], null, true);
end;
$$;

-- Hak akses tetap: hanya user terautentikasi, tidak pernah anon/PUBLIC.
revoke all on function public.lesson_progress_start(uuid) from public, anon;
revoke all on function public.lesson_progress_mark(uuid, text[], uuid) from public, anon;
revoke all on function public.lesson_progress_complete(uuid) from public, anon;
grant execute on function public.lesson_progress_start(uuid) to authenticated;
grant execute on function public.lesson_progress_mark(uuid, text[], uuid) to authenticated;
grant execute on function public.lesson_progress_complete(uuid) to authenticated;

-- Verifikasi cepat (jalankan sebagai user login di app, bukan SQL editor):
--   select * from public.lesson_progress_start('<lesson-uuid>');
--   select * from public.lesson_progress_complete('<lesson-uuid>');
--   select tenant_id, user_id, lesson_id, status, progress_percent,
--          last_activity_at, completed_at
--   from public.lesson_progress where lesson_id = '<lesson-uuid>';
