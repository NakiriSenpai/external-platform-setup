import type { FeatureFlagKey } from "@/lib/config/feature-flags";

/** Baris tabel public.app_settings (singleton konfigurasi global). */
export type AppSettingsRow = {
  id: boolean;
  app_name: string;
  short_name: string;
  tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  login_branding: string | null;
  support_email: string | null;
  maintenance_enabled: boolean;
  maintenance_message: string;
  maintenance_started_at: string | null;
  app_version: string;
  updated_at: string;
  updated_by: string | null;
};

/** Kontrak konfigurasi aplikasi yang dipakai UI (satu-satunya sumber branding). */
export type AppConfig = {
  appName: string;
  shortName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  loginBranding: string | null;
  supportEmail: string | null;
  maintenance: MaintenanceState;
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type MaintenanceState = {
  enabled: boolean;
  message: string;
  startedAt: string | null;
};

/** Payload branding yang boleh diubah Owner. */
export type BrandingInput = {
  appName: string;
  shortName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  loginBranding: string | null;
  supportEmail: string | null;
};

export type MaintenanceInput = {
  enabled: boolean;
  message: string;
};

export type FeatureFlagScope = "global" | "tenant";

export type FeatureFlagRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: FeatureFlagScope;
  tenant_id: string | null;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type FeatureFlagState = Record<string, boolean>;

export type { FeatureFlagKey };
