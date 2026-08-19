import { createServerFn } from "@tanstack/react-start";

export type ServerEnvStatus = {
  supabaseUrl: boolean;
  serviceRoleKey: boolean;
  cloudinaryApiKey: boolean;
  cloudinaryApiSecret: boolean;
  environment: string;
};

/**
 * Pemeriksaan KETERSEDIAAN secret sisi server.
 * Hanya mengembalikan boolean — nilai secret tidak pernah dikirim ke klien.
 */
export const getServerEnvStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServerEnvStatus> => {
    const has = (...names: string[]) => names.some((n) => Boolean(process.env[n]));
    return {
      supabaseUrl: has("LPK_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
      serviceRoleKey: has(
        "LPK_SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "LPK_SERVICE_ROLE_KEY",
      ),
      cloudinaryApiKey: has("CLOUDINARY_API_KEY", "LPK_CLOUDINARY_API_KEY"),
      cloudinaryApiSecret: has("CLOUDINARY_API_SECRET", "LPK_CLOUDINARY_API_SECRET"),
      environment: process.env["NODE_ENV"] ?? "unknown",
    };
  },
);
