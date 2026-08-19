import { supabase } from "@/lib/supabase/client";
import type {
  AnalyticsExamRow,
  AnalyticsFilterState,
  AnalyticsOverviewV2,
  AnalyticsStudentAttempt,
  AnalyticsStudentPage,
  AnalyticsStudentRow,
  AnalyticsTrendPoint,
  AttendanceReport,
  QuestionScope,
  QuestionStats,
  ScoreMatrix,
} from "@/types/analytics/analytics-v2";

type Row = Record<string, unknown>;

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const nullableStr = (v: unknown) => (v == null ? null : String(v));

function baseArgs(filters: AnalyticsFilterState) {
  return {
    p_from: filters.from || null,
    p_to: filters.to || null,
  };
}

/** Ringkasan analitik (kartu atas). */
export async function fetchAnalyticsOverview(
  filters: AnalyticsFilterState,
): Promise<AnalyticsOverviewV2> {
  const { data, error } = await supabase.rpc("analytics_overview_v2", {
    ...baseArgs(filters),
    p_exam_id: filters.examId,
    p_student_id: filters.studentId,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memuat ringkasan analitik.");
  const row = (data as Row | null) ?? {};
  return {
    total_students: num(row["total_students"]),
    active_students: num(row["active_students"]),
    total_attempts: num(row["total_attempts"]),
    graded_attempts: num(row["graded_attempts"]),
    average_score: num(row["average_score"]),
    pass_rate: num(row["pass_rate"]),
    average_duration_seconds: num(row["average_duration_seconds"]),
    correct_count: num(row["correct_count"]),
    wrong_count: num(row["wrong_count"]),
    skipped_count: num(row["skipped_count"]),
    exam_count: num(row["exam_count"]),
  };
}

/** Tren harian untuk chart perkembangan. */
export async function fetchAnalyticsTrend(
  filters: AnalyticsFilterState,
): Promise<AnalyticsTrendPoint[]> {
  const { data, error } = await supabase.rpc("analytics_daily_trend", {
    ...baseArgs(filters),
    p_exam_id: filters.examId,
    p_student_id: filters.studentId,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memuat tren analitik.");
  return ((data as Row[] | null) ?? []).map((r) => ({
    day: str(r["day"]),
    attempts: num(r["attempts"]),
    students: num(r["students"]),
    average_score: num(r["average_score"]),
    pass_rate: num(r["pass_rate"]),
  }));
}

/** Performa per set ujian. */
export async function fetchExamPerformance(
  filters: AnalyticsFilterState,
): Promise<AnalyticsExamRow[]> {
  const { data, error } = await supabase.rpc("analytics_exam_performance", {
    ...baseArgs(filters),
    p_student_id: filters.studentId,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memuat performa set ujian.");
  return ((data as Row[] | null) ?? []).map((r) => ({
    exam_id: str(r["exam_id"]),
    exam_title: str(r["exam_title"], "Ujian"),
    attempts: num(r["attempts"]),
    students: num(r["students"]),
    average_score: num(r["average_score"]),
    pass_rate: num(r["pass_rate"]),
    last_submitted_at: nullableStr(r["last_submitted_at"]),
  }));
}

export type StudentRowsParams = AnalyticsFilterState & {
  search?: string;
  includeExcluded?: boolean;
  page?: number;
  pageSize?: number;
};

/** Daftar siswa (paginated) dengan metrik first-attempt. */
export async function fetchStudentRows(params: StudentRowsParams): Promise<AnalyticsStudentPage> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 12;
  const { data, error } = await supabase.rpc("analytics_student_rows", {
    ...baseArgs(params),
    p_exam_id: params.examId,
    p_search: params.search?.trim() || null,
    p_include_excluded: params.includeExcluded ?? false,
    p_tenant_id: null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error("Gagal memuat data siswa.");

  const raw = (data as Row[] | null) ?? [];
  const rows: AnalyticsStudentRow[] = raw.map((r) => ({
    user_id: str(r["user_id"]),
    display_name: str(r["display_name"], "Siswa"),
    username: nullableStr(r["username"]),
    avatar_url: nullableStr(r["avatar_url"]),
    analytics_excluded: Boolean(r["analytics_excluded"]),
    is_active: Boolean(r["is_active"]),
    last_login_at: nullableStr(r["last_login_at"]),
    attempts: num(r["attempts"]),
    exams_taken: num(r["exams_taken"]),
    average_score: num(r["average_score"]),
    pass_rate: num(r["pass_rate"]),
    last_submitted_at: nullableStr(r["last_submitted_at"]),
  }));
  const total = num(raw[0]?.["total_rows"]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Riwayat seluruh attempt satu siswa. */
export async function fetchStudentAttempts(
  studentId: string,
  filters: AnalyticsFilterState,
): Promise<AnalyticsStudentAttempt[]> {
  const { data, error } = await supabase.rpc("analytics_student_attempts", {
    p_student_id: studentId,
    ...baseArgs(filters),
    p_exam_id: filters.examId,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memuat riwayat attempt siswa.");
  return ((data as Row[] | null) ?? []).map((r) => ({
    attempt_id: str(r["attempt_id"]),
    exam_id: str(r["exam_id"]),
    exam_title: str(r["exam_title"], "Ujian"),
    attempt_number: num(r["attempt_number"]),
    is_first: Boolean(r["is_first"]),
    score: num(r["score"]),
    passed: Boolean(r["passed"]),
    correct_count: num(r["correct_count"]),
    wrong_count: num(r["wrong_count"]),
    skipped_count: num(r["skipped_count"]),
    total_questions: num(r["total_questions"]),
    duration_seconds: num(r["duration_seconds"]),
    submitted_at: str(r["submitted_at"]),
  }));
}

/** Matriks nilai siswa x set ujian (attempt pertama). */
export async function fetchScoreMatrix(filters: AnalyticsFilterState): Promise<ScoreMatrix> {
  const { data, error } = await supabase.rpc("analytics_score_matrix", {
    ...baseArgs(filters),
    p_exam_id: filters.examId,
    p_student_id: filters.studentId,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memuat tabel nilai.");
  const raw = (data as Partial<ScoreMatrix> | null) ?? {};
  return { exams: raw.exams ?? [], students: raw.students ?? [] };
}

/** Statistik per nomor soal untuk satu set ujian. */
export async function fetchQuestionStats(
  examId: string,
  filters: AnalyticsFilterState,
  scope: QuestionScope = "first",
): Promise<QuestionStats> {
  const { data, error } = await supabase.rpc("analytics_question_stats", {
    p_exam_id: examId,
    ...baseArgs(filters),
    p_student_id: filters.studentId,
    p_scope: scope,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memuat analisis soal.");
  const raw = (data as Partial<QuestionStats> | null) ?? {};
  return { scope: raw.scope ?? scope, attempts: raw.attempts ?? 0, questions: raw.questions ?? [] };
}

/** Rekap kehadiran / aktivitas siswa. */
export async function fetchAttendance(filters: AnalyticsFilterState): Promise<AttendanceReport> {
  const { data, error } = await supabase.rpc("analytics_attendance", {
    ...baseArgs(filters),
    p_student_id: filters.studentId,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memuat data kehadiran.");
  const raw = (data as Partial<AttendanceReport> | null) ?? {};
  return {
    range_days: raw.range_days ?? 0,
    total_students: raw.total_students ?? 0,
    active_students: raw.active_students ?? 0,
    total_sessions: raw.total_sessions ?? 0,
    average_daily_active: raw.average_daily_active ?? 0,
    daily: raw.daily ?? [],
    students: raw.students ?? [],
  };
}

/** Set status aktif/nonaktif siswa dalam perhitungan analitik. */
export async function setStudentAnalyticsExcluded(
  userIds: string[],
  excluded: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc("set_student_analytics_excluded", {
    p_user_ids: userIds,
    p_excluded: excluded,
    p_tenant_id: null,
  });
  if (error) throw new Error("Gagal memperbarui status siswa.");
  return Number(data ?? 0);
}

/** Heartbeat kehadiran siswa (dipanggil saat aplikasi aktif). */
export async function recordStudentActivity(): Promise<void> {
  await supabase.rpc("record_student_activity");
}
