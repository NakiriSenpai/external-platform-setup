import { z } from "zod";

/** Warna diterima dalam format hex (#rgb / #rrggbb) atau oklch(...). */
const colorPattern = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|oklch\([^)]+\)|rgb\([^)]+\))$/;

const optionalColor = z
  .string()
  .trim()
  .max(64)
  .regex(colorPattern, "Format warna tidak valid (gunakan #RRGGBB).")
  .nullable()
  .or(z.literal("").transform(() => null))
  .optional()
  .transform((v) => v ?? null);

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .url("URL tidak valid.")
  .nullable()
  .or(z.literal("").transform(() => null))
  .optional()
  .transform((v) => v ?? null);

export const brandingSchema = z.object({
  appName: z.string().trim().min(1, "Nama aplikasi wajib diisi.").max(60),
  shortName: z.string().trim().min(1, "Nama pendek wajib diisi.").max(20),
  tagline: z.string().trim().max(160).default(""),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  primaryColor: optionalColor,
  secondaryColor: optionalColor,
  accentColor: optionalColor,
  loginBranding: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .or(z.literal("").transform(() => null))
    .optional()
    .transform((v) => v ?? null),
  supportEmail: z
    .string()
    .trim()
    .email("Email dukungan tidak valid.")
    .nullable()
    .or(z.literal("").transform(() => null))
    .optional()
    .transform((v) => v ?? null),
});

export const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().min(1, "Pesan pemeliharaan wajib diisi.").max(300),
});

/** Validasi timezone memakai Intl (tanpa dependensi tambahan). */
export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export type BrandingSchemaInput = z.input<typeof brandingSchema>;

/** Pesan error pertama dari hasil parse zod (aman ditampilkan ke pengguna). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Konfigurasi tidak valid.";
}
