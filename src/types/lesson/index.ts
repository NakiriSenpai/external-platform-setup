/** Tipe domain Lesson Studio (Sprint 9). */

import type { ExamDifficulty } from "@/types/exam";
import type {
  GrammarTagRow,
  QuestionAnswerRow,
  QuestionBankRow,
  QuestionOrigin,
  QuestionSourceType,
  QuestionType,
  QuestionVisibility,
  TagRow,
} from "@/types/question-bank";


export type LessonStatus = "draft" | "published" | "archived";

export type LessonBlockType =
  | "heading"
  | "paragraph"
  | "bullet_list"
  | "image"
  | "audio"
  | "callout"
  | "divider"
  | "grammar_highlight";

/** Baris tabel public.lessons */
export type LessonDetailRow = {
  id: string;
  tenant_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  difficulty: ExamDifficulty;
  status: LessonStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Baris daftar lesson + jumlah section & soal. */
export type LessonListItem = LessonDetailRow & {
  section_count: number;
  question_count: number;
};

export type LessonSectionRow = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type LessonBlockRow = {
  id: string;
  section_id: string;
  type: LessonBlockType;
  content: string | null;
  items: string[];
  media_url: string | null;
  grammar_tag_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  grammar_tag?: GrammarTagRow | null;
};

/** Referensi soal latihan pada lesson (soal tetap milik Question Bank). */
export type LessonQuestionRef = {
  id: string;
  lesson_id: string;
  section_id: string;
  question_id: string;
  order_index: number;
};

export type LessonQuestionWithAnswers = LessonQuestionRef & {
  text: string;
  image_url: string | null;
  audio_url: string | null;
  explanation: string | null;
  category: string;
  difficulty: ExamDifficulty;
  question_type: QuestionType;
  visibility: QuestionVisibility;
  origin: QuestionOrigin;
  source_type: QuestionSourceType;
  version: number;
  is_archived: boolean;
  grammar_tags: GrammarTagRow[];
  tags: TagRow[];
  answers: QuestionAnswerRow[];
};


export type LessonInput = {
  title: string;
  slug: string;
  category: string;
  description: string;
  thumbnail_url: string | null;
  difficulty: ExamDifficulty;
  status: LessonStatus;
};

export type LessonSectionInput = {
  title: string;
  description: string;
};

export type LessonBlockInput = {
  type: LessonBlockType;
  content: string;
  items: string[];
  media_url: string | null;
  grammar_tag_id: string | null;
};

export type LessonListParams = {
  search?: string;
  category?: "semua" | string;
  status?: "semua" | LessonStatus;
  difficulty?: "semua" | ExamDifficulty;
  page?: number;
  pageSize?: number;
};

export type LessonListResult = {
  rows: LessonListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LessonQuestionSource = QuestionBankRow;

// ---------- SPRINT 16: STUDENT LESSON PROGRESS ----------

export type LessonProgressStatus = "not_started" | "in_progress" | "completed";

/** Baris tabel public.lesson_progress (ditulis hanya via RPC SECURITY DEFINER). */
export type LessonProgressRow = {
  id: string;
  user_id: string;
  tenant_id: string | null;
  lesson_id: string;
  status: LessonProgressStatus;
  progress_percent: number;
  completed_units: string[];
  total_units: number;
  current_block_id: string | null;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Materi + status progres siswa (dipakai /materi & dashboard). */
export type LessonWithProgress = LessonDetailRow & {
  progress: LessonProgressRow | null;
};

export type LessonAnalyticsOverview = {
  total_lessons: number;
  started: number;
  in_progress: number;
  completed: number;
  active_learners: number;
  completion_rate: number;
  average_progress: number;
};

export type LessonAnalyticsRow = {
  lesson_id: string;
  lesson_title: string;
  category: string;
  started: number;
  in_progress: number;
  completed: number;
  completion_rate: number;
  average_progress: number;
  last_activity_at: string | null;
};

export type StudentLessonProgressRow = {
  lesson_id: string;
  lesson_title: string;
  category: string;
  status: LessonProgressStatus;
  progress_percent: number;
  last_activity_at: string | null;
  completed_at: string | null;
};

export type StudentCategoryProgressRow = {
  category: string;
  lessons_started: number;
  lessons_completed: number;
  average_progress: number;
};

export const LESSON_TABLES = {
  lessons: "lessons",
  sections: "lesson_sections",
  blocks: "lesson_blocks",
  questions: "lesson_questions",
  progress: "lesson_progress",
} as const;

