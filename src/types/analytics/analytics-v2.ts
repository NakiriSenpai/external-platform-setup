/** Tipe Analitik Guru / Platform (Sprint 28 — redesign).
 *
 * SEMANTIK:
 * - attempts / total_attempts = SELURUH attempt selesai.
 * - average_score & pass_rate = ATTEMPT PERTAMA per siswa per exam.
 */

export type AnalyticsFilterState = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  examId: string | null;
  studentId: string | null;
};

export type AnalyticsOverviewV2 = {
  total_students: number;
  active_students: number;
  total_attempts: number;
  graded_attempts: number;
  average_score: number;
  pass_rate: number;
  average_duration_seconds: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  exam_count: number;
};

export type AnalyticsTrendPoint = {
  day: string;
  attempts: number;
  students: number;
  average_score: number;
  pass_rate: number;
};

export type AnalyticsExamRow = {
  exam_id: string;
  exam_title: string;
  attempts: number;
  students: number;
  average_score: number;
  pass_rate: number;
  last_submitted_at: string | null;
};

export type AnalyticsStudentRow = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  analytics_excluded: boolean;
  is_active: boolean;
  last_login_at: string | null;
  attempts: number;
  exams_taken: number;
  average_score: number;
  pass_rate: number;
  last_submitted_at: string | null;
};

export type AnalyticsStudentPage = {
  rows: AnalyticsStudentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AnalyticsStudentAttempt = {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  attempt_number: number;
  is_first: boolean;
  score: number;
  passed: boolean;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  total_questions: number;
  duration_seconds: number;
  submitted_at: string;
};

export type ScoreMatrixExam = {
  exam_id: string;
  exam_title: string;
  result_count: number;
};

export type ScoreMatrixCell = {
  attempt_id: string;
  score: number;
  passed: boolean;
  submitted_at: string;
};

export type ScoreMatrixStudent = {
  user_id: string;
  display_name: string;
  username: string | null;
  scores: Record<string, ScoreMatrixCell>;
  average_score: number;
  taken: number;
};

export type ScoreMatrix = {
  exams: ScoreMatrixExam[];
  students: ScoreMatrixStudent[];
};

export type QuestionStatRow = {
  question_id: string;
  question_index: number;
  question_text: string;
  correct_label: string | null;
  attempts: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  accuracy: number;
  distribution: Record<string, number>;
};

/** Scope analisis soal: "first" = attempt pertama (default), "all" = semua attempt. */
export type QuestionScope = "first" | "all";

export type QuestionStats = {
  scope: QuestionScope;
  attempts: number;
  questions: QuestionStatRow[];
};

export type AttendanceDaily = { day: string; students: number; sessions: number };

export type AttendanceStudent = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  days_present: number;
  last_seen_at: string | null;
  attendance_rate: number;
};

export type AttendanceReport = {
  range_days: number;
  total_students: number;
  active_students: number;
  total_sessions: number;
  average_daily_active: number;
  daily: AttendanceDaily[];
  students: AttendanceStudent[];
};
