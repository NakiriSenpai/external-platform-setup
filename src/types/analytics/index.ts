/** Tipe domain Leaderboard & Teacher Analytics (Sprint 12; scoring Sprint 18). */

/** Leaderboard hanya punya dua mode: seluruh ujian, atau satu ujian. */
export type LeaderboardMode = "all" | "exam";

export type LeaderboardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  role: string;
  /** Jumlah seluruh attempt selesai pada scope filter aktif. */
  attempt_count: number;
  /** Mode "all": SUM skor attempt pertama tiap exam. Mode "exam": skor attempt pertama. */
  first_attempt_score: number;
  first_qualified_at: string | null;
  is_current_user: boolean;
  total_rows: number;
};

export type LeaderboardResult = {
  rows: LeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LeaderboardExamOption = {
  exam_id: string;
  exam_title: string;
  result_count: number;
};

export type AnalyticsRange = "7" | "30" | "90" | "all";

export type AnalyticsOverview = {
  total_students: number;
  active_students: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
  average_duration_seconds: number;
};

export type ExamAnalyticsRow = {
  exam_id: string;
  exam_title: string;
  attempts: number;
  students: number;
  average_score: number;
  pass_rate: number;
  last_submitted_at: string | null;
};

export type StudentAnalyticsRow = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  attempts: number;
  average_score: number;
  pass_rate: number;
  last_submitted_at: string | null;
  total_rows: number;
};

export type StudentAnalyticsResult = {
  rows: StudentAnalyticsRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type StudentRecentAttempt = {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  score: number;
  passed: boolean;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  total_questions: number;
  duration_seconds: number;
  submitted_at: string;
};

export type StudentExamPerformance = {
  exam_id: string;
  exam_title: string;
  attempts: number;
  average_score: number;
  pass_rate: number;
  last_submitted_at: string | null;
};

export type StudentDetail = {
  profile: {
    user_id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  };
  summary: {
    total_attempts: number;
    average_score: number;
    pass_rate: number;
    average_duration_seconds: number;
    last_submitted_at: string | null;
  };
  recent_attempts: StudentRecentAttempt[];
  exam_performance: StudentExamPerformance[];
};

export type QuestionPerformance = {
  question_id: string;
  question_index: number;
  question_text: string;
  lesson_title: string | null;
  grammar_tags: { id: string; slug?: string; name: string }[];
  attempts: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  accuracy: number;
};

export type GrammarPerformance = {
  tag_id: string;
  tag_name: string;
  attempts: number;
  correct_count: number;
  accuracy: number;
};

export type ExamDetailAnalytics = {
  summary: {
    exam_id: string;
    exam_title: string;
    attempts: number;
    students: number;
    average_score: number;
    pass_rate: number;
    average_duration_seconds: number;
  };
  questions: QuestionPerformance[];
  grammar: GrammarPerformance[];
};
