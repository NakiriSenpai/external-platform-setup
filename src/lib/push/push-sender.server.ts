import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePushHTTPRequest } from "webpush-webcrypto";

import { loadVapidConfig } from "@/lib/push/vapid.server";

/**
 * Pengirim Web Push (server-only).
 *
 * Alur: notifications → resolve penerima (tenant-scoped) → push_subscriptions
 * → payload → VAPID signing → Web Push Service → device.
 *
 * Semua query memakai service role dan tenant DIVERIFIKASI di server;
 * tenant_id tidak pernah diterima dari client.
 */

export type PushNotificationRow = {
  id: string;
  tenant_id: string | null;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  target_role: string | null;
  target_user_id: string | null;
};

export type PushDeliveryResult = {
  subscriptions: number;
  sent: number;
  failed: number;
  removed: number;
  skippedReason?: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  tenant_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Penerima notifikasi berdasarkan target audience yang sudah ada di tabel notifications. */
async function resolveRecipientIds(
  admin: SupabaseClient,
  notification: PushNotificationRow,
): Promise<string[]> {
  if (notification.target_user_id) {
    // Tetap verifikasi tenant user target terhadap tenant notifikasi.
    const { data } = await admin
      .from("profiles")
      .select("id, tenant_id, is_active")
      .eq("id", notification.target_user_id)
      .maybeSingle();
    if (!data || data["is_active"] !== true) return [];
    if (notification.tenant_id && data["tenant_id"] !== notification.tenant_id) return [];
    return [data["id"] as string];
  }

  let query = admin.from("profiles").select("id").eq("is_active", true);
  if (notification.tenant_id) query = query.eq("tenant_id", notification.tenant_id);
  if (notification.target_role) query = query.eq("role", notification.target_role);

  const { data } = await query.limit(5000);
  return ((data as { id: string }[] | null) ?? []).map((row) => row.id);
}

function buildPayload(notification: PushNotificationRow): string {
  return JSON.stringify({
    title: notification.title,
    body: notification.message,
    icon: "/favicon.png",
    badge: "/favicon.png",
    url: notification.action_url ?? "/",
    tag: `notif-${notification.id}`,
    notificationId: notification.id,
    type: notification.type,
  });
}

/**
 * Mengirim push untuk satu baris notifikasi ke SEMUA subscription valid milik
 * penerima (multi-device). Subscription mati (404/410) dihapus dari database.
 */
export async function deliverPushForNotification(
  admin: SupabaseClient,
  notification: PushNotificationRow,
): Promise<PushDeliveryResult> {
  const recipients = await resolveRecipientIds(admin, notification);
  if (recipients.length === 0) {
    return { subscriptions: 0, sent: 0, failed: 0, removed: 0, skippedReason: "no-recipient" };
  }

  const { data: subsData } = await admin
    .from("push_subscriptions")
    .select("id, user_id, tenant_id, endpoint, p256dh, auth")
    .in("user_id", recipients);

  const subscriptions = ((subsData as SubscriptionRow[] | null) ?? []).filter((sub) => {
    // Guard tenant kedua: subscription lintas tenant tidak pernah dikirimi.
    if (!notification.tenant_id) return true;
    return sub.tenant_id === null || sub.tenant_id === notification.tenant_id;
  });

  if (subscriptions.length === 0) {
    return { subscriptions: 0, sent: 0, failed: 0, removed: 0, skippedReason: "no-subscription" };
  }

  const { keys, subject } = await loadVapidConfig();
  const payload = buildPayload(notification);

  let sent = 0;
  let failed = 0;
  const deadEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const { headers, body, endpoint } = await generatePushHTTPRequest({
          applicationServerKeys: keys,
          payload,
          target: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          adminContact: subject,
          ttl: 60 * 60 * 24,
          urgency: "normal",
        });

        const response = await fetch(endpoint, { method: "POST", headers, body });
        if (response.ok) {
          sent += 1;
          return;
        }
        failed += 1;
        if (response.status === 404 || response.status === 410) deadEndpoints.push(sub.endpoint);
      } catch {
        failed += 1;
      }
    }),
  );

  let removed = 0;
  if (deadEndpoints.length > 0) {
    const { error } = await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    if (!error) removed = deadEndpoints.length;
  }

  return { subscriptions: subscriptions.length, sent, failed, removed };
}
