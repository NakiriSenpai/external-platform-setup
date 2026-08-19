/** Tipe domain Question Bank (Sprint 7, dibersihkan pada Sprint 22). */

export type QuestionSourceType = "exam" | "lesson" | "import" | "manual";
export type QuestionOrigin = "manual" | "exam" | "lesson" | "import";
export type MediaFilter = "semua" | "image" | "audio" | "none";

export type LessonRow = {
  id: string;
  title: string;
  slug?: string;
};

export type QuestionAnswerRow = {
  id: string;
  question_id: string;
  label: "A" | "B" | "C" | "D";
  text: string | null;
  image_url: string | null;
  audio_url: string | null;
  is_correct: boolean;
};

export type QuestionBankRow = {
  id: string;
  tenant_id: string | null;
  text: string;
  /** Perintah Soal (rich text HTML sederhana). */
  instruction: string | null;
  image_url: string | null;
  audio_url: string | null;
  explanation: string | null;
  lesson_id: string | null;
  source_type: QuestionSourceType;
  origin: QuestionOrigin;
  version: number;
  is_archived: boolean;
  /** Soal yang dihapus dari Question Bank aktif (tetap dipakai Exam lama). */
  deleted_at: string | null;
  correct_count: number;
  wrong_count: number;
  skip_count: number;
  created_from: string | null;
  used_count: number;
  last_used_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  answers: QuestionAnswerRow[];
  lesson: LessonRow | null;
};

export type QuestionAnswerInput = {
  label: "A" | "B" | "C" | "D";
  text: string;
  image_url: string | null;
  audio_url: string | null;
  is_correct: boolean;
};

export type QuestionBankInput = {
  text: string;
  instruction?: string | null;
  image_url: string | null;
  audio_url: string | null;
  explanation: string;
  lesson_id: string | null;
  source_type: QuestionSourceType;
  origin?: QuestionOrigin;
  created_from: string | null;
  answers: QuestionAnswerInput[];
};

export type QuestionBankFilters = {
  search?: string;
  source?: "semua" | QuestionSourceType;
  media?: MediaFilter;
  origin?: "semua" | QuestionOrigin;
  archived?: "aktif" | "arsip" | "semua";
  page?: number;
  pageSize?: number;
};

export type QuestionBankResult = {
  rows: QuestionBankRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Hasil penghapusan soal dari Question Bank. */
export type QuestionDeleteResult = "hard" | "soft";

export const QUESTION_TABLES = {
  questions: "questions",
  answers: "question_answers",
  lessons: "lessons",
} as const;

export const SOURCE_LABELS: Record<QuestionSourceType, string> = {
  exam: "Exam Studio",
  lesson: "Lesson Studio",
  import: "Import",
  manual: "Manual",
};

export const ORIGIN_LABELS: Record<QuestionOrigin, string> = {
  manual: "Manual",
  exam: "Exam Studio",
  lesson: "Lesson Studio",
  import: "Import",
};
