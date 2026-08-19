import { supabase } from "@/lib/supabase/client";
import type {
  LessonAnalyticsOverview,
  LessonAnalyticsRow,
  LessonDetailRow,
  LessonProgressRow,
  LessonWithProgress,
  StudentCategoryProgressRow,
  StudentLessonProgressRow,
} from "@/types/lesson";
import { LESSON_TABLES } from "@/types/lesson";
import { listPublishedLessons } from "./lesson.service";

/**
 * Personal Lesson Progress untuk semua role.
 *
 * Penulisan progress SELALU melalui RPC SECURITY DEFINER:
 * client tidak pernah mengirim progress_percent / status / completed_at.
 * Identitas dan tenant writer selalu diturunkan oleh RPC dari sesi terautentikasi.
 */

type ProgressOperation = "SELECT" | "START" | "UPDATE" | "COMPLETE";

function progressError(operation: ProgressOperation, lessonId: string | null, error: unknown) {
  const details = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = typeof details["code"] === "string" ? details["code"] : "UNKNOWN";
  const message =
    error instanceof Error
      ? error.message
      : typeof details["message"] === "string"
        ? details["message"]
        : "Unknown database error";
  if (import.meta.env.DEV) {
    console.error("Lesson progress database error", {
      operation,
      table: LESSON_TABLES.progress,
      code,
      message,
      details: details["details"],
      hint: details["hint"],
      lessonId,
    });
  }
  return new Error(
    import.meta.env.DEV
      ? `${operation} progress gagal [${code}]: ${message}`
      : `Progress materi gagal diproses (${code}).`,
  );
}

async function getProgressScope() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw progressError(
      "SELECT",
      null,
      authError ?? { code: "NO_SESSION", message: "Sesi tidak tersedia." },
    );
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", authData.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (profileError || !profile) {
    throw progressError(
      "SELECT",
      null,
      profileError ?? { code: "NO_PROFILE", message: "Profil aktif tidak tersedia." },
    );
  }
  return { userId: authData.user.id, tenantId: (profile.tenant_id as string | null) ?? null };
}

function withTenant<
  T extends { eq: (column: string, value: string) => T; is: (column: string, value: null) => T },
>(query: T, tenantId: string | null) {
  return tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);
}

function unitKey(blockId: string) {
  return `block:${blockId}`;
}

export function blockUnitKeys(blockIds: string[]): string[] {
  return blockIds.map(unitKey);
}

function asProgress(data: unknown): LessonProgressRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as LessonProgressRow;
  return row.id ? { ...row, completed_units: row.completed_units ?? [] } : null;
}

/** Progres siswa untuk satu lesson (null bila belum pernah dibuka / staf). */
export async function getLessonProgress(lessonId: string): Promise<LessonProgressRow | null> {
  const scope = await getProgressScope();
  const query = supabase
    .from(LESSON_TABLES.progress)
    .select("*")
    .eq("user_id", scope.userId)
    .eq("lesson_id", lessonId);
  const { data, error } = await withTenant(query, scope.tenantId).maybeSingle();
  if (error) throw progressError("SELECT", lessonId, error);
  return asProgress(data);
}

/** Membuat/menyegarkan progress saat siswa membuka materi. Idempotent. */
export async function startLesson(lessonId: string): Promise<LessonProgressRow | null> {
  const { data, error } = await supabase.rpc("lesson_progress_start", { p_lesson_id: lessonId });
  if (error) throw progressError("START", lessonId, error);
  return asProgress(data);
}

/** Menandai unit konten yang sudah dibaca siswa. */
export async function updateLessonProgress(
  lessonId: string,
  blockIds: string[],
  currentBlockId: string | null = null,
): Promise<LessonProgressRow | null> {
  const { data, error } = await supabase.rpc("lesson_progress_mark", {
    p_lesson_id: lessonId,
    p_units: blockUnitKeys(blockIds),
    p_current_block_id: currentBlockId,
  });
  if (error) throw progressError("UPDATE", lessonId, error);
  return asProgress(data);
}

/** Menyelesaikan materi. Idempotent: tidak membuat completion ganda. */
export async function completeLesson(lessonId: string): Promise<LessonProgressRow | null> {
  const { data, error } = await supabase.rpc("lesson_progress_complete", {
    p_lesson_id: lessonId,
  });
  if (error) throw progressError("COMPLETE", lessonId, error);
  return asProgress(data);
}

/** Seluruh progres milik siswa yang sedang login. */
export async function getStudentLessonProgress(): Promise<LessonProgressRow[]> {
  const scope = await getProgressScope();
  const query = supabase
    .from(LESSON_TABLES.progress)
    .select("*")
    .eq("user_id", scope.userId)
    .order("last_activity_at", { ascending: false });
  const { data, error } = await withTenant(query, scope.tenantId);
  if (error) throw progressError("SELECT", null, error);
  return ((data as LessonProgressRow[] | null) ?? []).map((row) => ({
    ...row,
    completed_units: row.completed_units ?? [],
  }));
}

/** Materi terbit + progres siswa (dipakai halaman /materi dan dashboard). */
export async function listLessonsWithProgress(): Promise<LessonWithProgress[]> {
  const [lessons, progress] = await Promise.all([
    listPublishedLessons(),
    getStudentLessonProgress(),
  ]);
  const byLesson = new Map(progress.map((p) => [p.lesson_id, p]));
  return (lessons as LessonDetailRow[]).map((lesson) => ({
    ...lesson,
    progress: byLesson.get(lesson.id) ?? null,
  }));
}

/** Ringkasan progres materi milik siswa, dikelompokkan per kategori. */
export async function getStudentCategoryProgress(): Promise<StudentCategoryProgressRow[]> {
  const { data, error } = await supabase.rpc("student_lesson_category_progress");
  if (error) return [];
  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
    category: String(row["category"] ?? "umum"),
    lessons_started: Number(row["lessons_started"] ?? 0),
    lessons_completed: Number(row["lessons_completed"] ?? 0),
    average_progress: Number(row["average_progress"] ?? 0),
  }));
}

// ---------- ANALYTICS (staf) ----------

export type LessonAnalyticsFilters = {
  range?: string;
  tenantId?: string | null;
  studentId?: string | null;
};

export async function getLessonAnalyticsOverview({
  range = "30",
  tenantId = null,
}: LessonAnalyticsFilters = {}): Promise<LessonAnalyticsOverview> {
  const { data, error } = await supabase.rpc("teacher_lesson_overview", {
    p_range: range,
    p_tenant_id: tenantId,
  });
  if (error) throw new Error("Gagal memuat analitik materi.");
  const row = (data as Record<string, unknown> | null) ?? {};
  return {
    total_lessons: Number(row["total_lessons"] ?? 0),
    started: Number(row["started"] ?? 0),
    in_progress: Number(row["in_progress"] ?? 0),
    completed: Number(row["completed"] ?? 0),
    active_learners: Number(row["active_learners"] ?? 0),
    completion_rate: Number(row["completion_rate"] ?? 0),
    average_progress: Number(row["average_progress"] ?? 0),
  };
}

export async function getLessonAnalytics({
  range = "30",
  tenantId = null,
  studentId = null,
}: LessonAnalyticsFilters = {}): Promise<LessonAnalyticsRow[]> {
  const { data, error } = await supabase.rpc("teacher_lesson_analytics", {
    p_range: range,
    p_tenant_id: tenantId,
    p_student_id: studentId,
    p_limit: 50,
  });
  if (error) throw new Error("Gagal memuat analitik materi.");
  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
    lesson_id: String(row["lesson_id"]),
    lesson_title: String(row["lesson_title"] ?? "Materi"),
    category: String(row["category"] ?? "umum"),
    started: Number(row["started"] ?? 0),
    in_progress: Number(row["in_progress"] ?? 0),
    completed: Number(row["completed"] ?? 0),
    completion_rate: Number(row["completion_rate"] ?? 0),
    average_progress: Number(row["average_progress"] ?? 0),
    last_activity_at: (row["last_activity_at"] as string | null) ?? null,
  }));
}

export async function getStudentLessonAnalytics(
  studentId: string,
  { range = "30", tenantId = null }: LessonAnalyticsFilters = {},
): Promise<StudentLessonProgressRow[]> {
  const { data, error } = await supabase.rpc("teacher_student_lesson_progress", {
    p_student_id: studentId,
    p_range: range,
    p_tenant_id: tenantId,
    p_limit: 20,
  });
  if (error) throw new Error("Gagal memuat progres materi siswa.");
  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
    lesson_id: String(row["lesson_id"]),
    lesson_title: String(row["lesson_title"] ?? "Materi"),
    category: String(row["category"] ?? "umum"),
    status: (row["status"] as StudentLessonProgressRow["status"]) ?? "in_progress",
    progress_percent: Number(row["progress_percent"] ?? 0),
    last_activity_at: (row["last_activity_at"] as string | null) ?? null,
    completed_at: (row["completed_at"] as string | null) ?? null,
  }));
}
