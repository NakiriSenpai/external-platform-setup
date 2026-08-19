/** Daftar zona waktu Indonesia (+ UTC) untuk tenant. */
export const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
  { value: "Asia/Tokyo", label: "JST — Asia/Tokyo" },
  { value: "UTC", label: "UTC" },
] as const;

export const DEFAULT_TIMEZONE = "Asia/Jakarta";

/** Ubah teks bebas menjadi slug aman. */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Ubah teks bebas menjadi tenant code (huruf besar). */
export function toTenantCode(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
