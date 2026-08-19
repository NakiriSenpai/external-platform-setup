/**
 * Sprint 13 — Skema bundle portable untuk Import/Export konten.
 *
 * Prinsip:
 * - JSON adalah format utama.
 * - Relasi diselesaikan lewat stable identifier (external_key / slug),
 *   BUKAN UUID database asal. UUID hanya disimpan sebagai `source_id`.
 * - Bundle tidak boleh membawa kredensial apa pun.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1;

/** Batas ukuran file import (byte). Ditolak sebelum parsing. */
export const MAX_BUNDLE_BYTES = 8 * 1024 * 1024;

export type BundleType = "question_bank" | "exam" | "lesson";

const difficulty = z.enum(["mudah", "sedang", "sulit"]);
const questionTypeEnum = z.enum([
  "reading",
  "listening",
  "grammar",
  "vocabulary",
  "conversation",
  "mixed",
]);
const originEnum = z.enum(["manual", "exam", "lesson", "import"]);
const visibilityEnum = z.enum(["private", "public"]);
const answerLabel = z.enum(["A", "B", "C", "D"]);

/** Referensi media portable (URL saja tidak dianggap stabil). */
export const mediaRefSchema = z
  .object({
    url: z.string().min(1),
    public_id: z.string().nullish(),
    resource_type: z.string().nullish(),
    format: z.string().nullish(),
  })
  .nullable();

export const tagRefSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
});

export const answerBundleSchema = z.object({
  label: answerLabel,
  order: z.number().int().min(0).max(9).optional(),
  text: z.string().max(2000).nullable().default(null),
  image: mediaRefSchema.default(null),
  audio: mediaRefSchema.default(null),
  is_correct: z.boolean(),
});

export const questionBundleSchema = z.object({
  /** Stable identifier portable. */
  key: z.string().min(3).max(120),
  /** UUID asal — informasi saja, tidak dipakai untuk resolusi. */
  source_id: z.string().nullish(),
  text: z.string().max(8000).default(""),
  question_type: questionTypeEnum.default("reading"),
  difficulty: difficulty.default("sedang"),
  category: z.string().min(1).max(80).default("umum"),
  origin: originEnum.default("import"),
  visibility: visibilityEnum.default("private"),
  version: z.number().int().min(1).default(1),
  explanation: z.string().max(8000).nullable().default(null),
  image: mediaRefSchema.default(null),
  audio: mediaRefSchema.default(null),
  /** Referensi lesson memakai slug, bukan UUID. */
  lesson_slug: z.string().max(160).nullable().default(null),
  grammar_tags: z.array(tagRefSchema).default([]),
  tags: z.array(tagRefSchema).default([]),
  answers: z.array(answerBundleSchema).min(1).max(8),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

export const examSectionBundleSchema = z.object({
  key: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  type: z.enum(["reading", "listening"]).default("reading"),
  order: z.number().int().min(0),
  instruction: z.string().max(2000).nullable().default(null),
});

export const examQuestionRefSchema = z.object({
  question_key: z.string().min(3).max(120),
  section_key: z.string().min(1).max(120),
  order: z.number().int().min(0),
});

export const examBundleSchema = z.object({
  slug: z.string().min(1).max(160),
  source_id: z.string().nullish(),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(80).default("umum"),
  description: z.string().max(4000).nullable().default(null),
  difficulty: difficulty.default("sedang"),
  passing_score: z.number().int().min(0).max(100).default(70),
  duration_minutes: z.number().int().min(1).max(600).default(60),
  shuffle_questions: z.boolean().default(false),
  shuffle_answers: z.boolean().default(false),
  sections: z.array(examSectionBundleSchema).default([]),
  question_refs: z.array(examQuestionRefSchema).default([]),
  /** Opsional: soal ikut dibawa agar bisa di-resolve saat target belum punya. */
  question_bundle: z.array(questionBundleSchema).default([]),
});

export const lessonBlockBundleSchema = z.object({
  type: z.enum([
    "heading",
    "paragraph",
    "bullet_list",
    "image",
    "audio",
    "callout",
    "divider",
    "grammar_highlight",
  ]),
  content: z.string().max(20000).nullable().default(null),
  items: z.array(z.string().max(2000)).default([]),
  media: mediaRefSchema.default(null),
  grammar_tag_slug: z.string().max(80).nullable().default(null),
  order: z.number().int().min(0),
});

export const lessonSectionBundleSchema = z.object({
  key: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().default(null),
  order: z.number().int().min(0),
  blocks: z.array(lessonBlockBundleSchema).default([]),
  question_refs: z
    .array(z.object({ question_key: z.string().min(3).max(120), order: z.number().int().min(0) }))
    .default([]),
});

export const lessonBundleSchema = z.object({
  slug: z.string().min(1).max(160),
  source_id: z.string().nullish(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().default(null),
  category: z.string().min(1).max(80).default("umum"),
  difficulty: difficulty.default("sedang"),
  thumbnail: mediaRefSchema.default(null),
  sections: z.array(lessonSectionBundleSchema).default([]),
  question_bundle: z.array(questionBundleSchema).default([]),
});

const envelope = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  exported_at: z.string().min(1),
  exported_by: z.string().nullable().default(null),
  source: z.string().min(1).default("lpk-learning"),
});

export const questionBankBundleSchema = envelope.extend({
  bundle_type: z.literal("question_bank"),
  data: z.array(questionBundleSchema),
});

export const examFileBundleSchema = envelope.extend({
  bundle_type: z.literal("exam"),
  data: z.array(examBundleSchema),
});

export const lessonFileBundleSchema = envelope.extend({
  bundle_type: z.literal("lesson"),
  data: z.array(lessonBundleSchema),
});

export const anyBundleSchema = z.discriminatedUnion("bundle_type", [
  questionBankBundleSchema,
  examFileBundleSchema,
  lessonFileBundleSchema,
]);

export type MediaRef = z.infer<typeof mediaRefSchema>;
export type TagRef = z.infer<typeof tagRefSchema>;
export type QuestionBundle = z.infer<typeof questionBundleSchema>;
export type ExamBundle = z.infer<typeof examBundleSchema>;
export type LessonBundle = z.infer<typeof lessonBundleSchema>;
export type QuestionBankFileBundle = z.infer<typeof questionBankBundleSchema>;
export type ExamFileBundle = z.infer<typeof examFileBundleSchema>;
export type LessonFileBundle = z.infer<typeof lessonFileBundleSchema>;
export type AnyBundle = z.infer<typeof anyBundleSchema>;

/** Key yang dilarang muncul di bundle (security: tidak menerima kredensial). */
const FORBIDDEN_KEYS = [
  "service_role",
  "service_role_key",
  "password",
  "access_token",
  "refresh_token",
  "jwt",
  "api_secret",
  "api_key",
  "anon_key",
  "session",
  "authorization",
];

/** Cari key terlarang secara rekursif (JSON diperlakukan sebagai data, bukan code). */
export function findForbiddenKeys(value: unknown, depth = 0): string[] {
  if (depth > 12 || value === null || typeof value !== "object") return [];
  const found: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) found.push(...findForbiddenKeys(item, depth + 1));
    return found;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) found.push(key);
    found.push(...findForbiddenKeys(child, depth + 1));
  }
  return Array.from(new Set(found));
}

export type BundleParseResult =
  | { ok: true; bundle: AnyBundle }
  | { ok: false; errors: string[] };

/** Validasi penuh: envelope, tipe field, enum, struktur, duplikat identifier. */
export function parseBundle(raw: unknown, expected?: BundleType): BundleParseResult {
  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return {
      ok: false,
      errors: [`Bundle mengandung data sensitif dan ditolak: ${forbidden.join(", ")}`],
    };
  }

  const parsed = anyBundleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 30).map((i) => `${i.path.join(".") || "bundle"}: ${i.message}`),
    };
  }

  const bundle = parsed.data;
  if (expected && bundle.bundle_type !== expected) {
    return {
      ok: false,
      errors: [`Tipe bundle tidak sesuai. Diharapkan "${expected}", ditemukan "${bundle.bundle_type}".`],
    };
  }

  const duplicates = findDuplicateIdentifiers(bundle);
  if (duplicates.length > 0) {
    return { ok: false, errors: duplicates };
  }

  return { ok: true, bundle };
}

function findDuplicateIdentifiers(bundle: AnyBundle): string[] {
  const errors: string[] = [];
  const dup = (values: string[], label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) errors.push(`${label} duplikat di dalam bundle: ${value}`);
      seen.add(value);
    }
  };

  if (bundle.bundle_type === "question_bank") {
    dup(bundle.data.map((q) => q.key), "Question key");
  }
  if (bundle.bundle_type === "exam") {
    dup(bundle.data.map((e) => e.slug), "Exam slug");
    for (const exam of bundle.data) {
      dup(exam.sections.map((s) => s.key), `Section key (exam ${exam.slug})`);
      dup(exam.question_bundle.map((q) => q.key), `Question key (exam ${exam.slug})`);
      const sectionKeys = new Set(exam.sections.map((s) => s.key));
      for (const ref of exam.question_refs) {
        if (!sectionKeys.has(ref.section_key)) {
          errors.push(`Exam ${exam.slug}: referensi section tidak valid (${ref.section_key}).`);
        }
      }
    }
  }
  if (bundle.bundle_type === "lesson") {
    dup(bundle.data.map((l) => l.slug), "Lesson slug");
    for (const lesson of bundle.data) {
      dup(lesson.sections.map((s) => s.key), `Section key (lesson ${lesson.slug})`);
      dup(lesson.question_bundle.map((q) => q.key), `Question key (lesson ${lesson.slug})`);
    }
  }
  return errors;
}

/** Bungkus data ke envelope bundle standar. */
export function makeEnvelope<T>(bundleType: BundleType, data: T[], exportedBy: string | null) {
  return {
    schema_version: SCHEMA_VERSION,
    bundle_type: bundleType,
    exported_at: new Date().toISOString(),
    exported_by: exportedBy,
    source: "lpk-learning",
    data,
  };
}

export function slugifyKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
