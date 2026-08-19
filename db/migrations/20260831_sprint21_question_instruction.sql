-- =====================================================================
-- SPRINT 21 — QUESTION INSTRUCTION ("Perintah Soal")
-- Jalankan di Supabase SQL Editor (project eksternal).
-- Idempotent & backward-safe: kolom baru nullable, data lama tidak berubah.
--
-- Hanya menambah SATU kolom: public.questions.instruction
-- Dipakai oleh Exam Studio (editor), Preview, dan snapshot attempt.
--
-- CATATAN AUDIT (tidak ada kolom yang dihapus):
--   question_type, visibility, difficulty, category, grammar tag, dan tag
--   TIDAK dihapus karena masih dipakai Question Bank (filter/list),
--   Lesson Studio, Content Import/Export (bundle), validasi publish, dan
--   snapshot attempt. Field-field itu hanya dihapus dari UI Edit Exam.
-- =====================================================================

alter table public.questions
  add column if not exists instruction text;

comment on column public.questions.instruction is
  'Perintah Soal (rich text/HTML sederhana). Nullable untuk soal lama.';

-- Perubahan Perintah Soal ikut menaikkan version soal.
create or replace function public.bump_question_version()
returns trigger
language plpgsql
as $$
begin
  if (new.text is distinct from old.text)
     or (new.instruction is distinct from old.instruction)
     or (new.image_url is distinct from old.image_url)
     or (new.audio_url is distinct from old.audio_url)
     or (new.explanation is distinct from old.explanation)
     or (new.category is distinct from old.category)
     or (new.difficulty is distinct from old.difficulty)
     or (new.question_type is distinct from old.question_type)
     or (new.lesson_id is distinct from old.lesson_id)
     or (new.visibility is distinct from old.visibility)
  then
    new.version := coalesce(old.version, 1) + 1;
  end if;
  return new;
end;
$$;
