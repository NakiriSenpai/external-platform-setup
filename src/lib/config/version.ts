/**
 * Version contract — satu-satunya sumber versi aplikasi di sisi klien.
 * Versi runtime dari database (app_settings.app_version) menimpa nilai ini
 * bila tersedia.
 */
export const APP_VERSION = "1.0.0";

export const BUILD_ID: string =
  (import.meta.env as Record<string, string | undefined>)["VITE_BUILD_ID"] ??
  `${new Date().getUTCFullYear()}.${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;

export type AppEnvironment = "development" | "staging" | "production";

export function resolveEnvironment(): AppEnvironment {
  const explicit = (import.meta.env as Record<string, string | undefined>)["VITE_APP_ENV"];
  if (explicit === "staging" || explicit === "production" || explicit === "development") {
    return explicit;
  }
  return import.meta.env.PROD ? "production" : "development";
}

export const ENVIRONMENT_LABEL: Record<AppEnvironment, string> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
};
