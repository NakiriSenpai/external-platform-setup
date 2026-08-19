-- =====================================================================
-- SPRINT 22 — QUESTION CLEANUP, SOFT DELETE, & HAPUS RIWAYAT ATTEMPT
-- Jalankan seluruh isi file ini di Supabase SQL Editor.
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: seluruh migration sebelumnya sudah dijalankan.
--
-- Isi:
-- 1. Soft delete soal Question Bank (deleted_at) + RPC delete_bank_question.
-- 2. RPC delete_exam_attempt (Owner only) untuk hapus satu riwayat ujian.
-- 3. Menghapus field soal yang sudah deprecated (grammar tag, tag umum,
--    category, difficulty, question_type, visibility).
--    Grammar Tag TETAP dipertahankan untuk Lesson (lesson_blocks).
-- =====================================================================

-- 1. SOFT DELETE ------------------------------------------------------
alter table public.questions
  add column if not exists deleted_at timestamptz;

create index if not exists questions_deleted_at_idx on public.questions (deleted_at);

/**
 * Hapus soal dari Question Bank.
 * - Bila soal masih direferensikan exam_questions / lesson_questions:
 *   soft delete (deleted_at) agar Exam & snapshot historis tetap utuh.
 * - Bila tidak direferensikan sama sekali: hard delete.
 */
create or replace function public.delete_bank_question(p_question_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refs integer;
begin
  select
    (select count(*) from public.exam_questions where question_id = p_question_id)
    + (select count(*) from public.lesson_questions where question_id = p_question_id)
  into v_refs;

  if v_refs > 0 then
    update public.questions
      set deleted_at = now(), is_archived = true
      where id = p_question_id;
    return 'soft';
  end if;

  delete from public.questions where id = p_question_id;
  return 'hard';
end;
$$;

revoke all on function public.delete_bank_question(uuid) from public;
grant execute on function public.delete_bank_question(uuid) to authenticated;

-- 2. HAPUS SATU RIWAYAT ATTEMPT (OWNER ONLY) --------------------------
create or replace function public.delete_exam_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'owner') then
    raise exception 'Hanya Owner yang dapat menghapus riwayat ujian.';
  end if;

  delete from public.exam_attempt_answers where attempt_id = p_attempt_id;
  delete from public.exam_attempt_snapshots where attempt_id = p_attempt_id;
  delete from public.exam_attempt_results where attempt_id = p_attempt_id;
  delete from public.exam_attempts where id = p_attempt_id;
end;
$$;

revoke all on function public.delete_exam_attempt(uuid) from public;
grant execute on function public.delete_exam_attempt(uuid) to authenticated;

-- 3. HAPUS FIELD SOAL YANG SUDAH TIDAK DIPAKAI ------------------------
-- Relasi tag pada soal (grammar tag & tag umum) tidak lagi dipakai.
drop table if exists public.question_grammar_tags;
drop table if exists public.question_tags;
drop table if exists public.tags;

-- Trigger version tidak boleh lagi mereferensikan kolom yang dihapus.
create or replace function public.bump_question_version()
returns trigger
language plpgsql
as $$
begin
  if (new.text is distinct from old.text)
     or (new.image_url is distinct from old.image_url)
     or (new.audio_url is distinct from old.audio_url)
     or (new.explanation is distinct from old.explanation)
     or (new.instruction is distinct from old.instruction)
     or (new.lesson_id is distinct from old.lesson_id)
  then
    new.version := coalesce(old.version, 1) + 1;
  end if;
  return new;
end;
$$;

drop index if exists public.questions_type_idx;
drop index if exists public.questions_category_idx;
drop index if exists public.questions_difficulty_idx;
drop index if exists public.questions_visibility_idx;

alter table public.questions
  drop column if exists question_type,
  drop column if exists visibility,
  drop column if exists category,
  drop column if exists difficulty;

drop type if exists public.question_type;
drop type if exists public.question_visibility;
