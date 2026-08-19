import type { MediaKind } from "@/types/media";

/** Batas ukuran file per jenis media (byte). */
export const MEDIA_SIZE_LIMIT: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024, // 5 MB
  audio: 20 * 1024 * 1024, // 20 MB
};

/** MIME type yang diizinkan per jenis media. */
export const MEDIA_MIME: Record<MediaKind, readonly string[]> = {
  image: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/gif",
    "image/bmp",
    "image/avif",
    "image/heic",
    "image/heif",
  ],
  audio: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/ogg",
  ],
};

/** Ekstensi yang diizinkan per jenis media (fallback bila MIME kosong). */
export const MEDIA_EXTENSIONS: Record<MediaKind, readonly string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "svg", "gif", "bmp", "avif", "heic", "heif"],
  audio: ["mp3", "wav", "m4a", "ogg"],
};

/** Label ramah pengguna untuk pesan error Bahasa Indonesia. */
export const MEDIA_LABEL: Record<MediaKind, string> = {
  image: "Gambar",
  audio: "Audio",
};
