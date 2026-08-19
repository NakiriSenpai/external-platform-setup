import { ApplicationServerKeys } from "webpush-webcrypto";

/**
 * Konfigurasi VAPID sisi SERVER (Cloudflare Worker / runtime SSR).
 *
 * Variabel yang dibaca:
 * - VAPID_PUBLIC_KEY   (fallback: VITE_PUSH_VAPID_PUBLIC_KEY) — publishable
 * - VAPID_PRIVATE_KEY  — SECRET, server-only, tidak pernah keluar dari file ini
 * - VAPID_SUBJECT      — SECRET/konfigurasi server (mailto: atau https://)
 *
 * File ini bernama *.server.ts sehingga diblokir dari client bundle.
 */

function readEnv(...names: readonly string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type VapidConfig = {
  keys: ApplicationServerKeys;
  /** Nilai `sub` pada JWT VAPID (mailto: atau https://). */
  subject: string;
};

/** Status konfigurasi (boolean saja — nilai secret tidak pernah dibocorkan). */
export function vapidConfigStatus(): {
  publicKey: boolean;
  privateKey: boolean;
  subject: boolean;
} {
  return {
    publicKey: Boolean(readEnv("VAPID_PUBLIC_KEY", "VITE_PUSH_VAPID_PUBLIC_KEY")),
    privateKey: Boolean(readEnv("VAPID_PRIVATE_KEY")),
    subject: Boolean(readEnv("VAPID_SUBJECT")),
  };
}

/**
 * Memuat pasangan kunci VAPID dari environment.
 * Mendukung dua format private key yang umum:
 * - raw 32 byte base64url (output `web-push generate-vapid-keys`)
 * - PKCS#8 base64url
 */
export async function loadVapidConfig(): Promise<VapidConfig> {
  const publicKey = readEnv("VAPID_PUBLIC_KEY", "VITE_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = readEnv("VAPID_PRIVATE_KEY");
  const subject = readEnv("VAPID_SUBJECT");

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Konfigurasi Web Push belum lengkap di server: butuh VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, dan VAPID_SUBJECT.",
    );
  }
  if (!/^mailto:|^https:\/\//i.test(subject)) {
    throw new Error("VAPID_SUBJECT harus berupa 'mailto:...' atau URL https://.");
  }

  const privateBytes = base64UrlToBytes(privateKey);

  if (privateBytes.length !== 32) {
    // Format PKCS#8 — dapat langsung dipakai library.
    return { keys: await ApplicationServerKeys.fromJSON({ publicKey, privateKey }), subject };
  }

  // Format raw: rakit JWK dari titik publik (0x04 || x || y) + skalar privat d.
  const publicBytes = base64UrlToBytes(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY tidak valid (harus P-256 uncompressed base64url).");
  }

  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToBase64Url(publicBytes.slice(1, 33)),
    y: bytesToBase64Url(publicBytes.slice(33, 65)),
    ext: true,
  };

  const cryptoPublicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    [],
  );
  const cryptoPrivateKey = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, d: bytesToBase64Url(privateBytes), key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );

  return { keys: new ApplicationServerKeys(cryptoPublicKey, cryptoPrivateKey), subject };
}
