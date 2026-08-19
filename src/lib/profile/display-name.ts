/** Aturan nama tampilan: dipakai bersama oleh client (inline error) dan server (hard rule). */
export const DISPLAY_NAME_MIN = 3;
export const DISPLAY_NAME_MAX = 20;

/** trim + rapatkan whitespace berlebih, tanpa mengubah kapitalisasi pilihan user. */
export function normalizeDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const ALLOWED = /^[\p{L}\p{N} _-]+$/u;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Validasi nama yang sudah dinormalisasi. Mengembalikan pesan error atau null. */
export function validateDisplayName(raw: string): string | null {
  const name = normalizeDisplayName(raw);
  if (!name) return "Nama tidak boleh kosong.";
  if (EMOJI.test(name)) return "Nama tidak boleh mengandung emoji.";
  if (name.length < DISPLAY_NAME_MIN) return `Nama minimal ${DISPLAY_NAME_MIN} karakter.`;
  if (name.length > DISPLAY_NAME_MAX) return `Nama maksimal ${DISPLAY_NAME_MAX} karakter.`;
  if (!ALLOWED.test(name)) return "Nama hanya boleh berisi huruf, angka, spasi, _ dan -.";
  return null;
}
