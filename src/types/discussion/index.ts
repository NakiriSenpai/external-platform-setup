/** Tipe domain Diskusi Soal & notifikasi berkelompok (Sprint 29). */

export type DiscussionComment = {
  id: string;
  tenant_id: string;
  exam_id: string;
  question_id: string;
  question_number: number | null;
  /** Label asli pilihan (identitas stabil, tidak terpengaruh shuffle). */
  answer_label: "A" | "B" | "C" | "D" | null;
  parent_id: string | null;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type DiscussionNode = DiscussionComment & { replies: DiscussionNode[] };

export type DiscussionNotificationGroup = {
  group_id: string;
  tenant_id: string;
  exam_id: string;
  exam_title: string;
  activity_count: number;
  unread_count: number;
  last_activity_at: string;
};

export type DiscussionNotificationEvent = {
  event_id: string;
  comment_id: string;
  question_id: string;
  question_number: number | null;
  kind: "comment" | "reply";
  actor_name: string;
  parent_author_name: string | null;
  created_at: string;
  is_unread: boolean;
};
