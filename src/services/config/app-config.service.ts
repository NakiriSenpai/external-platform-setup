import { supabase } from "@/lib/supabase/client";
import { DEFAULT_APP_CONFIG, toAppConfig } from "@/lib/config/defaults";
import type { AppConfig, AppSettingsRow, BrandingInput, MaintenanceInput } from "@/types/config";

const COLUMNS =
  "id, app_name, short_name, tagline, logo_url, favicon_url, primary_color, secondary_color, accent_color, background_color, login_branding, support_email, maintenance_enabled, maintenance_message, maintenance_started_at, app_version, updated_at, updated_by";

/**
 * Konfigurasi global aplikasi.
 * Bila tabel belum tersedia (migration belum dijalankan), aplikasi tetap jalan
 * dengan konfigurasi bawaan agar UI existing tidak rusak.
 */
export async function getAppConfig(): Promise<AppConfig> {
  const { data, error } = await supabase.from("app_settings").select(COLUMNS).maybeSingle();
  if (error) return DEFAULT_APP_CONFIG;
  return toAppConfig((data as AppSettingsRow | null) ?? null);
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Simpan branding global (RLS: hanya Owner). */
export async function updateBranding(input: BrandingInput): Promise<AppConfig> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("app_settings")
    .update({
      app_name: input.appName,
      short_name: input.shortName,
      tagline: input.tagline,
      logo_url: input.logoUrl,
      favicon_url: input.faviconUrl,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
      accent_color: input.accentColor,
      login_branding: input.loginBranding,
      support_email: input.supportEmail,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", true)
    .select(COLUMNS)
    .maybeSingle();

  if (error || !data) throw new Error("Gagal menyimpan branding aplikasi.");
  return toAppConfig(data as AppSettingsRow);
}

/** Aktifkan / nonaktifkan maintenance mode (RLS: hanya Owner). */
export async function updateMaintenance(input: MaintenanceInput): Promise<AppConfig> {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("app_settings")
    .update({
      maintenance_enabled: input.enabled,
      maintenance_message: input.message,
      maintenance_started_at: input.enabled ? now : null,
      updated_at: now,
      updated_by: userId,
    })
    .eq("id", true)
    .select(COLUMNS)
    .maybeSingle();

  if (error || !data) throw new Error("Gagal memperbarui mode pemeliharaan.");
  return toAppConfig(data as AppSettingsRow);
}
