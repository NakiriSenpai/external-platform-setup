/** Tipe domain Color Test / Tes Buta Warna (Sprint 25). */

export type ColorTestStatus = "in_progress" | "passed" | "failed";

export type ColorTestSession = {
  id: string;
  exam_attempt_id: string;
  user_id: string;
  status: ColorTestStatus;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  min_correct: number;
  max_skip: number;
  time_limit_seconds: number;
  started_at: string;
  expires_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  passed: boolean;
  finish_reason: string | null;
};

export type ColorTestQuestion = {
  question_id: string;
  question_order: number;
  image_url: string;
  answer_type: string;
  user_answer: string | null;
  skipped: boolean;
  answered: boolean;
  /** Hanya terisi setelah sesi selesai. */
  result: "pending" | "correct" | "wrong" | "skipped" | null;
  correct_answer: string | null;
};

export type ColorTestPayload = {
  session: ColorTestSession;
  questions: ColorTestQuestion[];
  server_time: string;
};

/** Ringkasan untuk Result Page & Riwayat. */
export type ColorTestSummary = {
  exam_attempt_id: string;
  status: ColorTestStatus;
  passed: boolean;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  total_questions: number;
  max_skip: number;
  duration_seconds: number | null;
  completed_at: string | null;
};

/** Soal pada pool (owner only). */
export type ColorTestPoolQuestion = {
  id: string;
  image_url: string;
  image_public_id: string | null;
  correct_answer: string;
  answer_type: string;
  difficulty: string | null;
  category: string | null;
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export const COLOR_TEST_TOTAL = 12;
export const COLOR_TEST_MIN_CORRECT = 7;
export const COLOR_TEST_MAX_SKIP = 3;
export const COLOR_TEST_SECONDS = 150;
