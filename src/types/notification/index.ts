export const NOTIFICATION_TYPES = [
  "material",
  "exam",
  "announcement",
  "maintenance",
  "system",
  "update",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  material: "Materi",
  exam: "Ujian",
  announcement: "Pengumuman",
  maintenance: "Maintenance",
  system: "Sistem",
  update: "Update",
};

/** Baris tabel public.notifications */
export type NotificationRow = {
  id: string;
  tenant_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  target_role: string | null;
  target_user_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** Notifikasi + status baca milik user aktif. */
export type NotificationItem = NotificationRow & { readAt: string | null };
