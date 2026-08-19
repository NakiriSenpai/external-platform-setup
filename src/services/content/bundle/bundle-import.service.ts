/**
 * Sprint 13 — Import bundle konten (Question Bank, Exam, Lesson).
 *
 * Aturan:
 * - Tidak ada mutation sebelum validasi lolos.
 * - Tidak ada overwrite otomatis (default: Skip).
 * - Relasi diselesaikan lewat stable identifier, bukan UUID asal.
 * - Batch processing dengan progress agar UI tidak freeze.
 */
import { supabase } from "@/lib/supabase/client";
import { EXAM_TABLES } from "@/types/exam";
import { LESSON_TABLES } from "@/types/lesson";
import { QUESTION_TABLES } from "@/types/question-bank";
import {
  MAX_BUNDLE_BYTES,
  parseBundle,
  slugifyKey,
  type BundleType,
  type ExamFileBundle,
  type LessonFileBundle,
  type QuestionBankFileBundle,
  type QuestionBundle,
} from "./bundle-schema";
import { validateQuestion, type ValidationIssue } from "./bundle-validation.service";

export type ConflictStrategy = "skip" | "update" | "create_new";

export type ImportResultReport = {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: { label: string; reason: string }[];
  createdEntityId?: string;
};

export type QuestionPlanItem = {
  key: string;
  label: string;
  bundle: QuestionBundle;
  status: "new" | "existing" | "invalid";
  existingId: string | null;
  issues: ValidationIssue[];
  lessonMissing: boolean;
  mediaWarning: boolean;
};

export type QuestionImportPreview = {
  bundleType: BundleType;
  total: number;
  newCount: number;
  existingCount: number;
  conflictCount: number;
  invalidCount: number;
  missingLessons: string[];
  mediaWarnings: number;
  items: QuestionPlanItem[];
};

// ---------------------------------------------------------------- file IO

export type FileReadResult =
  | { ok: true; raw: unknown; sizeBytes: number }
  | { ok: false; errors: string[]; sizeBytes: number };

/** Baca & parse file JSON. Tolak file terlalu besar SEBELUM parsing. */
export async function readBundleFile(file: File): Promise<FileReadResult> {
  if (file.size > MAX_BUNDLE_BYTES) {
    return {
      ok: false,
      sizeBytes: file.size,
      errors: [
        `Ukuran file ${(file.size / 1024 / 1024).toFixed(2)} MB melebihi batas ${(MAX_BUNDLE_BYTES / 1024 / 1024).toFixed(0)} MB.`,
      ],
    };
  }
  try {
    const text = await file.text();
    return { ok: true, raw: JSON.parse(text) as unknown, sizeBytes: file.size };
  } catch {
    return { ok: false, sizeBytes: file.size, errors: ["File bukan JSON yang valid."] };
  }
}

export function validateBundle(raw: unknown, expected: BundleType) {
  return parseBundle(raw, expected);
}

// ------------------------------------------------------- dependency resolve

async function resolveTagTable(
  table: string,
  refs: { slug: string; name: string }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = new Map<string, { slug: string; name: string }>();
  for (const ref of refs) {
    const slug = slugifyKey(ref.slug || ref.name);
    if (slug) unique.set(slug, { slug, name: ref.name.trim() });
  }
  if (unique.size === 0) return map;

  const slugs = Array.from(unique.keys());
  const { data } = await supabase.from(table).select("id, slug, name").in("slug", slugs);
  for (const row of ((data as { id: string; slug: string }[] | null) ?? [])) {
    map.set(row.slug, row.id);
  }

  // Case-insensitive fallback berdasarkan nama, agar tidak membuat duplikat.
  const missing = slugs.filter((slug) => !map.has(slug));
  for (const slug of missing) {
    const ref = unique.get(slug)!;
    const { data: byName } = await supabase
      .from(table)
      .select("id, slug")
      .ilike("name", ref.name)
      .maybeSingle();
    if (byName) {
      map.set(slug, (byName as { id: string }).id);
      continue;
    }
    const { data: created } = await supabase
      .from(table)
      .insert({ slug, name: ref.name })
      .select("id")
      .maybeSingle();
    if (created) map.set(slug, (created as { id: string }).id);
  }
  return map;
}

async function resolveLessons(slugs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  if (unique.length === 0) return map;
  const { data } = await supabase.from(LESSON_TABLES.lessons).select("id, slug").in("slug", unique);
  for (const row of ((data as { id: string; slug: string }[] | null) ?? [])) {
    map.set(row.slug, row.id);
  }
  return map;
}

async function findExistingQuestions(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const { data } = await supabase
      .from(QUESTION_TABLES.questions)
      .select("id, external_key")
      .in("external_key", chunk);
    for (const row of ((data as { id: string; external_key: string | null }[] | null) ?? [])) {
      if (row.external_key) map.set(row.external_key, row.id);
    }
  }
  return map;
}

function questionIssues(bundle: QuestionBundle, label: string): ValidationIssue[] {
  const issues = validateQuestion(
    {
      text: bundle.text,
      image_url: bundle.image?.url ?? null,
      audio_url: bundle.audio?.url ?? null,
      question_type: bundle.question_type,
      visibility: bundle.visibility,
      is_archived: false,
      answers: bundle.answers.map((a) => ({
        text: a.text,
        image_url: a.image?.url ?? null,
        is_correct: a.is_correct,
      })),
    },
    label,
  );
  const labels = new Set(bundle.answers.map((a) => a.label));
  if (labels.size !== bundle.answers.length) {
    issues.push({ severity: "error", scope: label, message: "Label jawaban duplikat." });
  }
  return issues;
}

function hasMediaWarning(bundle: QuestionBundle): boolean {
  const urls = [bundle.image?.url, bundle.audio?.url, ...bundle.answers.flatMap((a) => [a.image?.url, a.audio?.url])];
  return urls.some((url) => url && !/^https:\/\//i.test(url));
}

/** Analisis bundle soal: preview new/existing/conflict/invalid tanpa mutation. */
export async function analyzeQuestions(
  questions: QuestionBundle[],
  bundleType: BundleType = "question_bank",
): Promise<QuestionImportPreview> {
  const existing = await findExistingQuestions(questions.map((q) => q.key));
  const lessonSlugs = questions.map((q) => q.lesson_slug).filter(Boolean) as string[];
  const lessonMap = await resolveLessons(lessonSlugs);

  const items: QuestionPlanItem[] = questions.map((bundle, index) => {
    const label = `Soal ${index + 1}${bundle.text ? `: ${bundle.text.slice(0, 40)}` : ""}`;
    const issues = questionIssues(bundle, label);
    const existingId = existing.get(bundle.key) ?? null;
    return {
      key: bundle.key,
      label,
      bundle,
      status: issues.some((i) => i.severity === "error") ? "invalid" : existingId ? "existing" : "new",
      existingId,
      issues,
      lessonMissing: Boolean(bundle.lesson_slug) && !lessonMap.has(bundle.lesson_slug!),
      mediaWarning: hasMediaWarning(bundle),
    };
  });

  const missingLessons = Array.from(
    new Set(items.filter((i) => i.lessonMissing).map((i) => i.bundle.lesson_slug!)),
  );

  return {
    bundleType,
    total: items.length,
    newCount: items.filter((i) => i.status === "new").length,
    existingCount: items.filter((i) => i.status === "existing").length,
    conflictCount: items.filter((i) => i.status === "existing").length,
    invalidCount: items.filter((i) => i.status === "invalid").length,
    missingLessons,
    mediaWarnings: items.filter((i) => i.mediaWarning).length,
    items,
  };
}

export async function analyzeQuestionBundle(bundle: QuestionBankFileBundle) {
  return analyzeQuestions(bundle.data, "question_bank");
}

// ------------------------------------------------------------ write helpers

type QuestionWriteContext = {
  grammarMap: Map<string, string>;
  tagMap: Map<string, string>;
  lessonMap: Map<string, string>;
};

async function buildWriteContext(questions: QuestionBundle[]): Promise<QuestionWriteContext> {
  const grammarMap = await resolveTagTable(
    QUESTION_TABLES.grammarTags,
    questions.flatMap((q) => q.grammar_tags),
  );
  const tagMap = await resolveTagTable(QUESTION_TABLES.tags, questions.flatMap((q) => q.tags));
  const lessonMap = await resolveLessons(questions.map((q) => q.lesson_slug ?? "").filter(Boolean));
  return { grammarMap, tagMap, lessonMap };
}

async function writeQuestionRelations(
  questionId: string,
  bundle: QuestionBundle,
  ctx: QuestionWriteContext,
) {
  await supabase.from(QUESTION_TABLES.answers).delete().eq("question_id", questionId);
  const { error: answerError } = await supabase.from(QUESTION_TABLES.answers).insert(
    bundle.answers.map((answer) => ({
      question_id: questionId,
      label: answer.label,
      text: answer.text,
      image_url: answer.image?.url ?? null,
      audio_url: answer.audio?.url ?? null,
      is_correct: answer.is_correct,
    })),
  );
  if (answerError) throw new Error("Gagal menyimpan pilihan jawaban.");

  await supabase.from(QUESTION_TABLES.questionGrammarTags).delete().eq("question_id", questionId);
  const grammarIds = bundle.grammar_tags
    .map((tag) => ctx.grammarMap.get(slugifyKey(tag.slug || tag.name)))
    .filter(Boolean) as string[];
  if (grammarIds.length > 0) {
    await supabase
      .from(QUESTION_TABLES.questionGrammarTags)
      .insert(Array.from(new Set(grammarIds)).map((tag_id) => ({ question_id: questionId, tag_id })));
  }

  await supabase.from(QUESTION_TABLES.questionTags).delete().eq("question_id", questionId);
  const tagIds = bundle.tags
    .map((tag) => ctx.tagMap.get(slugifyKey(tag.slug || tag.name)))
    .filter(Boolean) as string[];
  if (tagIds.length > 0) {
    await supabase
      .from(QUESTION_TABLES.questionTags)
      .insert(Array.from(new Set(tagIds)).map((tag_id) => ({ question_id: questionId, tag_id })));
  }
}

function newExternalKey(base: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base.slice(0, 100)}-${suffix}`;
}

async function insertQuestion(
  bundle: QuestionBundle,
  ctx: QuestionWriteContext,
  externalKey: string,
  userId: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from(QUESTION_TABLES.questions)
    .insert({
      external_key: externalKey,
      text: bundle.text,
      image_url: bundle.image?.url ?? null,
      audio_url: bundle.audio?.url ?? null,
      explanation: bundle.explanation,
      category: bundle.category,
      difficulty: bundle.difficulty,
      lesson_id: bundle.lesson_slug ? (ctx.lessonMap.get(bundle.lesson_slug) ?? null) : null,
      source_type: "import",
      origin: "import",
      question_type: bundle.question_type,
      visibility: bundle.visibility,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Gagal menyimpan soal.");
  const questionId = (data as { id: string }).id;
  try {
    await writeQuestionRelations(questionId, bundle, ctx);
  } catch (err) {
    await supabase.from(QUESTION_TABLES.questions).delete().eq("id", questionId);
    throw err;
  }
  return questionId;
}

async function updateQuestionRow(
  questionId: string,
  bundle: QuestionBundle,
  ctx: QuestionWriteContext,
  userId: string | null,
) {
  const { data: current } = await supabase
    .from(QUESTION_TABLES.questions)
    .select("version")
    .eq("id", questionId)
    .maybeSingle();
  const version = ((current as { version: number | null } | null)?.version ?? 1) + 1;

  // origin bersifat immutable: tidak ikut diperbarui.
  const { error } = await supabase
    .from(QUESTION_TABLES.questions)
    .update({
      text: bundle.text,
      image_url: bundle.image?.url ?? null,
      audio_url: bundle.audio?.url ?? null,
      explanation: bundle.explanation,
      category: bundle.category,
      difficulty: bundle.difficulty,
      lesson_id: bundle.lesson_slug ? (ctx.lessonMap.get(bundle.lesson_slug) ?? null) : null,
      question_type: bundle.question_type,
      visibility: bundle.visibility,
      version,
      updated_by: userId,
    })
    .eq("id", questionId);
  if (error) throw new Error("Gagal memperbarui soal.");
  await writeQuestionRelations(questionId, bundle, ctx);
}

export type QuestionImportOptions = {
  strategy: ConflictStrategy;
  /** Jika false, item dengan lesson tidak ditemukan akan dilewati. */
  allowMissingLesson: boolean;
  onProgress?: ((done: number, total: number) => void) | undefined;
};

/**
 * Import soal per batch dengan laporan lengkap.
 * Mengembalikan juga peta key -> question id untuk resolusi Exam/Lesson.
 */
export async function importQuestions(
  preview: QuestionImportPreview,
  options: QuestionImportOptions,
): Promise<ImportResultReport & { keyMap: Map<string, string> }> {
  const report: ImportResultReport & { keyMap: Map<string, string> } = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    keyMap: new Map(),
  };

  const usable = preview.items.filter((item) => item.status !== "invalid");
  report.skipped += preview.items.length - usable.length;

  const ctx = await buildWriteContext(usable.map((i) => i.bundle));
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  let done = 0;
  for (const item of usable) {
    try {
      if (item.lessonMissing && !options.allowMissingLesson) {
        report.skipped += 1;
        continue;
      }
      if (item.existingId) {
        if (options.strategy === "skip") {
          report.skipped += 1;
          report.keyMap.set(item.key, item.existingId);
        } else if (options.strategy === "update") {
          await updateQuestionRow(item.existingId, item.bundle, ctx, userId);
          report.updated += 1;
          report.keyMap.set(item.key, item.existingId);
        } else {
          const id = await insertQuestion(item.bundle, ctx, newExternalKey(item.key), userId);
          report.imported += 1;
          report.keyMap.set(item.key, id);
        }
      } else {
        const id = await insertQuestion(item.bundle, ctx, item.key, userId);
        report.imported += 1;
        report.keyMap.set(item.key, id);
      }
    } catch (err) {
      report.failed += 1;
      report.failures.push({
        label: item.label,
        reason: err instanceof Error ? err.message : "Kesalahan tidak diketahui.",
      });
    } finally {
      done += 1;
      options.onProgress?.(done, usable.length);
      // beri ruang ke event loop agar UI tetap responsif
      if (done % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return report;
}

// ------------------------------------------------------------------- EXAM

export type ExamImportPreview = {
  slug: string;
  title: string;
  sectionCount: number;
  questionRefCount: number;
  resolvedKeys: string[];
  missingKeys: string[];
  /** Soal missing yang tersedia di dalam bundle dan bisa diimport lebih dulu. */
  resolvableFromBundle: string[];
  slugTaken: boolean;
  questionPreview: QuestionImportPreview | null;
};

export async function analyzeExamBundle(bundle: ExamFileBundle): Promise<ExamImportPreview[]> {
  const previews: ExamImportPreview[] = [];
  for (const exam of bundle.data) {
    const keys = Array.from(new Set(exam.question_refs.map((r) => r.question_key)));
    const existing = await findExistingQuestions(keys);
    const missingKeys = keys.filter((key) => !existing.has(key));
    const bundleKeys = new Set(exam.question_bundle.map((q) => q.key));
    const { data: slugRow } = await supabase
      .from(EXAM_TABLES.exams)
      .select("id")
      .eq("slug", exam.slug)
      .maybeSingle();

    previews.push({
      slug: exam.slug,
      title: exam.title,
      sectionCount: exam.sections.length,
      questionRefCount: exam.question_refs.length,
      resolvedKeys: keys.filter((key) => existing.has(key)),
      missingKeys,
      resolvableFromBundle: missingKeys.filter((key) => bundleKeys.has(key)),
      slugTaken: Boolean(slugRow),
      questionPreview: exam.question_bundle.length
        ? await analyzeQuestions(exam.question_bundle, "exam")
        : null,
    });
  }
  return previews;
}

async function uniqueSlug(table: string, slug: string): Promise<string> {
  let candidate = slug;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data } = await supabase.from(table).select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${slug}-${attempt + 2}`;
  }
  return `${slug}-${Date.now()}`;
}

export type ExamImportOptions = {
  /** Import soal dari question_bundle terlebih dahulu. */
  importBundledQuestions: boolean;
  strategy: ConflictStrategy;
  /** Lanjutkan walau ada soal yang tidak ditemukan. */
  allowMissingQuestions: boolean;
  onProgress?: ((done: number, total: number) => void) | undefined;
};

/** Import Exam. Hasil SELALU berstatus draft. */
export async function importExam(
  bundle: ExamFileBundle,
  options: ExamImportOptions,
): Promise<ImportResultReport> {
  const exam = bundle.data[0];
  if (!exam) throw new Error("Bundle exam kosong.");

  const report: ImportResultReport = { imported: 0, updated: 0, skipped: 0, failed: 0, failures: [] };
  const keyMap = new Map<string, string>();

  if (options.importBundledQuestions && exam.question_bundle.length > 0) {
    const preview = await analyzeQuestions(exam.question_bundle, "exam");
    const questionResult = await importQuestions(preview, {
      strategy: options.strategy,
      allowMissingLesson: true,
      onProgress: options.onProgress,
    });
    report.imported += questionResult.imported;
    report.updated += questionResult.updated;
    report.skipped += questionResult.skipped;
    report.failed += questionResult.failed;
    report.failures.push(...questionResult.failures);
    for (const [key, id] of questionResult.keyMap) keyMap.set(key, id);
  }

  const keys = Array.from(new Set(exam.question_refs.map((r) => r.question_key)));
  const existing = await findExistingQuestions(keys);
  for (const [key, id] of existing) keyMap.set(key, id);
  const missing = keys.filter((key) => !keyMap.has(key));
  if (missing.length > 0 && !options.allowMissingQuestions) {
    throw new Error(`${missing.length} soal tidak ditemukan. Import dibatalkan.`);
  }

  const slug = await uniqueSlug(EXAM_TABLES.exams, exam.slug);
  const { data: userData } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from(EXAM_TABLES.exams)
    .insert({
      title: exam.title,
      slug,
      category: exam.category,
      description: exam.description,
      difficulty: exam.difficulty,
      passing_score: exam.passing_score,
      duration_minutes: exam.duration_minutes,
      shuffle_questions: exam.shuffle_questions,
      shuffle_answers: exam.shuffle_answers,
      status: "draft",
      created_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("Gagal membuat exam hasil import.");
  const examId = (created as { id: string }).id;

  try {
    const sectionIdByKey = new Map<string, string>();
    for (const section of [...exam.sections].sort((a, b) => a.order - b.order)) {
      const { data: sectionRow, error: sectionError } = await supabase
        .from(EXAM_TABLES.sections)
        .insert({
          exam_id: examId,
          type: section.type,
          title: section.title,
          instruction: section.instruction,
          order_index: section.order,
        })
        .select("id")
        .single();
      if (sectionError || !sectionRow) throw new Error("Gagal membuat section exam.");
      sectionIdByKey.set(section.key, (sectionRow as { id: string }).id);
    }

    const refs = [...exam.question_refs]
      .sort((a, b) => a.order - b.order)
      .map((ref) => ({
        exam_id: examId,
        section_id: sectionIdByKey.get(ref.section_key) ?? null,
        question_id: keyMap.get(ref.question_key) ?? null,
        order_index: ref.order,
      }))
      .filter((row) => row.section_id && row.question_id);

    if (refs.length > 0) {
      const { error: refError } = await supabase.from(EXAM_TABLES.questions).insert(refs);
      if (refError) throw new Error("Gagal menghubungkan soal ke exam.");
    }

    report.skipped += missing.length;
    for (const key of missing) {
      report.failures.push({ label: `Soal ${key}`, reason: "Tidak ditemukan di Question Bank." });
    }
    report.createdEntityId = examId;
    return report;
  } catch (err) {
    // rollback exam yang baru dibuat agar tidak meninggalkan data setengah jadi
    await supabase.from(EXAM_TABLES.exams).delete().eq("id", examId);
    throw err;
  }
}

// ----------------------------------------------------------------- LESSON

export type LessonImportPreview = {
  slug: string;
  title: string;
  sectionCount: number;
  blockCount: number;
  questionRefCount: number;
  missingKeys: string[];
  resolvableFromBundle: string[];
  slugTaken: boolean;
  questionPreview: QuestionImportPreview | null;
};

export async function analyzeLessonBundle(bundle: LessonFileBundle): Promise<LessonImportPreview[]> {
  const previews: LessonImportPreview[] = [];
  for (const lesson of bundle.data) {
    const keys = Array.from(
      new Set(lesson.sections.flatMap((s) => s.question_refs.map((r) => r.question_key))),
    );
    const existing = await findExistingQuestions(keys);
    const bundleKeys = new Set(lesson.question_bundle.map((q) => q.key));
    const missingKeys = keys.filter((key) => !existing.has(key));
    const { data: slugRow } = await supabase
      .from(LESSON_TABLES.lessons)
      .select("id")
      .eq("slug", lesson.slug)
      .maybeSingle();

    previews.push({
      slug: lesson.slug,
      title: lesson.title,
      sectionCount: lesson.sections.length,
      blockCount: lesson.sections.reduce((sum, s) => sum + s.blocks.length, 0),
      questionRefCount: keys.length,
      missingKeys,
      resolvableFromBundle: missingKeys.filter((key) => bundleKeys.has(key)),
      slugTaken: Boolean(slugRow),
      questionPreview: lesson.question_bundle.length
        ? await analyzeQuestions(lesson.question_bundle, "lesson")
        : null,
    });
  }
  return previews;
}

export type LessonImportOptions = ExamImportOptions;

/** Import Lesson. Hasil SELALU berstatus draft. */
export async function importLesson(
  bundle: LessonFileBundle,
  options: LessonImportOptions,
): Promise<ImportResultReport> {
  const lesson = bundle.data[0];
  if (!lesson) throw new Error("Bundle lesson kosong.");

  const report: ImportResultReport = { imported: 0, updated: 0, skipped: 0, failed: 0, failures: [] };
  const keyMap = new Map<string, string>();

  if (options.importBundledQuestions && lesson.question_bundle.length > 0) {
    const preview = await analyzeQuestions(lesson.question_bundle, "lesson");
    const questionResult = await importQuestions(preview, {
      strategy: options.strategy,
      allowMissingLesson: true,
      onProgress: options.onProgress,
    });
    report.imported += questionResult.imported;
    report.updated += questionResult.updated;
    report.skipped += questionResult.skipped;
    report.failed += questionResult.failed;
    report.failures.push(...questionResult.failures);
    for (const [key, id] of questionResult.keyMap) keyMap.set(key, id);
  }

  const keys = Array.from(
    new Set(lesson.sections.flatMap((s) => s.question_refs.map((r) => r.question_key))),
  );
  const existing = await findExistingQuestions(keys);
  for (const [key, id] of existing) keyMap.set(key, id);
  const missing = keys.filter((key) => !keyMap.has(key));
  if (missing.length > 0 && !options.allowMissingQuestions) {
    throw new Error(`${missing.length} soal tidak ditemukan. Import dibatalkan.`);
  }

  const grammarMap = await resolveTagTable(
    QUESTION_TABLES.grammarTags,
    lesson.sections
      .flatMap((s) => s.blocks)
      .map((b) => b.grammar_tag_slug)
      .filter(Boolean)
      .map((slug) => ({ slug: slug!, name: slug! })),
  );

  const slug = await uniqueSlug(LESSON_TABLES.lessons, lesson.slug);
  const { data: userData } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from(LESSON_TABLES.lessons)
    .insert({
      title: lesson.title,
      slug,
      category: lesson.category,
      description: lesson.description,
      thumbnail_url: lesson.thumbnail?.url ?? null,
      difficulty: lesson.difficulty,
      status: "draft",
      created_by: userData.user?.id ?? null,
      updated_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("Gagal membuat lesson hasil import.");
  const lessonId = (created as { id: string }).id;

  try {
    for (const section of [...lesson.sections].sort((a, b) => a.order - b.order)) {
      const { data: sectionRow, error: sectionError } = await supabase
        .from(LESSON_TABLES.sections)
        .insert({
          lesson_id: lessonId,
          title: section.title,
          description: section.description,
          order_index: section.order,
        })
        .select("id")
        .single();
      if (sectionError || !sectionRow) throw new Error("Gagal membuat section lesson.");
      const sectionId = (sectionRow as { id: string }).id;

      if (section.blocks.length > 0) {
        const { error: blockError } = await supabase.from(LESSON_TABLES.blocks).insert(
          [...section.blocks]
            .sort((a, b) => a.order - b.order)
            .map((block) => ({
              section_id: sectionId,
              type: block.type,
              content: block.content,
              items: block.items,
              media_url: block.media?.url ?? null,
              grammar_tag_id: block.grammar_tag_slug
                ? (grammarMap.get(slugifyKey(block.grammar_tag_slug)) ?? null)
                : null,
              order_index: block.order,
            })),
        );
        if (blockError) throw new Error("Gagal membuat konten lesson.");
      }

      const refs = [...section.question_refs]
        .sort((a, b) => a.order - b.order)
        .map((ref) => ({
          lesson_id: lessonId,
          section_id: sectionId,
          question_id: keyMap.get(ref.question_key) ?? null,
          order_index: ref.order,
        }))
        .filter((row) => row.question_id);
      if (refs.length > 0) {
        const { error: refError } = await supabase.from(LESSON_TABLES.questions).insert(refs);
        if (refError) throw new Error("Gagal menghubungkan soal latihan.");
      }
    }

    report.skipped += missing.length;
    for (const key of missing) {
      report.failures.push({ label: `Soal ${key}`, reason: "Tidak ditemukan di Question Bank." });
    }
    report.createdEntityId = lessonId;
    return report;
  } catch (err) {
    await supabase.from(LESSON_TABLES.lessons).delete().eq("id", lessonId);
    throw err;
  }
}
