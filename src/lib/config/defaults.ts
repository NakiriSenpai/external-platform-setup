import { appConfig } from "@/lib/env";
import type { AppConfig, AppSettingsRow } from "@/types/config";

/**
 * Konfigurasi bawaan = branding aplikasi saat ini.
 * Warna bernilai null berarti memakai design token bawaan (tidak menimpa UI).
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  appName: appConfig.name,
  shortName: appConfig.shortName,
  tagline: appConfig.description,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  backgroundColor: null,
  loginBranding: null,
  supportEmail: null,
  maintenance: {
    enabled: false,
    message: "Aplikasi sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.",
    startedAt: null,
  },
  version: "1.0.0",
  updatedAt: null,
  updatedBy: null,
};

const text = (value: string | null | undefined, fallback: string) =>
  value && value.trim().length > 0 ? value.trim() : fallback;

const nullable = (value: string | null | undefined) =>
  value && value.trim().length > 0 ? value.trim() : null;

/** Mapping baris database → kontrak AppConfig. */
export function toAppConfig(row: AppSettingsRow | null): AppConfig {
  if (!row) return DEFAULT_APP_CONFIG;
  return {
    appName: text(row.app_name, DEFAULT_APP_CONFIG.appName),
    shortName: text(row.short_name, DEFAULT_APP_CONFIG.shortName),
    tagline: text(row.tagline, DEFAULT_APP_CONFIG.tagline),
    logoUrl: nullable(row.logo_url),
    faviconUrl: nullable(row.favicon_url),
    primaryColor: nullable(row.primary_color),
    secondaryColor: nullable(row.secondary_color),
    accentColor: nullable(row.accent_color),
    backgroundColor: nullable(row.background_color),
    loginBranding: nullable(row.login_branding),
    supportEmail: nullable(row.support_email),
    maintenance: {
      enabled: Boolean(row.maintenance_enabled),
      message: text(row.maintenance_message, DEFAULT_APP_CONFIG.maintenance.message),
      startedAt: row.maintenance_started_at ?? null,
    },
    version: text(row.app_version, DEFAULT_APP_CONFIG.version),
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
  };
}
