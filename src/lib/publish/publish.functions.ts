import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Publish materi/ujian di SERVER + notifikasi otomatis (Sprint 20.4).
 * Notifikasi hanya dibuat pada transisi nyata unpublished -> published.
 * Tenant diambil dari profil pemanggil, tidak pernah dari client.
 */

const schema = z.object({
  kind: z.enum(["exam", "lesson"]),
  id: z.string().uuid(),
});

export type PublishContentPayload = z.infer<typeof schema>;

const STAFF = ["owner", "admin", "guru"] as const;
const AUDIENCE = ["admin", "guru", "siswa"] as const;

export const publishContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const { insertNotificationAndPush } = await import("@/lib/push/notification-create.server");

    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");
    if (!(STAFF as readonly string[]).includes(caller.role)) {
      throw new Error("Anda tidak memiliki akses untuk mempublish konten.");
    }

    const table = data.kind === "exam" ? "exams" : "lessons";
    const { data: row } = await admin
      .from(table)
      .select("id, title, status, tenant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Konten tidak ditemukan.");

    const contentTenantId = (row["tenant_id"] as string | null) ?? null;
    // Publish SELALU tenant-scoped: caller wajib punya tenant, termasuk Owner.
    if (!caller.tenantId) {
      throw new Error("Owner belum memiliki tenant. Hubungi administrator platform.");
    }
    if (contentTenantId !== caller.tenantId) {
      throw new Error("Konten ini bukan milik tenant Anda.");
    }

    const wasPublished = row["status"] === "published";

    if (!wasPublished) {
      const patch: Record<string, unknown> =
        data.kind === "lesson"
          ? { status: "published", updated_by: caller.id }
          : { status: "published" };
      const { error } = await admin.from(table).update(patch).eq("id", data.id);
      if (error) throw new Error(`Gagal mempublish konten: ${error.message}`);
    }

    // Re-publish / edit konten yang sudah published: tanpa notifikasi.
    if (wasPublished) return { published: true, notified: false, notifications: 0 };

    const tenantId = caller.tenantId;
    const title = (row["title"] as string | null) ?? "";

    const payload =
      data.kind === "lesson"
        ? {
            type: "material" as const,
            title: "Materi baru tersedia",
            message: `Materi ${title} sudah tersedia untuk dipelajari.`,
            actionUrl: `/materi/lesson/${data.id}`,
          }
        : {
            type: "exam" as const,
            title: "Ujian baru tersedia",
            message: `Ujian ${title} sudah tersedia. Yuk coba sekarang!`,
            actionUrl: "/ujian",
          };

    // Owner yang mempublish tidak menerima notifikasi: audience dibatasi
    // ke admin/guru/siswa (scoped untuk event ini saja).
    let notifications = 0;
    for (const role of AUDIENCE) {
      try {
        await insertNotificationAndPush(admin, {
          tenantId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          actionUrl: payload.actionUrl,
          targetRole: role,
          targetUserId: null,
          createdBy: caller.id,
        });
        notifications += 1;
      } catch (notifyError) {
        // Kegagalan notifikasi tidak membatalkan publish.
        console.error("Notifikasi publish gagal:", (notifyError as Error).message);
      }
    }

    return { published: true, notified: notifications > 0, notifications };
  });
