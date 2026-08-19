import { supabase } from "@/lib/supabase/client";

/**
 * Web Push standar (Service Worker + VAPID) — tanpa Firebase.
 * Kompatibel dengan PWA + Cloudflare + Supabase eksternal yang sudah dipakai project.
 * Kunci publik VAPID dibaca dari VITE_PUSH_VAPID_PUBLIC_KEY (publishable, aman di client).
 */
export const vapidPublicKey = (
  (import.meta.env as Record<string, string | undefined>)["VITE_PUSH_VAPID_PUBLIC_KEY"] ?? ""
).trim();

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Meminta izin lalu menyimpan subscription milik user aktif.
 * tenant_id sengaja tidak dikirim dari client — pengirim push me-resolve tenant
 * dari `profiles` saat pengiriman agar tetap tenant-aware.
 */
export async function enablePushNotifications(): Promise<"granted" | "denied" | "unsupported"> {
  if (!isPushSupported() || !vapidPublicKey) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId || !json.endpoint || !json.keys) return "denied";

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys["p256dh"] ?? "",
      auth: json.keys["auth"] ?? "",
      user_agent: navigator.userAgent.slice(0, 300),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  return "granted";
}
