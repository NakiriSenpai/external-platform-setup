import { supabase } from "@/lib/supabase/client";
import type {
  DiscussionComment,
  DiscussionNotificationEvent,
  DiscussionNotificationGroup,
} from "@/types/discussion";

/** Pesan ramah bila fungsi database Sprint 29 belum dipasang. */
export const DISCUSSION_NOT_READY = "Fitur diskusi belum aktif di server.";

function translate(error: { message?: string; code?: string } | null, fallback: string): Error {
  const message = error?.message ?? "";
  if (error?.code === "PGRST202" || error?.code === "42883" || /could not find the function/i.test(message)) {
    return new Error(DISCUSSION_NOT_READY);
  }
  return new Error(message || fallback);
}

export async function listExamDiscussion(input: {
  examId: string;
  questionId?: string | null;
  tenantId?: string | null;
}): Promise<DiscussionComment[]> {
  const { data, error } = await supabase.rpc("list_exam_discussion", {
    p_exam_id: input.examId,
    p_question_id: input.questionId ?? null,
    p_tenant_id: input.tenantId ?? null,
  });
  if (error) throw translate(error, "Gagal memuat diskusi.");
  return (data as DiscussionComment[] | null) ?? [];
}

export async function postExamComment(input: {
  examId: string;
  questionId: string;
  body: string;
  clientRequestId: string;
  parentId?: string | null;
  answerLabel?: string | null;
  tenantId?: string | null;
}): Promise<string> {
  const body = input.body.trim();
  if (!body) throw new Error("Komentar tidak boleh kosong.");
  const { data, error } = await supabase.rpc("post_exam_comment", {
    p_exam_id: input.examId,
    p_question_id: input.questionId,
    p_body: body,
    p_client_request_id: input.clientRequestId,
    p_parent_id: input.parentId ?? null,
    p_answer_label: input.answerLabel ?? null,
    p_tenant_id: input.tenantId ?? null,
  });
  if (error) throw translate(error, "Gagal mengirim komentar.");
  return data as string;
}

export async function editExamComment(commentId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Komentar tidak boleh kosong.");
  const { error } = await supabase.rpc("edit_exam_comment", {
    p_comment_id: commentId,
    p_body: trimmed,
  });
  if (error) throw translate(error, "Gagal mengedit komentar.");
}

export async function deleteExamComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_exam_comment", { p_comment_id: commentId });
  if (error) throw translate(error, "Gagal menghapus komentar.");
}

/** Kelompok notifikasi diskusi. Kosong (bukan error) bila server belum siap. */
export async function listDiscussionGroups(): Promise<DiscussionNotificationGroup[]> {
  const { data, error } = await supabase.rpc("list_discussion_notification_groups");
  if (error) {
    if (translate(error, "").message === DISCUSSION_NOT_READY) return [];
    throw translate(error, "Gagal memuat notifikasi diskusi.");
  }
  return (data as DiscussionNotificationGroup[] | null) ?? [];
}

export async function listDiscussionEvents(groupId: string): Promise<DiscussionNotificationEvent[]> {
  const { data, error } = await supabase.rpc("list_discussion_notification_events", {
    p_group_id: groupId,
  });
  if (error) throw translate(error, "Gagal memuat detail notifikasi.");
  return (data as DiscussionNotificationEvent[] | null) ?? [];
}

export async function markDiscussionGroupRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_discussion_group_read", { p_group_id: groupId });
  if (error) throw translate(error, "Gagal menandai notifikasi.");
}

export async function deleteDiscussionGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_discussion_notification_group", {
    p_group_id: groupId,
  });
  if (error) throw translate(error, "Gagal menghapus notifikasi.");
}
