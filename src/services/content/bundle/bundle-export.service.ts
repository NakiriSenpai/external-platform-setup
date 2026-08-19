/**
 * Sprint 13 — Export konten ke bundle JSON portable.
 * Tidak mengekspor kredensial, usage counter, atau runtime state tenant.
 */
import { supabase } from "@/lib/supabase/client";
import { EXAM_TABLES } from "@/types/exam";
import { LESSON_TABLES } from "@/types/lesson";
import { QUESTION_TABLES, type QuestionBankFilters } from "@/types/question-bank";
import { listBankQuestions } from "@/services/question-bank/question-bank.service";
import {
  makeEnvelope,
  slugifyKey,
  type ExamBundle,
  type LessonBundle,
  type MediaRef,
  type QuestionBundle,
} from "./bundle-schema";

const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 2000;

const QUESTION_SELECT = `id, external_key, text, image_url, audio_url, explanation, category,
  difficulty, question_type, origin, visibility, version, is_archived, created_at, updated_at,
  lesson:lessons(slug),
  answers:question_answers(label, text, image_url, audio_url, is_correct),
  tag_links:question_grammar_tags(tag:grammar_tags(slug,name)),
  general_tag_links:question_tags(tag:tags(slug,name))`;

type RawExportQuestion = {
  id: string;
  external_key: string | null;
  text: string;
  image_url: string | null;
  audio_url: string | null;
  explanation: string | null;
  category: string;
  difficulty: QuestionBundle["difficulty"];
  question_type: QuestionBundle["question_type"];
  origin: QuestionBundle["origin"];
  visibility: QuestionBundle["visibility"];
  version: number | null;
  is_archived: boolean | null;
  created_at: string;
  updated_at: string;
  lesson: { slug: string | null } | null;
  answers: {
    label: "A" | "B" | "C" | "D";
    text: string | null;
    image_url: string | null;
    audio_url: string | null;
    is_correct: boolean;
  }[] | null;
  tag_links: { tag: { slug: string; name: string } | null }[] | null;
  general_tag_links: { tag: { slug: string; name: string } | null }[] | null;
};

/** Derive referensi media portable dari URL Cloudinary. */
export function mediaFromUrl(url: string | null | undefined): MediaRef {
  if (!url) return null;
  const match = /\/upload\/(?:v\d+\/)?(.+)$/.exec(url);
  const tail = match?.[1] ?? null;
  const publicId = tail ? tail.replace(/\.[a-z0-9]+$/i, "") : null;
  const format = tail && tail.includes(".") ? (tail.split(".").pop() ?? null) : null;
  const resourceType = /\/video\/upload\//.test(url)
    ? "video"
    : /\/image\/upload\//.test(url)
      ? "image"
      : null;
  return { url, public_id: publicId, resource_type: resourceType, format };
}

function toQuestionBundle(row: RawExportQuestion): QuestionBundle {
  const answers = (row.answers ?? [])
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((answer, index) => ({
      label: answer.label,
      order: index,
      text: answer.text,
      image: mediaFromUrl(answer.image_url),
      audio: mediaFromUrl(answer.audio_url),
      is_correct: answer.is_correct,
    }));

  return {
    key: row.external_key ?? `q_${row.id.replace(/-/g, "")}`,
    source_id: row.id,
    text: row.text ?? "",
    question_type: row.question_type ?? "reading",
    difficulty: row.difficulty ?? "sedang",
    category: row.category ?? "umum",
    origin: row.origin ?? "import",
    visibility: row.visibility ?? "private",
    version: row.version ?? 1,
    explanation: row.explanation,
    image: mediaFromUrl(row.image_url),
    audio: mediaFromUrl(row.audio_url),
    lesson_slug: row.lesson?.slug ?? null,
    grammar_tags: (row.tag_links ?? []).map((l) => l.tag).filter(Boolean) as { slug: string; name: string }[],
    tags: (row.general_tag_links ?? []).map((l) => l.tag).filter(Boolean) as { slug: string; name: string }[],
    answers,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function fetchQuestionsByIds(ids: string[]): Promise<QuestionBundle[]> {
  const unique = Array.from(new Set(ids)).slice(0, MAX_EXPORT_ROWS);
  const result: QuestionBundle[] = [];
  for (let i = 0; i < unique.length; i += EXPORT_PAGE_SIZE) {
    const chunk = unique.slice(i, i + EXPORT_PAGE_SIZE);
    const { data, error } = await supabase
      .from(QUESTION_TABLES.questions)
      .select(QUESTION_SELECT)
      .in("id", chunk);
    if (error) throw new Error("Gagal memuat soal untuk export.");
    result.push(...((data as unknown as RawExportQuestion[] | null) ?? []).map(toQuestionBundle));
  }
  return result;
}

/** Ambil seluruh soal sesuai filter aktif Question Bank (paginated, aman untuk UI). */
async function fetchQuestionIdsByFilters(filters: QuestionBankFilters): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  for (;;) {
    const result = await listBankQuestions({ ...filters, page, pageSize: EXPORT_PAGE_SIZE });
    ids.push(...result.rows.map((row) => row.id));
    if (page >= result.totalPages || ids.length >= MAX_EXPORT_ROWS) break;
    page += 1;
  }
  return ids.slice(0, MAX_EXPORT_ROWS);
}

async function currentUserLabel(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? data.user?.id ?? null;
}

export type QuestionExportScope =
  | { mode: "selected"; ids: string[] }
  | { mode: "filtered"; filters: QuestionBankFilters }
  | { mode: "all" };

/** Bundle Question Bank berdasarkan pilihan/filter/semua. */
export async function buildQuestionBundle(scope: QuestionExportScope) {
  const ids =
    scope.mode === "selected"
      ? scope.ids
      : await fetchQuestionIdsByFilters(
          scope.mode === "filtered" ? scope.filters : { archived: "semua" },
        );
  const questions = await fetchQuestionsByIds(ids);
  return makeEnvelope("question_bank", questions, await currentUserLabel());
}

/** Bundle Exam: hanya referensi soal, plus opsional question bundle. */
export async function buildExamBundle(examId: string, includeQuestions: boolean) {
  const { data: examRow, error } = await supabase
    .from(EXAM_TABLES.exams)
    .select("id, title, slug, category, description, difficulty, passing_score, duration_minutes, shuffle_questions, shuffle_answers")
    .eq("id", examId)
    .maybeSingle();
  if (error || !examRow) throw new Error("Exam tidak ditemukan.");
  const exam = examRow as {
    id: string;
    title: string;
    slug: string;
    category: string;
    description: string | null;
    difficulty: ExamBundle["difficulty"];
    passing_score: number;
    duration_minutes: number;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
  };

  const { data: sectionRows } = await supabase
    .from(EXAM_TABLES.sections)
    .select("id, title, type, instruction, order_index")
    .eq("exam_id", examId)
    .order("order_index", { ascending: true });

  const sections = ((sectionRows as
    | { id: string; title: string; type: "reading" | "listening"; instruction: string | null; order_index: number }[]
    | null) ?? []).map((section) => ({
    key: `${slugifyKey(section.title) || "section"}-${section.order_index}`,
    dbId: section.id,
    title: section.title,
    type: section.type,
    instruction: section.instruction,
    order: section.order_index,
  }));
  const sectionKeyById = new Map(sections.map((s) => [s.dbId, s.key]));

  const { data: refRows } = await supabase
    .from(EXAM_TABLES.questions)
    .select("section_id, order_index, question:questions(id, external_key)")
    .eq("exam_id", examId)
    .order("order_index", { ascending: true });

  const refs = ((refRows as unknown as
    | { section_id: string; order_index: number; question: { id: string; external_key: string | null } | null }[]
    | null) ?? []).filter((row) => row.question);

  const questionIds = refs.map((row) => row.question!.id);
  const questionBundle = includeQuestions ? await fetchQuestionsByIds(questionIds) : [];

  const bundle: ExamBundle = {
    slug: exam.slug,
    source_id: exam.id,
    title: exam.title,
    category: exam.category,
    description: exam.description,
    difficulty: exam.difficulty,
    passing_score: exam.passing_score,
    duration_minutes: exam.duration_minutes,
    shuffle_questions: exam.shuffle_questions,
    shuffle_answers: exam.shuffle_answers,
    sections: sections.map(({ key, title, type, instruction, order }) => ({
      key,
      title,
      type,
      instruction,
      order,
    })),
    question_refs: refs.map((row) => ({
      question_key: row.question!.external_key ?? `q_${row.question!.id.replace(/-/g, "")}`,
      section_key: sectionKeyById.get(row.section_id) ?? "section-0",
      order: row.order_index,
    })),
    question_bundle: questionBundle,
  };

  return makeEnvelope("exam", [bundle], await currentUserLabel());
}

/** Bundle Lesson: section, block, media reference, dan referensi soal. */
export async function buildLessonBundle(lessonId: string, includeQuestions: boolean) {
  const { data: lessonRow, error } = await supabase
    .from(LESSON_TABLES.lessons)
    .select("id, title, slug, description, category, difficulty, thumbnail_url")
    .eq("id", lessonId)
    .maybeSingle();
  if (error || !lessonRow) throw new Error("Lesson tidak ditemukan.");
  const lesson = lessonRow as {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    category: string;
    difficulty: LessonBundle["difficulty"];
    thumbnail_url: string | null;
  };

  const { data: sectionRows } = await supabase
    .from(LESSON_TABLES.sections)
    .select("id, title, description, order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });
  const sections = ((sectionRows as
    | { id: string; title: string; description: string | null; order_index: number }[]
    | null) ?? []);

  const sectionIds = sections.map((s) => s.id);
  const [{ data: blockRows }, { data: questionRows }] = await Promise.all([
    sectionIds.length
      ? supabase
          .from(LESSON_TABLES.blocks)
          .select("section_id, type, content, items, media_url, order_index, grammar_tag:grammar_tags(slug)")
          .in("section_id", sectionIds)
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from(LESSON_TABLES.questions)
      .select("section_id, order_index, question:questions(id, external_key)")
      .eq("lesson_id", lessonId)
      .order("order_index", { ascending: true }),
  ]);

  const blocks = (blockRows as unknown as
    | {
        section_id: string;
        type: LessonBundle["sections"][number]["blocks"][number]["type"];
        content: string | null;
        items: string[] | null;
        media_url: string | null;
        order_index: number;
        grammar_tag: { slug: string } | null;
      }[]
    | null) ?? [];

  const questionRefs = ((questionRows as unknown as
    | { section_id: string; order_index: number; question: { id: string; external_key: string | null } | null }[]
    | null) ?? []).filter((row) => row.question);

  const bundle: LessonBundle = {
    slug: lesson.slug,
    source_id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    category: lesson.category,
    difficulty: lesson.difficulty,
    thumbnail: mediaFromUrl(lesson.thumbnail_url),
    sections: sections.map((section) => ({
      key: `${slugifyKey(section.title) || "section"}-${section.order_index}`,
      title: section.title,
      description: section.description,
      order: section.order_index,
      blocks: blocks
        .filter((b) => b.section_id === section.id)
        .map((b) => ({
          type: b.type,
          content: b.content,
          items: b.items ?? [],
          media: mediaFromUrl(b.media_url),
          grammar_tag_slug: b.grammar_tag?.slug ?? null,
          order: b.order_index,
        })),
      question_refs: questionRefs
        .filter((q) => q.section_id === section.id)
        .map((q) => ({
          question_key: q.question!.external_key ?? `q_${q.question!.id.replace(/-/g, "")}`,
          order: q.order_index,
        })),
    })),
    question_bundle: includeQuestions
      ? await fetchQuestionsByIds(questionRefs.map((q) => q.question!.id))
      : [],
  };

  return makeEnvelope("lesson", [bundle], await currentUserLabel());
}

/** Unduh bundle sebagai file JSON (kompatibel Android/desktop/tablet). */
export function downloadBundle(bundle: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
