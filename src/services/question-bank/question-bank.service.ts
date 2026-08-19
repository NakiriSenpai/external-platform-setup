import { supabase } from "@/lib/supabase/client";
import {
  QUESTION_TABLES,
  type GrammarTagRow,
  type LessonRow,
  type QuestionBankFilters,
  type QuestionBankInput,
  type QuestionBankResult,
  type QuestionBankRow,
  type TagRow,
} from "@/types/question-bank";

const SELECT_QUESTION = `*, answers:question_answers(*), tag_links:question_grammar_tags(tag:grammar_tags(*)), general_tag_links:question_tags(tag:tags(*)), lesson:lessons(id,title,slug)`;

type RawQuestion = Omit<QuestionBankRow, "grammar_tags" | "tags"> & {
  tag_links?: { tag: GrammarTagRow | null }[] | null;
  general_tag_links?: { tag: TagRow | null }[] | null;
};

function normalize(raw: RawQuestion): QuestionBankRow {
  const { tag_links, general_tag_links, ...rest } = raw;
  return {
    ...rest,
    answers: (rest.answers ?? []).slice().sort((a, b) => a.label.localeCompare(b.label)),
    grammar_tags: (tag_links ?? []).map((l) => l.tag).filter(Boolean) as GrammarTagRow[],
    tags: (general_tag_links ?? []).map((l) => l.tag).filter(Boolean) as TagRow[],
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Daftar tag umum (bebas, bukan grammar). */
export async function listTags(): Promise<TagRow[]> {
  const { data, error } = await supabase
    .from(QUESTION_TABLES.tags)
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error("Gagal memuat tag.");
  return (data as TagRow[] | null) ?? [];
}

/** Buat tag umum baru (idempotent berdasarkan slug). */
export async function createTag(name: string): Promise<TagRow> {
  const slug = slugify(name);
  if (!slug) throw new Error("Nama tag tidak valid.");
  const { data } = await supabase
    .from(QUESTION_TABLES.tags)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (data) return data as TagRow;
  const { data: created, error } = await supabase
    .from(QUESTION_TABLES.tags)
    .insert({ slug, name: name.trim() })
    .select("*")
    .single();
  if (error || !created) throw new Error("Gagal membuat tag.");
  return created as TagRow;
}

/** Daftar grammar tag (relasi, bukan string). */
export async function listGrammarTags(): Promise<GrammarTagRow[]> {
  const { data, error } = await supabase
    .from(QUESTION_TABLES.grammarTags)
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error("Gagal memuat grammar tag.");
  return (data as GrammarTagRow[] | null) ?? [];
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

async function questionIdsByRelationSearch(term: string): Promise<string[]> {
  const like = `%${term}%`;
  const [grammar, tags, lessons] = await Promise.all([
    supabase.from(QUESTION_TABLES.grammarTags).select("id").ilike("name", like),
    supabase.from(QUESTION_TABLES.tags).select("id").ilike("name", like),
    supabase.from(QUESTION_TABLES.lessons).select("id").ilike("title", like),
  ]);

  const grammarIds = ((grammar.data as { id: string }[] | null) ?? []).map((r) => r.id);
  const tagIds = ((tags.data as { id: string }[] | null) ?? []).map((r) => r.id);
  const lessonIds = ((lessons.data as { id: string }[] | null) ?? []).map((r) => r.id);

  const results: string[] = [];
  if (grammarIds.length) {
    const { data } = await supabase
      .from(QUESTION_TABLES.questionGrammarTags)
      .select("question_id")
      .in("tag_id", grammarIds);
    results.push(...((data as { question_id: string }[] | null) ?? []).map((r) => r.question_id));
  }
  if (tagIds.length) {
    const { data } = await supabase
      .from(QUESTION_TABLES.questionTags)
      .select("question_id")
      .in("tag_id", tagIds);
    results.push(...((data as { question_id: string }[] | null) ?? []).map((r) => r.question_id));
  }
  if (lessonIds.length) {
    const { data } = await supabase
      .from(QUESTION_TABLES.questions)
      .select("id")
      .in("lesson_id", lessonIds);
    results.push(...((data as { id: string }[] | null) ?? []).map((r) => r.id));
  }
  return Array.from(new Set(results));
}

async function questionIdsByTag(slug: string): Promise<string[]> {
  const { data: tag } = await supabase
    .from(QUESTION_TABLES.tags)
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  const tagId = (tag as { id: string } | null)?.id;
  if (!tagId) return [];
  const { data } = await supabase
    .from(QUESTION_TABLES.questionTags)
    .select("question_id")
    .eq("tag_id", tagId);
  return ((data as { question_id: string }[] | null) ?? []).map((r) => r.question_id);
}

async function questionIdsByGrammar(slug: string): Promise<string[]> {
  const { data: tag } = await supabase
    .from(QUESTION_TABLES.grammarTags)
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  const tagId = (tag as { id: string } | null)?.id;
  if (!tagId) return [];
  const { data } = await supabase
    .from(QUESTION_TABLES.questionGrammarTags)
    .select("question_id")
    .eq("tag_id", tagId);
  return ((data as { question_id: string }[] | null) ?? []).map((r) => r.question_id);
}

/** Daftar soal Question Bank dengan search, filter, dan pagination. */
export async function listBankQuestions({
  search = "",
  source = "semua",
  grammar = "semua",
  category = "semua",
  difficulty = "semua",
  media = "semua",
  questionType = "semua",
  visibility = "semua",
  origin = "semua",
  tag = "semua",
  archived = "aktif",
  page = 1,
  pageSize = 10,
}: QuestionBankFilters = {}): Promise<QuestionBankResult> {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from(QUESTION_TABLES.questions)
    .select(SELECT_QUESTION, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const term = search.trim().replace(/[%,()]/g, "");
  if (term) {
    const relatedIds = await questionIdsByRelationSearch(term);
    const clauses = [`text.ilike.%${term}%`, `explanation.ilike.%${term}%`, `category.ilike.%${term}%`];
    if (relatedIds.length > 0) clauses.push(`id.in.(${relatedIds.join(",")})`);
    query = query.or(clauses.join(","));
  }
  if (source !== "semua") query = query.eq("source_type", source);
  if (category !== "semua") query = query.eq("category", category);
  if (difficulty !== "semua") query = query.eq("difficulty", difficulty);
  if (media === "image") query = query.not("image_url", "is", null);
  if (media === "audio") query = query.not("audio_url", "is", null);
  if (media === "none") query = query.is("image_url", null).is("audio_url", null);
  if (questionType !== "semua") query = query.eq("question_type", questionType);
  if (visibility !== "semua") query = query.eq("visibility", visibility);
  if (origin !== "semua") query = query.eq("origin", origin);
  if (archived === "aktif") query = query.eq("is_archived", false);
  if (archived === "arsip") query = query.eq("is_archived", true);
  if (tag !== "semua") {
    const ids = await questionIdsByTag(tag);
    if (ids.length === 0) return { rows: [], total: 0, page, pageSize, totalPages: 1 };
    query = query.in("id", ids);
  }
  if (grammar !== "semua") {
    const ids = await questionIdsByGrammar(grammar);
    if (ids.length === 0) {
      return { rows: [], total: 0, page, pageSize, totalPages: 1 };
    }
    query = query.in("id", ids);
  }

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

  await supabase.from(QUESTION_TABLES.questionGrammarTags).delete().eq("question_id", questionId);
  if (input.grammar_tag_ids.length > 0) {
    const { error: tagError } = await supabase
      .from(QUESTION_TABLES.questionGrammarTags)
      .insert(input.grammar_tag_ids.map((tag_id) => ({ question_id: questionId, tag_id })));
    if (tagError) throw new Error("Gagal menyimpan grammar tag.");
  }

  const tagIds = [...(input.tag_ids ?? [])];
  for (const name of input.new_tags ?? []) {
    const created = await createTag(name);
    if (!tagIds.includes(created.id)) tagIds.push(created.id);
  }
  await supabase.from(QUESTION_TABLES.questionTags).delete().eq("question_id", questionId);
  if (tagIds.length > 0) {
    const { error: generalTagError } = await supabase
      .from(QUESTION_TABLES.questionTags)
      .insert(tagIds.map((tag_id) => ({ question_id: questionId, tag_id })));
    if (generalTagError) throw new Error("Gagal menyimpan tag.");
  }
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
      category: input.category,
      difficulty: input.difficulty,
      lesson_id: input.lesson_id,
      source_type: input.source_type,
      origin: input.origin ?? input.source_type,
      question_type: input.question_type,
      visibility: input.visibility,
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
      category: input.category,
      difficulty: input.difficulty,
      question_type: input.question_type,
      visibility: input.visibility,
      lesson_id: input.lesson_id,
      updated_by: userData.user?.id ?? null,
    })
    .eq("id", questionId);
  if (error) throw new Error("Gagal memperbarui soal.");
  await syncRelations(questionId, input);
}

/** Arsip / aktifkan kembali soal. Soal tidak boleh dihapus permanen. */
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

export async function deleteBankQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.from(QUESTION_TABLES.questions).delete().eq("id", questionId);
  if (error) throw new Error("Gagal menghapus soal dari Question Bank.");
}

/** Catat statistik penggunaan soal (used_count & last_used_at). */
export async function markQuestionsUsed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.rpc("touch_question_usage", { _ids: ids });
}
