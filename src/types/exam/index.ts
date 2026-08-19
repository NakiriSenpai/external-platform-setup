/** Tipe domain Exam Studio (Sprint 6 & 7). */

import type {
  QuestionAnswerRow,
  QuestionSourceType,
  QuestionOrigin,
} from "@/types/question-bank";

export type { QuestionAnswerRow, QuestionSourceType };

export type ExamStatus = "draft" | "published" | "archived";
export type ExamDifficulty = "mudah" | "sedang" | "sulit";
export type ExamSectionType = "reading" | "listening";
export type AnswerLabel = "A" | "B" | "C" | "D";

/** Baris tabel public.exams */
export type ExamRow = {
  id: string;
  tenant_id: string | null;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  difficulty: ExamDifficulty;
  passing_score: number;
  duration_minutes: number;
  status: ExamStatus;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  total_score: number;
  created_by: string | null;
  /** Icon exam (Cloudinary) — dikelola dari Exam Studio. */
  icon_url?: string | null;
  created_at: string;
  updated_at: string;
};

/** Baris tabel public.exam_sections */
export type ExamSectionRow = {
  id: string;
  exam_id: string;
  type: ExamSectionType;
  title: string;
  instruction: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

/** Baris referensi soal pada exam (Sprint 7: exam hanya menyimpan referensi). */
export type ExamQuestionRef = {
  id: string;
  exam_id: string;
  section_id: string;
  question_id: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};

/** Referensi soal + data soal dari Question Bank (flatten agar mudah dipakai UI). */
export type ExamQuestionWithAnswers = ExamQuestionRef & {
  text: string;
  instruction: string | null;
  image_url: string | null;
  audio_url: string | null;
  explanation: string | null;
  lesson_id: string | null;
  source_type: QuestionSourceType;
  origin: QuestionOrigin;
  version: number;
  is_archived: boolean;
  used_count: number;
  last_used_at: string | null;
  answers: QuestionAnswerRow[];
};

export type ExamInput = {
  title: string;
  slug: string;
  category: string;
  description: string;
  difficulty: ExamDifficulty;
  passing_score: number;
  duration_minutes: number;
  status: ExamStatus;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  icon_url?: string | null;
};

export type SectionInput = {
  type: ExamSectionType;
  title: string;
  instruction: string;
};

export const EXAM_TABLES = {
  exams: "exams",
  sections: "exam_sections",
  questions: "exam_questions",
} as const;
