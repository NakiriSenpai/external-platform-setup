import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { isStandaloneApp } from "@/lib/utils/app-mode";

/**
 * Browser (Chrome) dan aplikasi terinstal (APK/TWA/PWA standalone) memakai origin
 * yang sama, sehingga localStorage-nya juga sama. Agar session tidak saling
 * mengambil, namespace penyimpanan session dipisah sejak client dibuat.
 */
export const AUTH_STORAGE_KEY_BROWSER = "ium-auth-browser";
export const AUTH_STORAGE_KEY_APP = "ium-auth-app";

/** Namespace session untuk environment saat ini (SSR dianggap browser). */
export function authStorageKey(): string {
  return isStandaloneApp() ? AUTH_STORAGE_KEY_APP : AUTH_STORAGE_KEY_BROWSER;
}

/** Key default Supabase (sb-<ref>-auth-token) untuk kompatibilitas mundur. */
function legacyStorageKey(): string | null {
  try {
    const ref = new URL(env.supabaseUrl).hostname.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

/**
 * Migrasi sekali jalan: session lama (key default Supabase) hanya diwariskan ke
 * namespace BROWSER. Aplikasi standalone tidak boleh mengambil session browser.
 * Key lama tidak dihapus agar tidak merusak environment lain.
 */
function migrateLegacySession(targetKey: string) {
  if (typeof window === "undefined") return;
  if (targetKey !== AUTH_STORAGE_KEY_BROWSER) return;
  try {
    const legacy = legacyStorageKey();
    if (!legacy) return;
    if (window.localStorage.getItem(targetKey)) return;
    const value = window.localStorage.getItem(legacy);
    if (value) window.localStorage.setItem(targetKey, value);
  } catch {
    /* storage tidak tersedia — abaikan */
  }
}

const storageKey = authStorageKey();
migrateLegacySession(storageKey);

/**
 * Klien Supabase eksternal (browser-safe, publishable key).
 * Satu-satunya instance auth untuk seluruh aplikasi.
 */
export const supabase: SupabaseClient = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storageKey,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
