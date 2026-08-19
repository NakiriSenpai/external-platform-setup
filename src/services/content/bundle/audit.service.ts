/**
 * Sprint 13 — Audit metadata Import/Export.
 * Hanya metadata (user, action, entity, count, result). Isi bundle TIDAK disimpan.
 */
import { supabase } from "@/lib/supabase/client";

export type ContentIoAction =
  | "export_question_bundle"
  | "import_question_bundle"
  | "export_exam"
  | "import_exam"
  | "export_lesson"
  | "import_lesson"
  | "publish_blocked";

export async function recordContentIoAudit(params: {
  action: ContentIoAction;
  entity: string;
  count: number;
  result: "success" | "partial" | "failed" | "blocked";
  detail?: Record<string, number | string | null>;
}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    await supabase.from("content_io_audit").insert({
      user_id: userId,
      tenant_id: (profile as { tenant_id: string | null } | null)?.tenant_id ?? null,
      action: params.action,
      entity: params.entity,
      item_count: params.count,
      result: params.result,
      detail: params.detail ?? null,
    });
  } catch {
    // Audit tidak boleh memblok alur konten.
  }
}
