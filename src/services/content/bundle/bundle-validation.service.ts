/**
 * Sprint 13 — Content Validation Service (reusable).
 * Dipakai untuk Import preview, dan sebagai gate sebelum Publish.
 * ERROR memblok publish, WARNING tidak memblok.
 */
import { supabase } from "@/lib/supabase/client";
import { EXAM_TABLES } from "@/types/exam";
import { LESSON_TABLES } from "@/types/lesson";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  severity: ValidationSeverity;
  scope: string;
  message: string;
};

export type ValidationReport = {
  checks: { label: string; ok: boolean }[];
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  canPublish: boolean;
};

type QuestionLike = {
  id?: string;
  text: string;
  image_url: string | null;
  audio_url: string | null;
  question_type: string | null;
  visibility: string | null;
  is_archived?: boolean | null;
  answers: { text: string | null; image_url: string | null; is_correct: boolean }[];
};

const VALID_TYPES = ["reading", "listening", "grammar", "vocabulary", "conversation", "mixed"];
const VALID_VISIBILITY = ["private", "public"];

function buildReport(checks: { label: string; ok: boolean }[], issues: ValidationIssue[]): ValidationReport {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return { checks, issues, errorCount, warningCount, canPublish: errorCount === 0 };
}

/** Aturan validasi satu soal (dipakai Exam, Lesson, dan Import). */
export function validateQuestion(question: QuestionLike, scope: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasText = Boolean(question.text?.trim());
  const hasMedia = Boolean(question.image_url || question.audio_url);
  if (!hasText && !hasMedia) {
    issues.push({ severity: "error", scope, message: "Soal tidak memiliki teks maupun media." });
  }
  if (question.question_type === "listening" && !question.audio_url) {
    issues.push({ severity: "error", scope, message: "Soal listening wajib memiliki audio." });
  }
  if (!question.question_type || !VALID_TYPES.includes(question.question_type)) {
    issues.push({ severity: "error", scope, message: "Jenis soal tidak valid." });
  }
  if (!question.visibility || !VALID_VISIBILITY.includes(question.visibility)) {
    issues.push({ severity: "error", scope, message: "Visibility soal tidak valid." });
  }
  if (question.is_archived) {
    issues.push({ severity: "error", scope, message: "Soal sudah diarsipkan dan tidak boleh dipakai." });
  }
  const answers = question.answers ?? [];
  if (answers.length < 2) {
    issues.push({ severity: "error", scope, message: "Soal harus memiliki minimal 2 pilihan jawaban." });
  }
  const correct = answers.filter((a) => a.is_correct).length;
  if (correct !== 1) {
    issues.push({
      severity: "error",
      scope,
      message: `Soal harus memiliki tepat satu jawaban benar (ditemukan ${correct}).`,
    });
  }
  const empty = answers.filter((a) => !a.text?.trim() && !a.image_url).length;
  if (empty > 0) {
    issues.push({ severity: "error", scope, message: `${empty} pilihan jawaban kosong.` });
  }
  return issues;
}

/** Validasi Exam lengkap sebelum publish. */
export async function validateExam(examId: string): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];

  const { data: examRow } = await supabase
    .from(EXAM_TABLES.exams)
    .select("title, duration_minutes, passing_score")
    .eq("id", examId)
    .maybeSingle();
  const exam = examRow as { title: string; duration_minutes: number; passing_score: number } | null;
  if (!exam) {
    return buildReport([{ label: "Exam ditemukan", ok: false }], [
      { severity: "error", scope: "Exam", message: "Exam tidak ditemukan." },
    ]);
  }
  if (!exam.title.trim()) issues.push({ severity: "error", scope: "Exam", message: "Judul exam kosong." });
  if (!exam.duration_minutes || exam.duration_minutes < 1) {
    issues.push({ severity: "error", scope: "Exam", message: "Durasi exam tidak valid." });
  }
  if (exam.passing_score < 0 || exam.passing_score > 100) {
    issues.push({ severity: "error", scope: "Exam", message: "Passing score harus 0–100." });
  }

  const { data: sectionRows } = await supabase
    .from(EXAM_TABLES.sections)
    .select("id, title")
    .eq("exam_id", examId);
  const sections = (sectionRows as { id: string; title: string }[] | null) ?? [];
  if (sections.length === 0) {
    issues.push({ severity: "error", scope: "Section", message: "Exam belum memiliki section." });
  }

  const { data: refRows } = await supabase
    .from(EXAM_TABLES.questions)
    .select(
      `section_id, order_index,
       question:questions(id, text, image_url, audio_url, question_type, visibility, is_archived, lesson_id,
         answers:question_answers(text, image_url, is_correct))`,
    )
    .eq("exam_id", examId)
    .order("order_index", { ascending: true });

  const refs = (refRows as unknown as
    | { section_id: string; order_index: number; question: (QuestionLike & { lesson_id: string | null }) | null }[]
    | null) ?? [];

  if (refs.length === 0) {
    issues.push({ severity: "error", scope: "Soal", message: "Exam belum memiliki soal." });
  }

  const emptySections = sections.filter((s) => !refs.some((r) => r.section_id === s.id));
  for (const section of emptySections) {
    issues.push({ severity: "warning", scope: "Section", message: `Section "${section.title}" belum memiliki soal.` });
  }

  const lessonIds = new Set<string>();
  refs.forEach((ref, index) => {
    if (!ref.question) {
      issues.push({ severity: "error", scope: "Soal", message: `Soal nomor ${index + 1} tidak ditemukan di Question Bank.` });
      return;
    }
    issues.push(...validateQuestion(ref.question, `Soal ${index + 1}`));
    if (ref.question.lesson_id) lessonIds.add(ref.question.lesson_id);
  });

  if (lessonIds.size > 0) {
    const { data: lessonRows } = await supabase
      .from(LESSON_TABLES.lessons)
      .select("id")
      .in("id", Array.from(lessonIds));
    const found = new Set(((lessonRows as { id: string }[] | null) ?? []).map((l) => l.id));
    const missing = Array.from(lessonIds).filter((id) => !found.has(id));
    if (missing.length > 0) {
      issues.push({
        severity: "warning",
        scope: "Lesson",
        message: `${missing.length} referensi lesson tidak dapat diverifikasi.`,
      });
    }
  }

  const brokenMedia = refs.filter(
    (r) => r.question && ((r.question.image_url && !isValidMediaUrl(r.question.image_url)) ||
      (r.question.audio_url && !isValidMediaUrl(r.question.audio_url))),
  ).length;
  if (brokenMedia > 0) {
    issues.push({ severity: "warning", scope: "Media", message: `${brokenMedia} referensi media tidak dapat diverifikasi.` });
  }

  const checks = [
    { label: "Informasi exam", ok: !issues.some((i) => i.scope === "Exam" && i.severity === "error") },
    { label: "Section", ok: !issues.some((i) => i.scope === "Section" && i.severity === "error") },
    { label: "Soal & jawaban", ok: !issues.some((i) => i.scope.startsWith("Soal") && i.severity === "error") },
    { label: "Media & referensi", ok: !issues.some((i) => (i.scope === "Media" || i.scope === "Lesson") && i.severity === "error") },
  ];
  return buildReport(checks, issues);
}

/** Validasi Lesson sebelum publish. */
export async function validateLesson(lessonId: string): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];
  const { data: lessonRow } = await supabase
    .from(LESSON_TABLES.lessons)
    .select("title, slug")
    .eq("id", lessonId)
    .maybeSingle();
  const lesson = lessonRow as { title: string; slug: string } | null;
  if (!lesson) {
    return buildReport([{ label: "Lesson ditemukan", ok: false }], [
      { severity: "error", scope: "Lesson", message: "Lesson tidak ditemukan." },
    ]);
  }
  if (!lesson.title.trim()) issues.push({ severity: "error", scope: "Lesson", message: "Judul lesson kosong." });
  if (!lesson.slug.trim()) issues.push({ severity: "error", scope: "Lesson", message: "Slug lesson kosong." });

  const { data: sectionRows } = await supabase
    .from(LESSON_TABLES.sections)
    .select("id, title, order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });
  const sections = (sectionRows as { id: string; title: string; order_index: number }[] | null) ?? [];
  if (sections.length === 0) {
    issues.push({ severity: "error", scope: "Section", message: "Lesson belum memiliki section." });
  }

  const sectionIds = sections.map((s) => s.id);
  const { data: blockRows } = sectionIds.length
    ? await supabase
        .from(LESSON_TABLES.blocks)
        .select("section_id, type, content, items, media_url")
        .in("section_id", sectionIds)
    : { data: [] as unknown[] };
  const blocks = (blockRows as
    | { section_id: string; type: string; content: string | null; items: string[] | null; media_url: string | null }[]
    | null) ?? [];

  for (const section of sections) {
    const sectionBlocks = blocks.filter((b) => b.section_id === section.id);
    if (sectionBlocks.length === 0) {
      issues.push({ severity: "warning", scope: "Section", message: `Section "${section.title}" belum memiliki konten.` });
    }
    for (const block of sectionBlocks) {
      const needsMedia = block.type === "image" || block.type === "audio";
      if (needsMedia && !block.media_url) {
        issues.push({ severity: "error", scope: "Konten", message: `Block ${block.type} pada "${section.title}" tidak memiliki media.` });
      }
      if (needsMedia && block.media_url && !isValidMediaUrl(block.media_url)) {
        issues.push({ severity: "warning", scope: "Media", message: `Media pada "${section.title}" tidak dapat diverifikasi.` });
      }
      if (!needsMedia && block.type !== "divider" && !block.content?.trim() && (block.items ?? []).length === 0) {
        issues.push({ severity: "error", scope: "Konten", message: `Block ${block.type} pada "${section.title}" kosong.` });
      }
    }
  }

  const { data: questionRows } = await supabase
    .from(LESSON_TABLES.questions)
    .select(
      `order_index, question:questions(id, text, image_url, audio_url, question_type, visibility, is_archived,
        answers:question_answers(text, image_url, is_correct))`,
    )
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });
  const questions = (questionRows as unknown as
    | { order_index: number; question: QuestionLike | null }[]
    | null) ?? [];

  questions.forEach((row, index) => {
    if (!row.question) {
      issues.push({ severity: "error", scope: "Soal", message: `Referensi soal latihan ${index + 1} tidak ditemukan.` });
      return;
    }
    issues.push(...validateQuestion(row.question, `Latihan ${index + 1}`));
  });

  const checks = [
    { label: "Informasi lesson", ok: !issues.some((i) => i.scope === "Lesson" && i.severity === "error") },
    { label: "Section & urutan", ok: !issues.some((i) => i.scope === "Section" && i.severity === "error") },
    { label: "Konten & media", ok: !issues.some((i) => (i.scope === "Konten" || i.scope === "Media") && i.severity === "error") },
    { label: "Soal latihan", ok: !issues.some((i) => i.scope.startsWith("Latihan") && i.severity === "error") },
  ];
  return buildReport(checks, issues);
}

export function isValidMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https:\/\/[^\s]+$/i.test(url);
}
