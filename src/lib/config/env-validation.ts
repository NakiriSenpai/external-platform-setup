import { env } from "@/lib/env";

export type EnvVarScope = "public" | "server" | "secret";

export type EnvVarStatus = {
  name: string;
  scope: EnvVarScope;
  label: string;
  required: boolean;
  present: boolean;
};

/**
 * Validasi konfigurasi runtime sisi klien.
 * Hanya memeriksa KETERSEDIAAN — nilai secret tidak pernah dibaca/ditampilkan.
 * Variabel server-only sengaja tidak dievaluasi di browser.
 */
export function validatePublicEnv(): EnvVarStatus[] {
  return [
    {
      name: "VITE_SUPABASE_URL",
      scope: "public",
      label: "URL Supabase",
      required: true,
      present: Boolean(env.supabaseUrl),
    },
    {
      name: "VITE_SUPABASE_PUBLISHABLE_KEY",
      scope: "public",
      label: "Publishable key Supabase",
      required: true,
      present: Boolean(env.supabasePublishableKey),
    },
    {
      name: "VITE_CLOUDINARY_CLOUD_NAME",
      scope: "public",
      label: "Cloud name Cloudinary",
      required: true,
      present: Boolean(env.cloudinaryCloudName),
    },
    {
      name: "VITE_CLOUDINARY_UPLOAD_PRESET",
      scope: "public",
      label: "Upload preset Cloudinary",
      required: true,
      present: Boolean(env.cloudinaryUploadPreset),
    },
  ];
}

/** Daftar variabel server-only (nama saja, tidak pernah dibaca di klien). */
export const SERVER_ONLY_ENV: { name: string; label: string; scope: EnvVarScope }[] = [
  {
    name: "LPK_SUPABASE_SERVICE_ROLE_KEY",
    label: "Service role Supabase (operasi admin)",
    scope: "secret",
  },
  { name: "CLOUDINARY_API_KEY", label: "API key Cloudinary (hapus media)", scope: "server" },
  { name: "CLOUDINARY_API_SECRET", label: "API secret Cloudinary (hapus media)", scope: "secret" },
];
