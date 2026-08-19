import { supabase } from "@/lib/supabase/client";
import {
  QUESTION_TABLES,
  type LessonRow,
  type QuestionBankFilters,
  type QuestionBankInput,
  type QuestionBankResult,
  type QuestionBankRow,
  type QuestionDeleteResult,
} from "@/types/question-bank";

const SELECT_QUESTION = `*, answers:question_answers(*), lesson:lessons(id,title,slug)`;

type RawQuestion = QuestionBankRow;

function normalize(raw: RawQuestion): QuestionBankRow {
  return {
    ...raw,
    answers: (raw.answers ?? []).slice().sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** Daftar lesson untuk referensi soal (foreign key). */
export async function listLessons(): Promise<LessonRow[]> {
  const { data, error } = await supabase
    .from(QUESTION_TABLES.lessons)
    .select("id,title,slug")
    .order("title", { ascending: true });
  if (error) return [];
  return (data as LessonRow[] | null) ?? [];
}

async function questionIdsByLessonSearch(term: string): Promise<string[]> {
  const like = `%${term}%`;
  const { data: lessons } = await supabase
    .from(QUESTION_TABLES.lessons)
    .select("id")
    .ilike("title", like);
  const lessonIds = ((lessons as { id: string }[] | null) ?? []).map((r) => r.id);
  if (lessonIds.length === 0) return [];
  const { data } = await supabase
    .from(QUESTION_TABLES.questions)
    .select("id")
    .in("lesson_id", lessonIds);
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

/** Daftar soal Question Bank dengan search, filter, dan pagination. */
export async function listBankQuestions({
  search = "",
  source = "semua",
  media = "semua",
  origin = "semua",
  archived = "aktif",
  page = 1,
  pageSize = 10,
}: QuestionBankFilters = {}): Promise<QuestionBankResult> {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from(QUESTION_TABLES.questions)
    .select(SELECT_QUESTION, { count: "exact" })
    // Soal yang dihapus dari bank tetap ada demi integritas Exam, tapi tidak
    // pernah muncul lagi di listing Question Bank aktif.
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const term = search.trim().replace(/[%,()]/g, "");
  if (term) {
    const relatedIds = await questionIdsByLessonSearch(term);
    const clauses = [`text.ilike.%${term}%`, `explanation.ilike.%${term}%`];
    if (relatedIds.length > 0) clauses.push(`id.in.(${relatedIds.join(",")})`);
    query = query.or(clauses.join(","));
  }
  if (source !== "semua") query = query.eq("source_type", source);
  if (media === "image") query = query.not("image_url", "is", null);
  if (media === "audio") query = query.not("audio_url", "is", null);
  if (media === "none") query = query.is("image_url", null).is("audio_url", null);
  if (origin !== "semua") query = query.eq("origin", origin);
  if (archived === "aktif") query = query.eq("is_archived", false);
  if (archived === "arsip") query = query.eq("is_archived", true);

  const { data, error, count } = await query;
  if (error) throw new Error("Gagal memuat Question Bank.");

  const total = count ?? 0;
  return {
    rows: ((data as RawQuestion[] | null) ?? []).map(normalize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getBankQuestion(questionId: string): Promise<QuestionBankRow> {
  const { data, error } = await supabase
    .from(QUESTION_TABLES.questions)
    .select(SELECT_QUESTION)
    .eq("id", questionId)
    .maybeSingle();
  if (error || !data) throw new Error("Soal tidak ditemukan.");
  return normalize(data as RawQuestion);
}

async function syncRelations(questionId: string, input: QuestionBankInput) {
  await supabase.from(QUESTION_TABLES.answers).delete().eq("question_id", questionId);
  const { error: answerError } = await supabase
    .from(QUESTION_TABLES.answers)
    .insert(input.answers.map((a) => ({ ...a, text: a.text || null, question_id: questionId })));
  if (answerError) throw new Error("Gagal menyimpan pilihan jawaban.");
}

/** Membuat soal baru di Question Bank (dipanggil dari Exam/Lesson Studio). */
export async function createBankQuestion(input: QuestionBankInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(QUESTION_TABLES.questions)
    .insert({
      text: input.text,
      instruction: input.instruction || null,
      image_url: input.image_url,
      audio_url: input.audio_url,
      explanation: input.explanation || null,
      lesson_id: input.lesson_id,
      source_type: input.source_type,
      origin: input.origin ?? input.source_type,
      created_from: input.created_from,
      created_by: userData.user?.id ?? null,
      updated_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Gagal menyimpan soal ke Question Bank.");

  const questionId = (data as { id: string }).id;
  try {
    await syncRelations(questionId, input);
  } catch (err) {
    await supabase.from(QUESTION_TABLES.questions).delete().eq("id", questionId);
    throw err;
  }
  return questionId;
}

export async function updateBankQuestion(
  questionId: string,
  input: QuestionBankInput,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(QUESTION_TABLES.questions)
    .update({
      text: input.text,
      instruction: input.instruction || null,
      image_url: input.image_url,
      audio_url: input.audio_url,
      explanation: input.explanation || null,
      lesson_id: input.lesson_id,
      updated_by: userData.user?.id ?? null,
    })
    .eq("id", questionId);
  if (error) throw new Error("Gagal memperbarui soal.");
  await syncRelations(questionId, input);
}

/** Arsip / aktifkan kembali soal. */
export async function setQuestionArchived(
  questionId: string,
  isArchived: boolean,
): Promise<void> {
  const { error } = await supabase
    .from(QUESTION_TABLES.questions)
    .update({ is_archived: isArchived })
    .eq("id", questionId);
  if (error) throw new Error("Gagal memperbarui status arsip soal.");
}

/** Jumlah Exam & Lesson yang masih memakai soal ini. */
export async function countQuestionReferences(
  questionId: string,
): Promise<{ exams: number; lessons: number }> {
  const [exam, lesson] = await Promise.all([
    supabase
      .from("exam_questions")
      .select("exam_id", { count: "exact", head: true })
      .eq("question_id", questionId),
    supabase
      .from("lesson_questions")
      .select("lesson_id", { count: "exact", head: true })
      .eq("question_id", questionId),
  ]);
  return { exams: exam.count ?? 0, lessons: lesson.count ?? 0 };
}

/**
 * Hapus soal dari Question Bank.
 * Server (SECURITY DEFINER) yang memutuskan: soal yang masih direferensikan
 * Exam/Lesson hanya di-soft delete agar Exam & snapshot historis tetap utuh.
 */
export async function deleteBankQuestion(questionId: string): Promise<QuestionDeleteResult> {
  const { data, error } = await supabase.rpc("delete_bank_question", {
    p_question_id: questionId,
  });
  if (error) throw new Error("Gagal menghapus soal dari Question Bank.");
  return (data as QuestionDeleteResult | null) ?? "soft";
}

/** Catat statistik penggunaan soal (used_count & last_used_at). */
export async function markQuestionsUsed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.rpc("touch_question_usage", { _ids: ids });
}
