import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/** URL Supabase pada runtime server (lentur terhadap penamaan env). */
export function serverSupabaseUrl(): string {
  return process.env["LPK_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? env.supabaseUrl;
}

function serviceKey(): string {
  const key =
    process.env["LPK_SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["LPK_SERVICE_ROLE_KEY"];
  if (!key) {
    throw new Error(
      "Konfigurasi server belum lengkap: secret LPK_SUPABASE_SERVICE_ROLE_KEY belum tersedia di runtime ini.",
    );
  }
  return key;
}

/** Klien service role (bypass RLS). Hanya untuk operasi terverifikasi di server. */
export function createAdminClient(): SupabaseClient {
  const key = serviceKey();
  return createClient(serverSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Kunci format `sb_secret_` bukan JWT: hanya dikirim lewat header apikey.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export type CallerProfile = {
  id: string;
  role: "owner" | "admin" | "guru" | "siswa";
  tenantId: string | null;
};

/**
 * Verifikasi pemanggil server function berdasarkan Bearer token pada request,
 * lalu ambil profilnya sebagai sumber kebenaran role & tenant.
 */
export async function verifyCaller(
  admin: SupabaseClient,
  authorizationHeader: string,
): Promise<CallerProfile> {
  const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");

  const response = await fetch(`${serverSupabaseUrl().replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: serviceKey(), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Sesi tidak valid. Silakan masuk kembali.");

  const user = (await response.json()) as { id?: string };
  if (!user.id) throw new Error("Sesi tidak valid. Silakan masuk kembali.");

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, tenant_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active !== true) {
    throw new Error("Akun Anda tidak aktif atau tidak ditemukan.");
  }

  return {
    id: profile.id as string,
    role: profile.role as CallerProfile["role"],
    tenantId: (profile.tenant_id as string | null) ?? null,
  };
}
