/**
 * "Ingat saya" hanya mengatur umur sesi di perangkat ini.
 * Tidak mengubah mekanisme Supabase Auth: kredensial tidak pernah disimpan.
 */
import { isStandaloneApp } from "@/lib/utils/app-mode";

// Preferensi disimpan per environment agar browser dan aplikasi standalone
// (APK/TWA) tidak saling menimpa session-nya.
const scope = () => (isStandaloneApp() ? "app" : "browser");
const REMEMBER_KEY = () => `ium.remember.${scope()}`;
const IDENTIFIER_KEY = () => `ium.remember.identifier.${scope()}`;
const TAB_KEY = () => `ium.session-alive.${scope()}`;

export function setRememberPreference(remember: boolean, identifier?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_KEY(), remember ? "1" : "0");
  if (remember && identifier) window.localStorage.setItem(IDENTIFIER_KEY(), identifier);
  if (!remember) window.localStorage.removeItem(IDENTIFIER_KEY());
  window.sessionStorage.setItem(TAB_KEY(), "1");
}

export function getRememberPreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_KEY()) !== "0";
}

export function getRememberedIdentifier(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(IDENTIFIER_KEY()) ?? "";
}

/**
 * True bila sesi sebelumnya dibuat tanpa "Ingat saya" dan browser sudah ditutup
 * (penanda sessionStorage hilang) — sesi harus diakhiri.
 */
export function shouldDropSessionOnBoot(): boolean {
  if (typeof window === "undefined") return false;
  const remembered = window.localStorage.getItem(REMEMBER_KEY()) !== "0";
  const tabAlive = window.sessionStorage.getItem(TAB_KEY()) === "1";
  window.sessionStorage.setItem(TAB_KEY(), "1");
  return !remembered && !tabAlive;
}
