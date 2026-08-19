import { supabase } from "@/lib/supabase/client";
import {
  createBankQuestion,
  markQuestionsUsed,
  updateBankQuestion,
} from "@/services/question-bank";
import type {
  GrammarTagRow,
  QuestionAnswerRow,
  QuestionBankInput,
  TagRow,
} from "@/types/question-bank";
import {
  LESSON_TABLES,
  type LessonBlockInput,
  type LessonBlockRow,
  type LessonDetailRow,
  type LessonInput,
  type LessonListItem,
  type LessonListParams,
  type LessonListResult,
  type LessonQuestionWithAnswers,
  type LessonSectionInput,
  type LessonSectionRow,
  type LessonStatus,
} from "@/types/lesson";

function translate(message: string, fallback: string) {
  if (message.includes("duplicate key") && message.includes("slug")) {
    return "Slug sudah dipakai lesson lain.";
  }
  if (message.toLowerCase().includes("row-level security")) {
    return "Anda tidak memiliki izin untuk tindakan ini.";
  }
  return fallback;
}

// ---------- LESSON ----------

/** Daftar lesson dengan pencarian, filter, pagination, dan jumlah section/soal. */
export async function listLessonsAdmin({
  search = "",
  category = "semua",
  status = "semua",
  difficulty = "semua",
  page = 1,
  pageSize = 10,
}: LessonListParams = {}): Promise<LessonListResult> {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from(LESSON_TABLES.lessons)
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const term = search.trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  if (category !== "semua") query = query.eq("category", category);
  if (status !== "semua") query = query.eq("status", status);
  if (difficulty !== "semua") query = query.eq("difficulty", difficulty);

  const { data, error, count } = await query;
  if (error) throw new Error("Gagal memuat daftar lesson.");

  const lessons = (data as LessonDetailRow[] | null) ?? [];
  const ids = lessons.map((l) => l.id);

  const sectionCount = new Map<string, number>();
  const questionCount = new Map<string, number>();

  if (ids.length > 0) {
    const [sections, questions] = await Promise.all([
      supabase.from(LESSON_TABLES.sections).select("lesson_id").in("lesson_id", ids),
      supabase.from(LESSON_TABLES.questions).select("lesson_id").in("lesson_id", ids),
    ]);
    for (const row of ((sections.data as { lesson_id: string }[] | null) ?? [])) {
      sectionCount.set(row.lesson_id, (sectionCount.get(row.lesson_id) ?? 0) + 1);
    }
    for (const row of ((questions.data as { lesson_id: string }[] | null) ?? [])) {
      questionCount.set(row.lesson_id, (questionCount.get(row.lesson_id) ?? 0) + 1);
    }
  }

  const rows: LessonListItem[] = lessons.map((lesson) => ({
    ...lesson,
    section_count: sectionCount.get(lesson.id) ?? 0,
    question_count: questionCount.get(lesson.id) ?? 0,
  }));

  const total = count ?? 0;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Materi untuk siswa: hanya lesson berstatus Published (tenant discope oleh RLS). */
export async function listPublishedLessons(): Promise<LessonDetailRow[]> {
  const { data, error } = await supabase
    .from(LESSON_TABLES.lessons)
    .select("*")
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Gagal memuat materi.");
  return (data as LessonDetailRow[] | null) ?? [];
}

/** Judul lesson berdasarkan daftar id (dipakai Review untuk Materi Terkait). */
export async function listLessonTitles(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from(LESSON_TABLES.lessons)
    .select("id, title")
    .in("id", unique);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of ((data as { id: string; title: string }[] | null) ?? [])) {
    map[row.id] = row.title;
  }
  return map;
}

export async function getLesson(lessonId: string): Promise<LessonDetailRow> {

  const { data, error } = await supabase
    .from(LESSON_TABLES.lessons)
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();
  if (error || !data) throw new Error("Lesson tidak ditemukan.");
  return data as LessonDetailRow;
}

export async function createLesson(input: LessonInput): Promise<LessonDetailRow> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(LESSON_TABLES.lessons)
    .insert({
      title: input.title,
      slug: input.slug,
      category: input.category,
      description: input.description || null,
      thumbnail_url: input.thumbnail_url,
      difficulty: input.difficulty,
      status: input.status,
      created_by: userData.user?.id ?? null,
      updated_by: userData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(translate(error.message, "Gagal membuat lesson."));
  return data as LessonDetailRow;
}

export async function updateLesson(
  lessonId: string,
  input: Partial<LessonInput>,
): Promise<LessonDetailRow> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(LESSON_TABLES.lessons)
    .update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.thumbnail_url !== undefined ? { thumbnail_url: input.thumbnail_url } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updated_by: userData.user?.id ?? null,
    })
    .eq("id", lessonId)
    .select("*")
    .single();
  if (error) throw new Error(translate(error.message, "Gagal memperbarui lesson."));
  return data as LessonDetailRow;
}

export async function setLessonStatus(lessonId: string, status: LessonStatus) {
  return updateLesson(lessonId, { status });
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const { error } = await supabase.from(LESSON_TABLES.lessons).delete().eq("id", lessonId);
  if (error) throw new Error("Gagal menghapus lesson.");
}

// ---------- SECTION ----------

export async function listLessonSections(lessonId: string): Promise<LessonSectionRow[]> {
  const { data, error } = await supabase
    .from(LESSON_TABLES.sections)
    .select("*")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });
  if (error) throw new Error("Gagal memuat section lesson.");
  return (data as LessonSectionRow[] | null) ?? [];
}

export async function createLessonSection(lessonId: string, input: LessonSectionInput) {
  const existing = await listLessonSections(lessonId);
  const { error } = await supabase.from(LESSON_TABLES.sections).insert({
    lesson_id: lessonId,
    title: input.title,
    description: input.description || null,
    order_index: existing.length,
  });
  if (error) throw new Error("Gagal menambah section.");
}

export async function updateLessonSection(
  sectionId: string,
  input: Partial<LessonSectionInput>,
) {
  const { error } = await supabase
    .from(LESSON_TABLES.sections)
    .update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
    })
    .eq("id", sectionId);
  if (error) throw new Error("Gagal memperbarui section.");
}

export async function deleteLessonSection(sectionId: string) {
  const { error } = await supabase.from(LESSON_TABLES.sections).delete().eq("id", sectionId);
  if (error) throw new Error("Gagal menghapus section.");
}

export async function reorderLessonSections(ids: string[]) {
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase
      .from(LESSON_TABLES.sections)
      .update({ order_index: index })
      .eq("id", id);
    if (error) throw new Error("Gagal mengurutkan section.");
  }
}

// ---------- CONTENT BLOCK ----------

const BLOCK_SELECT = "*, grammar_tag:grammar_tags(id,slug,name)";

export async function listLessonBlocks(lessonId: string): Promise<LessonBlockRow[]> {
  const sections = await listLessonSections(lessonId);
  if (sections.length === 0) return [];
  const { data, error } = await supabase
    .from(LESSON_TABLES.blocks)
    .select(BLOCK_SELECT)
    .in(
      "section_id",
      sections.map((s) => s.id),
    )
    .order("order_index", { ascending: true });
  if (error) throw new Error("Gagal memuat konten lesson.");
  return ((data as LessonBlockRow[] | null) ?? []).map((block) => ({
    ...block,
    items: block.items ?? [],
  }));
}

export async function createLessonBlock(sectionId: string, input: LessonBlockInput) {
  const { count } = await supabase
    .from(LESSON_TABLES.blocks)
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId);
  const { error } = await supabase.from(LESSON_TABLES.blocks).insert({
    section_id: sectionId,
    type: input.type,
    content: input.content || null,
    items: input.items,
    media_url: input.media_url,
    grammar_tag_id: input.grammar_tag_id,
    order_index: count ?? 0,
  });
  if (error) throw new Error("Gagal menambah block.");
}

export async function updateLessonBlock(blockId: string, input: LessonBlockInput) {
  const { error } = await supabase
    .from(LESSON_TABLES.blocks)
    .update({
      type: input.type,
      content: input.content || null,
      items: input.items,
      media_url: input.media_url,
      grammar_tag_id: input.grammar_tag_id,
    })
    .eq("id", blockId);
  if (error) throw new Error("Gagal memperbarui block.");
}

export async function deleteLessonBlock(blockId: string) {
  const { error } = await supabase.from(LESSON_TABLES.blocks).delete().eq("id", blockId);
  if (error) throw new Error("Gagal menghapus block.");
}

export async function reorderLessonBlocks(ids: string[]) {
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase
      .from(LESSON_TABLES.blocks)
      .update({ order_index: index })
      .eq("id", id);
    if (error) throw new Error("Gagal mengurutkan block.");
  }
}

// ---------- PRACTICE (referensi Question Bank) ----------

const LESSON_QUESTION_SELECT = `id, lesson_id, section_id, question_id, order_index,
  question:questions(*, answers:question_answers(*),
    tag_links:question_grammar_tags(tag:grammar_tags(*)),
    general_tag_links:question_tags(tag:tags(*)))`;

type RawLessonQuestion = {
  id: string;
  lesson_id: string;
  section_id: string;
  question_id: string;
  order_index: number;
  question:
    | {
        text: string;
        image_url: string | null;
        audio_url: string | null;
        explanation: string | null;
        category: string;
        difficulty: LessonQuestionWithAnswers["difficulty"];
        question_type?: LessonQuestionWithAnswers["question_type"] | null;
        visibility?: LessonQuestionWithAnswers["visibility"] | null;
        origin?: LessonQuestionWithAnswers["origin"] | null;
        source_type?: LessonQuestionWithAnswers["source_type"] | null;
        version?: number | null;
        is_archived?: boolean | null;
        answers?: QuestionAnswerRow[] | null;
        tag_links?: { tag: GrammarTagRow | null }[] | null;
        general_tag_links?: { tag: TagRow | null }[] | null;
      }
    | null;
};

export async function listLessonQuestions(
  lessonId: string,
): Promise<LessonQuestionWithAnswers[]> {
  const { data, error } = await supabase
    .from(LESSON_TABLES.questions)
    .select(LESSON_QUESTION_SELECT)
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });
  if (error) throw new Error("Gagal memuat latihan lesson.");

  return ((data as unknown as RawLessonQuestion[] | null) ?? [])
    .filter((row) => row.question)
    .map((row) => {
      const q = row.question!;
      return {
        id: row.id,
        lesson_id: row.lesson_id,
        section_id: row.section_id,
        question_id: row.question_id,
        order_index: row.order_index,
        text: q.text,
        image_url: q.image_url,
        audio_url: q.audio_url,
        explanation: q.explanation,
        category: q.category,
        difficulty: q.difficulty,
        question_type: q.question_type ?? "reading",
        visibility: q.visibility ?? "private",
        origin: q.origin ?? "lesson",
        source_type: q.source_type ?? "lesson",
        version: q.version ?? 1,
        is_archived: q.is_archived ?? false,
        tags: (q.general_tag_links ?? []).map((l) => l.tag).filter(Boolean) as TagRow[],
        grammar_tags: (q.tag_links ?? []).map((l) => l.tag).filter(Boolean) as GrammarTagRow[],
        answers: (q.answers ?? []).slice().sort((a, b) => a.label.localeCompare(b.label)),
      };
    });
}

/** Tambahkan referensi soal dari Question Bank (tanpa duplikasi). */
export async function attachQuestionsToLesson(
  lessonId: string,
  sectionId: string,
  questionIds: string[],
): Promise<number> {
  if (questionIds.length === 0) return 0;
  const existing = await listLessonQuestions(lessonId);
  const already = new Set(existing.filter((q) => q.section_id === sectionId).map((q) => q.question_id));
  const fresh = questionIds.filter((id) => !already.has(id));
  if (fresh.length === 0) return 0;

  let orderIndex = existing.filter((q) => q.section_id === sectionId).length;
  const { error } = await supabase.from(LESSON_TABLES.questions).insert(
    fresh.map((question_id) => ({
      lesson_id: lessonId,
      section_id: sectionId,
      question_id,
      order_index: orderIndex++,
    })),
  );
  if (error) throw new Error("Gagal menambahkan soal ke lesson.");
  await markQuestionsUsed(fresh);
  return fresh.length;
}

/**
 * Buat soal baru dari Lesson Studio.
 * Soal otomatis tersimpan di Question Bank dengan lesson_id terhubung.
 */
export async function createLessonQuestion(
  lessonId: string,
  sectionId: string,
  input: QuestionBankInput,
): Promise<void> {
  const questionId = await createBankQuestion({
    ...input,
    lesson_id: lessonId,
    source_type: "lesson",
    origin: "lesson",
    created_from: lessonId,
  });
  await attachQuestionsToLesson(lessonId, sectionId, [questionId]);
}

export async function updateLessonQuestion(
  questionId: string,
  input: QuestionBankInput,
): Promise<void> {
  await updateBankQuestion(questionId, input);
}

/** Lepas referensi soal dari lesson. Soal tetap ada di Question Bank. */
export async function detachLessonQuestion(refId: string) {
  const { error } = await supabase.from(LESSON_TABLES.questions).delete().eq("id", refId);
  if (error) throw new Error("Gagal melepas soal dari lesson.");
}

export async function reorderLessonQuestions(ids: string[]) {
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase
      .from(LESSON_TABLES.questions)
      .update({ order_index: index })
      .eq("id", id);
    if (error) throw new Error("Gagal mengurutkan soal latihan.");
  }
}
