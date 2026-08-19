-- Sprint 19 — Exam Catalog: icon exam dikelola dari Exam Studio.
-- Menyimpan URL icon (Cloudinary external). Tidak mengubah Exam Engine.

alter table public.exams
  add column if not exists icon_url text;

comment on column public.exams.icon_url is
  'URL icon exam (Cloudinary). Dipakai Exam Catalog; dikelola dari Exam Studio.';
