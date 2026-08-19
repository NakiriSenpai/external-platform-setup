/** Tipe domain Exam Engine (Sprint 10A). */

import type { AnswerLabel, ExamSectionType } from "@/types/exam";
import type { GrammarTagRow } from "@/types/question-bank";

export type AttemptStatus = "in_progress" | "submitted" | "expired" | "cancelled";

export type AttemptRow = {
  id: string;
  exam_id: string;
  user_id: string;
  tenant_id: string | null;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  finished_at: string | null;
  duration_minutes: number;
  total_questions: number;
  fullscreen_violations: number;
  fullscreen_limit: number;
  auto_submitted: boolean;
  submit_reason: string | null;
  score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  passed: boolean;
  duration_seconds: number;
  submitted_at: string | null;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Hasil ujian permanen (Sprint 10B). Dihitung sekali saat submit. */
export type AttemptResultRow = {
  id: string;
  attempt_id: string;
  exam_id: string;
  user_id: string;
  tenant_id: string | null;
  exam_title: string;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  score: number;
  passing_score: number;
  passed: boolean;
  duration_seconds: number;
  started_at: string;
  submitted_at: string;
  auto_submitted: boolean;
  submit_reason: string | null;
  created_at: string;
};

/** Jawaban pada snapshot versi siswa (tanpa kunci jawaban). */
export type SnapshotAnswer = {
  label: AnswerLabel;
  text: string | null;
  image_url: string | null;
  audio_url: string | null;
};

/** Soal beku di dalam snapshot. */
export type SnapshotQuestion = {
  question_id: string;
  index: number;
  section_id: string;
  text: string;
  instruction?: string | null;
  image_url: string | null;
  audio_url: string | null;
  lesson_id: string | null;
  answers: SnapshotAnswer[];
  /** Hanya ada pada payload internal (tidak dikirim ke siswa). */
  explanation?: string | null;
  correct_label?: AnswerLabel | null;
};

export type SnapshotSection = {
  section_id: string;
  type: ExamSectionType;
  title: string;
  instruction: string | null;
  order_index: number;
  question_ids: string[];
};

export type SnapshotExam = {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  difficulty: string;
  passing_score: number;
  duration_minutes: number;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  total_score: number;
};

/** Struktur snapshot yang dibaca siswa. */
export type ExamSnapshot = {
  version: 1;
  created_at: string;
  exam: SnapshotExam;
  sections: SnapshotSection[];
  questions: SnapshotQuestion[];
  points_per_question: number;
  fullscreen_limit: number;
};

export type AttemptAnswerRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  question_index: number;
  selected_label: AnswerLabel | null;
  is_flagged: boolean;
  answered_at: string | null;
};

/** Seluruh state attempt yang dibutuhkan runner. */
export type AttemptSession = {
  attempt: AttemptRow;
  snapshot: ExamSnapshot;
  answers: AttemptAnswerRow[];
};

export const ATTEMPT_TABLES = {
  attempts: "exam_attempts",
  snapshots: "exam_attempt_snapshots",
  answers: "exam_attempt_answers",
} as const;

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  in_progress: "Sedang Berjalan",
  submitted: "Terkumpul",
  expired: "Waktu Habis",
  cancelled: "Dibatalkan",
};

/** Batas default pelanggaran fullscreen sebelum auto submit. */
export const FULLSCREEN_VIOLATION_LIMIT = 4;

/** Soal pada review: snapshot lengkap (dengan kunci jawaban & pembahasan). */
export type ReviewQuestion = SnapshotQuestion & {
  correct_label: AnswerLabel | null;
  explanation: string | null;
};

/** Snapshot review (payload internal, hanya dapat dibaca setelah submit). */
export type ReviewSnapshot = Omit<ExamSnapshot, "questions"> & {
  questions: ReviewQuestion[];
};

/** Data lengkap halaman Review: snapshot beku + jawaban siswa. */
export type AttemptReview = {
  attempt: AttemptRow;
  snapshot: ReviewSnapshot;
  answers: AttemptAnswerRow[];
};

export const RESULT_TABLE = "exam_attempt_results";

/** Format durasi detik menjadi teks Indonesia (mis. "12 menit 30 detik"). */
export function formatDurasi(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const menit = Math.floor(s / 60);
  const detik = s % 60;
  if (menit === 0) return `${detik} detik`;
  return `${menit} menit ${detik} detik`;
}
