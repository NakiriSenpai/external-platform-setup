import { supabase } from "@/lib/supabase/client";
import { migrateExplanationText, type RefIssue } from "@/lib/choice-reference";

/** Satu field pembahasan yang akan diubah. */
export type MigrationChange = {
  question_id: string;
  /** null = pembahasan umum soal; terisi = pembahasan pilihan (label stabil). */
  answer_label: string | null;
  original: string;
  migrated: string;
  mapped: number;
};

export type QuestionMigrationStatus = "siap" | "sebagian" | "konflik" | "tidak-pasti" | "tanpa-referensi";

export type QuestionMigrationReport = {
  question_id: string;
  preview: string;
  exams: string[];
  status: QuestionMigrationStatus;
  mapped: number;
  changes: MigrationChange[];
  issues: (RefIssue & { field: string })[];
};

export type MigrationPreview = {
  generatedAt: string;
  totalQuestions: number;
  reports: QuestionMigrationReport[];
};

type RawAnswer = { label: string; text: string | null; explanation?: string | null };
type RawQuestion = {
  id: string;
  text: string | null;
  explanation: string | null;
  answers: RawAnswer[] | null;
  usage: { exam: { title: string } | null }[] | null;
};

const PAGE = 500;

/**
 * Pratinjau migrasi (READ ONLY): membaca seluruh soal yang dapat diakses
 * Owner dan menghitung perubahan. Tidak ada data yang ditulis.
 */
export async function buildExplanationMigrationPreview(): Promise<MigrationPreview> {
  const rows: RawQuestion[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("questions")
      .select(
        "id, text, explanation, answers:question_answers(label, text, explanation), usage:exam_questions(exam:exams(title))",
      )
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal membaca soal: ${error.message}`);
    const batch = (data as unknown as RawQuestion[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  const reports = rows.map((q): QuestionMigrationReport => {
    const answers = (q.answers ?? []).map((a) => ({ label: a.label, text: a.text }));
    const fields: { label: string | null; name: string; value: string | null }[] = [
      { label: null, name: "Pembahasan", value: q.explanation },
      ...(q.answers ?? [])
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((a, i) => ({ label: a.label, name: `Pembahasan pilihan ${i + 1}`, value: a.explanation ?? null })),
    ];

    const changes: MigrationChange[] = [];
    const issues: QuestionMigrationReport["issues"] = [];
    for (const field of fields) {
      if (!field.value) continue;
      const result = migrateExplanationText(field.value, answers);
      issues.push(...result.issues.map((issue) => ({ ...issue, field: field.name })));
      if (result.mapped > 0 && result.migrated !== result.original) {
        changes.push({
          question_id: q.id,
          answer_label: field.label,
          original: result.original,
          migrated: result.migrated,
          mapped: result.mapped,
        });
      }
    }

    const mapped = changes.reduce((sum, c) => sum + c.mapped, 0);
    const hasConflict = issues.some((i) => i.kind === "conflict");
    const status: QuestionMigrationStatus = hasConflict
      ? "konflik"
      : mapped > 0 && issues.length > 0
        ? "sebagian"
        : mapped > 0
          ? "siap"
          : issues.length > 0
            ? "tidak-pasti"
            : "tanpa-referensi";

    const exams = Array.from(
      new Set((q.usage ?? []).map((u) => u.exam?.title).filter((t): t is string => !!t)),
    );
    return {
      question_id: q.id,
      preview: (q.text ?? "").replace(/<[^>]+>/g, "").slice(0, 80),
      exams,
      status,
      mapped,
      changes,
      issues,
    };
  });

  return { generatedAt: new Date().toISOString(), totalQuestions: rows.length, reports };
}

/**
 * Terapkan perubahan lewat RPC SECURITY DEFINER (backup + cek teks asli).
 * Hanya tersedia setelah SQL Sprint 30 disetujui dan dijalankan.
 */
export async function applyExplanationMigration(
  changes: MigrationChange[],
): Promise<{ applied: number; skipped: number; runId: string }> {
  const { data, error } = await supabase.rpc("apply_explanation_migration", {
    p_changes: changes.map((c) => ({
      question_id: c.question_id,
      answer_label: c.answer_label,
      original: c.original,
      migrated: c.migrated,
    })),
  });
  if (error) {
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      throw new Error("Fitur terapkan belum aktif: SQL Sprint 30 belum dijalankan di database.");
    }
    throw new Error(`Gagal menerapkan migrasi: ${error.message}`);
  }
  const row = (data as { applied: number; skipped: number; run_id: string } | null) ?? {
    applied: 0,
    skipped: 0,
    run_id: "",
  };
  return { applied: row.applied, skipped: row.skipped, runId: row.run_id };
}
