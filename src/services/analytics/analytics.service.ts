import { supabase } from "@/lib/supabase/client";
import type {
  AnalyticsOverview,
  AnalyticsRange,
  ExamAnalyticsRow,
  ExamDetailAnalytics,
  StudentAnalyticsResult,
  StudentAnalyticsRow,
  StudentDetail,
} from "@/types/analytics";

export type AnalyticsFilters = {
  range?: AnalyticsRange;
  examId?: string | null;
  studentId?: string | null;
  tenantId?: string | null;
};

/** Ringkasan performa siswa pada tenant pengajar. */
export async function getAnalyticsOverview({
  range = "30",
  examId = null,
  studentId = null,
  tenantId = null,
}: AnalyticsFilters = {}): Promise<AnalyticsOverview> {
  const { data, error } = await supabase.rpc("teacher_analytics_overview", {
    p_range: range,
    p_exam_id: examId,
    p_student_id: studentId,
    p_tenant_id: tenantId,
  });
  if (error) throw new Error("Gagal memuat ringkasan analitik.");

  const row = (data as Record<string, unknown> | null) ?? {};
  return {
    total_students: Number(row["total_students"] ?? 0),
    active_students: Number(row["active_students"] ?? 0),
    total_attempts: Number(row["total_attempts"] ?? 0),
    average_score: Number(row["average_score"] ?? 0),
    pass_rate: Number(row["pass_rate"] ?? 0),
    average_duration_seconds: Number(row["average_duration_seconds"] ?? 0),
  };
}

/** Performa per ujian. */
export async function listExamAnalytics({
  range = "30",
  studentId = null,
  tenantId = null,
}: AnalyticsFilters = {}): Promise<ExamAnalyticsRow[]> {
  const { data, error } = await supabase.rpc("teacher_exam_analytics", {
    p_range: range,
    p_student_id: studentId,
    p_tenant_id: tenantId,
    p_limit: 50,
  });
  if (error) throw new Error("Gagal memuat analitik ujian.");

  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
    exam_id: String(row["exam_id"]),
    exam_title: String(row["exam_title"] ?? "Ujian"),
    attempts: Number(row["attempts"] ?? 0),
    students: Number(row["students"] ?? 0),
    average_score: Number(row["average_score"] ?? 0),
    pass_rate: Number(row["pass_rate"] ?? 0),
    last_submitted_at: (row["last_submitted_at"] as string | null) ?? null,
  }));
}

export type StudentAnalyticsParams = AnalyticsFilters & {
  search?: string;
  page?: number;
  pageSize?: number;
};

/** Performa per siswa (dengan pagination di database). */
export async function listStudentAnalytics({
  range = "30",
  examId = null,
  tenantId = null,
  search = "",
  page = 1,
  pageSize = 10,
}: StudentAnalyticsParams = {}): Promise<StudentAnalyticsResult> {
  const { data, error } = await supabase.rpc("teacher_student_analytics", {
    p_range: range,
    p_exam_id: examId,
    p_search: search.trim() || null,
    p_tenant_id: tenantId,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error("Gagal memuat analitik siswa.");

  const rows: StudentAnalyticsRow[] = ((data as Record<string, unknown>[] | null) ?? []).map(
    (row) => ({
      user_id: String(row["user_id"]),
      display_name: String(row["display_name"] ?? "Siswa"),
      username: (row["username"] as string | null) ?? null,
      avatar_url: (row["avatar_url"] as string | null) ?? null,
      attempts: Number(row["attempts"] ?? 0),
      average_score: Number(row["average_score"] ?? 0),
      pass_rate: Number(row["pass_rate"] ?? 0),
      last_submitted_at: (row["last_submitted_at"] as string | null) ?? null,
      total_rows: Number(row["total_rows"] ?? 0),
    }),
  );

  const total = rows[0]?.total_rows ?? 0;
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Detail satu siswa: ringkasan, riwayat terakhir, dan performa per ujian. */
export async function getStudentDetail(
  studentId: string,
  { range = "30", tenantId = null }: AnalyticsFilters = {},
): Promise<StudentDetail> {
  const { data, error } = await supabase.rpc("teacher_student_detail", {
    p_student_id: studentId,
    p_range: range,
    p_tenant_id: tenantId,
  });
  if (error) throw new Error("Gagal memuat detail siswa.");
  return data as unknown as StudentDetail;
}

/** Detail satu ujian: ringkasan, performa per soal, dan performa grammar. */
export async function getExamDetailAnalytics(
  examId: string,
  { range = "30", studentId = null, tenantId = null }: AnalyticsFilters = {},
): Promise<ExamDetailAnalytics> {
  const { data, error } = await supabase.rpc("teacher_exam_detail", {
    p_exam_id: examId,
    p_range: range,
    p_student_id: studentId,
    p_tenant_id: tenantId,
  });
  if (error) throw new Error("Gagal memuat detail analitik ujian.");
  return data as unknown as ExamDetailAnalytics;
}
