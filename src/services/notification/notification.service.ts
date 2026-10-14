import { supabase } from "@/lib/supabase/client";
import type { NotificationItem, NotificationRow } from "@/types/notification";

const COLUMNS =
  "id, tenant_id, type, title, message, action_url, metadata, target_role, target_user_id, created_by, created_at";

/**
 * Daftar notifikasi untuk user aktif.
 * Isolasi tenant & target dijalankan oleh RLS di database (bukan filter frontend).
 */
export async function listMyNotifications(limit = 50): Promise<NotificationItem[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  // Sprint 30: RPC memberi Owner cakupan seluruh tenant (sesuai is_owner())
  // dan menyembunyikan notifikasi yang sudah dihapus. Fallback ke tabel bila
  // SQL belum dijalankan.
  let rows: NotificationRow[];
  const rpc = await supabase.rpc("list_my_notifications", { p_limit: limit });
  if (!rpc.error) {
    rows = (rpc.data as NotificationRow[] | null) ?? [];
  } else {
    const { data, error } = await supabase
      .from("notifications")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("Gagal memuat notifikasi.");
    rows = (data as NotificationRow[] | null) ?? [];
  }
  if (rows.length === 0) return [];

  const { data: reads } = await supabase
    .from("notification_reads")
    .select("notification_id, read_at")
    .eq("user_id", userId)
    .in(
      "notification_id",
      rows.map((row) => row.id),
    );

  const readMap = new Map<string, string>(
    ((reads as { notification_id: string; read_at: string }[] | null) ?? []).map((r) => [
      r.notification_id,
      r.read_at,
    ]),
  );

  return rows.map((row) => ({ ...row, readAt: readMap.get(row.id) ?? null }));
}

/** Tandai satu notifikasi sebagai sudah dibaca. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from("notification_reads")
    .upsert(
      { notification_id: notificationId, user_id: userId, read_at: new Date().toISOString() },
      { onConflict: "notification_id,user_id" },
    );
  if (error) throw new Error("Gagal menandai notifikasi.");
}

/** Tandai seluruh notifikasi yang terlihat sebagai sudah dibaca. */
export async function markAllNotificationsRead(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  const now = new Date().toISOString();
  const { error } = await supabase.from("notification_reads").upsert(
    ids.map((id) => ({ notification_id: id, user_id: userId, read_at: now })),
    { onConflict: "notification_id,user_id" },
  );
  if (error) throw new Error("Gagal menandai semua notifikasi.");
}

/**
 * Hapus (soft delete) notifikasi beserta salinan per-role dari aktivitas yang
 * sama. Data sumber (ujian/materi/pengumuman) tidak disentuh. Izin divalidasi
 * di database.
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_notification", { p_notification_id: notificationId });
  if (error) {
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      throw new Error("Hapus notifikasi belum aktif: SQL Sprint 30 belum dijalankan.");
    }
    throw new Error(error.message || "Gagal menghapus notifikasi.");
  }
}
