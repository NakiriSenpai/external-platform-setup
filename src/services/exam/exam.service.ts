import { supabase } from "@/lib/supabase/client";
import {
  EXAM_TABLES,
  type ExamInput,
  type ExamQuestionWithAnswers,
  type ExamRow,
  type ExamSectionRow,
  type ExamStatus,
  type SectionInput,
} from "@/types/exam";
import {
  createBankQuestion,
  markQuestionsUsed,
  updateBankQuestion,
} from "@/services/question-bank";
import type { QuestionBankInput, QuestionBankRow } from "@/types/question-bank";

export type ExamStatusFilter = "semua" | ExamStatus;
export type ExamCategoryFilter = "semua" | string;

export type ExamListParams = {
  search?: string;
  status?: ExamStatusFilter;
  category?: ExamCategoryFilter;
  page?: number;
  pageSize?: number;
};

export type ExamListResult = {
  rows: ExamRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Daftar exam dengan pencarian, filter status/kategori, dan pagination. */
export async function listExams({
  search = "",
  status = "semua",
  category = "semua",
  page = 1,
  pageSize = 10,
}: ExamListParams = {}): Promise<ExamListResult> {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from(EXAM_TABLES.exams)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const term = search.trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  if (status !== "semua") query = query.eq("status", status);
  if (category !== "semua") query = query.eq("category", category);

  const { data, error, count } = await query;
  if (error) throw new Error("Gagal memuat daftar exam.");

  const total = count ?? 0;
  return {
    rows: (data as ExamRow[] | null) ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getExam(examId: string): Promise<ExamRow> {
  const { data, error } = await supabase
    .from(EXAM_TABLES.exams)
    .select("*")
    .eq("id", examId)
    .maybeSingle();
  if (error || !data) throw new Error("Exam tidak ditemukan.");
  return data as ExamRow;
}

export async function createExam(input: ExamInput): Promise<ExamRow> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(EXAM_TABLES.exams)
    .insert({ ...input, created_by: userData.user?.id ?? null })
    .select("*")
    .single();
  if (error) throw new Error(translate(error.message, "Gagal membuat exam."));
  return data as ExamRow;
}

export async function updateExam(examId: string, input: Partial<ExamInput>): Promise<ExamRow> {
  const { data, error } = await supabase
    .from(EXAM_TABLES.exams)
    .update(input)
    .eq("id", examId)
    .select("*")
    .single();
  if (error) throw new Error(translate(error.message, "Gagal memperbarui exam."));
  return data as ExamRow;
}

export async function setExamStatus(examId: string, status: ExamStatus) {
  return updateExam(examId, { status });
}

export async function deleteExam(examId: string): Promise<void> {
  const { error } = await supabase.from(EXAM_TABLES.exams).delete().eq("id", examId);
  if (error) throw new Error("Gagal menghapus exam.");
}

// ---------- SECTION ----------

export async function listSections(examId: string): Promise<ExamSectionRow[]> {
  const { data, error } = await supabase
    .from(EXAM_TABLES.sections)
    .select("*")
    .eq("exam_id", examId)
    .order("order_index", { ascending: true });
  if (error) throw new Error("Gagal memuat section.");
  return (data as ExamSectionRow[] | null) ?? [];
}

export async function createSection(examId: string, input: SectionInput) {
  const existing = await listSections(examId);
  const { error } = await supabase.from(EXAM_TABLES.sections).insert({
    exam_id: examId,
    type: input.type,
    title: input.title,
    instruction: input.instruction || null,
    order_index: existing.length,
  });
  if (error) throw new Error("Gagal menambah section.");
}

export async function updateSection(sectionId: string, input: Partial<SectionInput>) {
  const { error } = await supabase
    .from(EXAM_TABLES.sections)
    .update({
      ...(input.type ? { type: input.type } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.instruction !== undefined ? { instruction: input.instruction || null } : {}),
    })
    .eq("id", sectionId);
  if (error) throw new Error("Gagal memperbarui section.");
}

export async function deleteSection(sectionId: string) {
  const { error } = await supabase.from(EXAM_TABLES.sections).delete().eq("id", sectionId);
  if (error) throw new Error("Gagal menghapus section.");
}

/** Simpan urutan section sesuai posisi array. */
export async function reorderSections(ids: string[]) {
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase
      .from(EXAM_TABLES.sections)
      .update({ order_index: index })
      .eq("id", id);
    if (error) throw new Error("Gagal mengurutkan section.");
  }
}

// ---------- QUESTION (referensi ke Question Bank) ----------

const QUESTION_SELECT = `id, exam_id, section_id, question_id, order_index, created_at, updated_at,
  question:questions(*, answers:question_answers(*))`;

type RawRef = {
  id: string;
  exam_id: string;
  section_id: string;
  question_id: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  question: QuestionBankRow | null;
};

export async function listQuestions(examId: string): Promise<ExamQuestionWithAnswers[]> {
  const { data, error } = await supabase
    .from(EXAM_TABLES.questions)
    .select(QUESTION_SELECT)
    .eq("exam_id", examId)
    .order("order_index", { ascending: true });
  if (error) throw new Error("Gagal memuat soal.");

  const rows = (data as unknown as RawRef[] | null) ?? [];
  return rows
    .filter((row) => row.question)
    .map((row) => {
      const q = row.question!;
      return {
        id: row.id,
        exam_id: row.exam_id,
        section_id: row.section_id,
        question_id: row.question_id,
        order_index: row.order_index,
        created_at: row.created_at,
        updated_at: row.updated_at,
        text: q.text,
        instruction: q.instruction ?? null,
        image_url: q.image_url,
        audio_url: q.audio_url,
        explanation: q.explanation,
        lesson_id: q.lesson_id,
        source_type: q.source_type,
        origin: q.origin,
        version: q.version,
        is_archived: q.is_archived,
        used_count: q.used_count,
        last_used_at: q.last_used_at,
        answers: (q.answers ?? []).slice().sort((a, b) => a.label.localeCompare(b.label)),
      };
    });
}

/** Buat soal baru: tersimpan ke Question Bank lalu direferensikan oleh exam. */
export async function createQuestion(
  examId: string,
  sectionId: string,
  input: QuestionBankInput,
): Promise<void> {
  const questionId = await createBankQuestion({
    ...input,
    source_type: "exam",
    origin: "exam",
    created_from: examId,
  });
  await attachQuestionsToExam(examId, sectionId, [questionId]);
}

/** Tambahkan soal dari Question Bank tanpa duplikasi (hanya referensi). */
export async function attachQuestionsToExam(
  examId: string,
  sectionId: string,
  questionIds: string[],
): Promise<number> {
  if (questionIds.length === 0) return 0;
  const existing = await listQuestions(examId);
  const already = new Set(existing.map((q) => q.question_id));
  const fresh = questionIds.filter((id) => !already.has(id));
  if (fresh.length === 0) return 0;

  let orderIndex = existing.filter((q) => q.section_id === sectionId).length;
  const payload = fresh.map((question_id) => ({
    exam_id: examId,
    section_id: sectionId,
    question_id,
    order_index: orderIndex++,
  }));

  const { error } = await supabase.from(EXAM_TABLES.questions).insert(payload);
  if (error) throw new Error("Gagal menambahkan soal ke exam.");
  await markQuestionsUsed(fresh);
  return fresh.length;
}

/** Perbarui soal (data master ada di Question Bank). */
export async function updateQuestion(questionId: string, input: QuestionBankInput): Promise<void> {
  await updateBankQuestion(questionId, input);
}

/** Lepas referensi soal dari exam. Soal tetap tersimpan di Question Bank. */
export async function deleteQuestion(refId: string) {
  const { error } = await supabase.from(EXAM_TABLES.questions).delete().eq("id", refId);
  if (error) throw new Error("Gagal menghapus soal dari exam.");
}

/** Simpan urutan soal (drag & drop atau pindah nomor). */
export async function reorderQuestions(ids: string[]) {
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase
      .from(EXAM_TABLES.questions)
      .update({ order_index: index })
      .eq("id", id);
    if (error) throw new Error("Gagal mengurutkan soal.");
  }
}

function translate(message: string, fallback: string) {
  if (message.includes("duplicate key") && message.includes("slug")) {
    return "Slug sudah dipakai exam lain.";
  }
  if (message.toLowerCase().includes("row-level security")) {
    return "Anda tidak memiliki izin untuk tindakan ini.";
  }
  return fallback;
}
