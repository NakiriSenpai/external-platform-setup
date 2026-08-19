-- Sprint Profile & Account Settings
-- Kolom pendukung avatar: 1 user = 1 aset aktif + cooldown 30 hari (hard rule server-side).
-- JALANKAN MANUAL di Supabase eksternal (SQL Editor). Tidak diaplikasikan otomatis.

alter table public.profiles
  add column if not exists avatar_public_id text,
  add column if not exists avatar_updated_at timestamptz;

comment on column public.profiles.avatar_public_id is
  'public_id Cloudinary untuk avatar aktif (profile/{tenantId}/{userId}/avatar).';
comment on column public.profiles.avatar_updated_at is
  'Waktu terakhir avatar diganti. Dipakai untuk cooldown 30 hari.';
