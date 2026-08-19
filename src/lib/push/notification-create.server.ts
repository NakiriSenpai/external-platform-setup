import type { SupabaseClient } from "@supabase/supabase-js";

import { deliverPushForNotification } from "@/lib/push/push-sender.server";
import type { NotificationType } from "@/types/notification";

/**
 * Helper server-only: insert notifikasi + kirim push.
 * Dipakai oleh server function notifikasi manual maupun event otomatis
 * (publish materi/ujian). Tidak ada implementasi push baru di sini.
 */

export type PushSummary = {
  subscriptions: number;
  sent: number;
  failed: number;
  removed: number;
  skippedReason: string;
};

export type NotificationInput = {
  tenantId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
  targetRole?: "owner" | "admin" | "guru" | "siswa" | null;
  targetUserId?: string | null;
  createdBy: string;
};

export async function insertNotificationAndPush(
  admin: SupabaseClient,
  input: NotificationInput,
): Promise<{ notificationId: string; push: PushSummary }> {
  const { data: inserted, error } = await admin
    .from("notifications")
    .insert({
      tenant_id: input.tenantId,
      type: input.type,
      title: input.title,
      message: input.message,
      action_url: input.actionUrl ?? null,
      target_role: input.targetRole ?? null,
      target_user_id: input.targetUserId ?? null,
      created_by: input.createdBy,
    })
    .select("id, tenant_id, type, title, message, action_url, target_role, target_user_id")
    .single();

  if (error || !inserted) throw new Error("Gagal membuat notifikasi.");

  let push: PushSummary = {
    subscriptions: 0,
    sent: 0,
    failed: 0,
    removed: 0,
    skippedReason: "unknown",
  };
  try {
    push = { skippedReason: "", ...(await deliverPushForNotification(admin, inserted as never)) };
  } catch (pushError) {
    // Push adalah channel tambahan: notifikasi in-app tetap tersimpan.
    console.error("Web Push gagal dikirim:", (pushError as Error).message);
    push = { subscriptions: 0, sent: 0, failed: 0, removed: 0, skippedReason: "push-error" };
  }

  return { notificationId: inserted["id"] as string, push };
}
