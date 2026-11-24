-- =========================================================================
-- Sprint 32 — Lesson Icon (lessons.icon_url) terpisah dari Banner Thumbnail
-- Target  : SUPABASE EKSTERNAL. Jalankan MANUAL di SQL Editor setelah ditinjau.
-- Sifat   : ADDITIVE ONLY. Tidak mengubah thumbnail_url, sort_order, atau RLS.
-- Idempoten: aman dijalankan ulang.
-- =========================================================================

alter table public.lessons
  add column if not exists icon_url text;

comment on column public.lessons.icon_url is
  'URL icon persegi materi (Cloudinary). Tampil di kartu daftar materi; terpisah dari thumbnail_url (banner halaman isi materi).';
