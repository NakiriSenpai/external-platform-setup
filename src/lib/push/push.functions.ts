import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { NOTIFICATION_TYPES } from "@/types/notification";

/**
 * Server function notifikasi: pembuatan notifikasi (in-app) + delivery push.
 * Modul ini client-reachable, sehingga import server-only dilakukan DI DALAM handler.
 */

const createSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(500),
  actionUrl: z.string().trim().max(500).nullable().optional(),
  targetRole: z.enum(["owner", "admin", "guru", "siswa"]).nullable().optional(),
  targetUserId: z.string().uuid().nullable().optional(),
});

export type CreateNotificationPayload = z.infer<typeof createSchema>;

const STAFF = ["owner", "admin", "guru"] as const;

/**
 * Membuat notifikasi baru (satu record) lalu mencoba mengirim push.
 * Kegagalan push TIDAK membatalkan notifikasi in-app.
 */
export const createNotification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const { insertNotificationAndPush } = await import("@/lib/push/notification-create.server");

    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");
    if (!(STAFF as readonly string[]).includes(caller.role)) {
      throw new Error("Hanya Pemilik, Admin, atau Guru yang dapat mengirim notifikasi.");
    }

    // Tenant SELALU dari profil pemanggil (bukan payload client).
    if (caller.role === "owner" && !caller.tenantId) {
      throw new Error("Owner belum memiliki tenant. Hubungi administrator platform.");
    }
    const tenantId = caller.tenantId;
    if (!tenantId) {
      throw new Error("Akun Anda belum terhubung ke tenant. Hubungi administrator platform.");
    }

    return insertNotificationAndPush(admin, {
      tenantId,
      type: data.type,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl ?? null,
      targetRole: data.targetRole ?? null,
      targetUserId: data.targetUserId ?? null,
      createdBy: caller.id,
    });
  });


/** Mengirim ulang push untuk notifikasi yang sudah ada (tenant diverifikasi server-side). */
export const sendPushForNotification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ notificationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const { deliverPushForNotification } = await import("@/lib/push/push-sender.server");

    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");
    if (!(STAFF as readonly string[]).includes(caller.role)) {
      throw new Error("Tidak diizinkan mengirim notifikasi.");
    }

    const { data: row } = await admin
      .from("notifications")
      .select("id, tenant_id, type, title, message, action_url, target_role, target_user_id")
      .eq("id", data.notificationId)
      .maybeSingle();

    if (!row) throw new Error("Notifikasi tidak ditemukan.");

    // Tenant caller SELALU wajib, termasuk Owner (tidak ada owner global bypass).
    if (!caller.tenantId) {
      throw new Error("Owner belum memiliki tenant. Hubungi administrator platform.");
    }
    const rowTenantId = (row["tenant_id"] as string | null) ?? null;
    if (rowTenantId === null || rowTenantId !== caller.tenantId) {
      throw new Error("Notifikasi ini bukan milik tenant Anda.");
    }

    return deliverPushForNotification(admin, row as never);
  });

/** Status ketersediaan konfigurasi VAPID di server (boolean saja). */
export const getPushServerStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { vapidConfigStatus } = await import("@/lib/push/vapid.server");
  return vapidConfigStatus();
});
