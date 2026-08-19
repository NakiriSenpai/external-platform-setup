import { MEDIA_EXTENSIONS, MEDIA_MIME } from "./constants";
import type { MediaKind } from "@/types/media";

/** Ekstensi file dalam huruf kecil, tanpa titik. */
export function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : "";
}

/** Menentukan jenis media dari File atau nama/MIME-nya. */
export function getMediaType(input: File | string): MediaKind | null {
  const mime = typeof input === "string" ? input : input.type;
  const name = typeof input === "string" ? input : input.name;
  const lower = (mime || "").toLowerCase();

  for (const kind of ["image", "audio"] as MediaKind[]) {
    if (lower && MEDIA_MIME[kind].includes(lower)) return kind;
  }
  // Android/Documents Provider kadang mengirim MIME generik atau varian lain.
  if (lower.startsWith("image/")) return "image";
  if (lower.startsWith("audio/")) return "audio";

  const ext = getFileExtension(name);
  for (const kind of ["image", "audio"] as MediaKind[]) {
    if (ext && MEDIA_EXTENSIONS[kind].includes(ext)) return kind;
  }
  return null;
}

/** Format ukuran file menjadi teks ringkas (contoh: 1,2 MB). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1).replace(".", ",")} ${units[index]}`;
}

/** Format durasi detik menjadi mm:ss atau h:mm:ss. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Nilai atribut accept untuk <input type="file">.
 * Sengaja memakai wildcard (image/*, audio/*) agar Android Photo Picker,
 * Documents Provider, Google Photos, dan galeri bawaan menampilkan semua folder.
 * Validasi format tetap dilakukan setelah file dipilih.
 */
export function acceptMime(kinds: MediaKind | MediaKind[]): string {
  const list = Array.isArray(kinds) ? kinds : [kinds];
  return Array.from(new Set(list.map((kind) => `${kind}/*`))).join(",");
}

/** Nama file tanpa ekstensi, untuk keperluan tampilan. */
export function getFileBaseName(name: string): string {
  const ext = getFileExtension(name);
  return ext ? name.slice(0, -(ext.length + 1)) : name;
}
