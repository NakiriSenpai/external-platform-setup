import { supabase } from "@/lib/supabase/client";
import type { LeaderboardExamOption, LeaderboardResult, LeaderboardRow } from "@/types/analytics";

export type LeaderboardParams = {
  /** null = mode "Semua"; diisi = mode "Per Exam". */
  examId?: string | null;
  page?: number;
  pageSize?: number;
  /** Baris awal yang dilewati sebelum paginasi (mis. 3 untuk podium). */
  skip?: number;
};

function normalize(row: Record<string, unknown>): LeaderboardRow {
  return {
    rank: Number(row["rank"] ?? 0),
    user_id: String(row["user_id"] ?? ""),
    display_name: String(row["display_name"] ?? "Siswa"),
    username: (row["username"] as string | null) ?? null,
    avatar_url: (row["avatar_url"] as string | null) ?? null,
    role: String(row["role"] ?? "siswa"),
    total_score: Number(row["total_score"] ?? 0),
    exams_taken: Number(row["exams_taken"] ?? 0),
    first_qualified_at: (row["first_qualified_at"] as string | null) ?? null,
    is_current_user: Boolean(row["is_current_user"]),
    total_rows: Number(row["total_rows"] ?? 0),
  };
}

/**
 * Peringkat siswa dalam tenant pemanggil.
 * Skor = SUM skor ATTEMPT SELESAI TERBARU per exam distinct (agregasi di database).
 * Tenant selalu ditentukan server-side dari profil pemanggil.
 */
export async function getLeaderboard({
  examId = null,
  page = 1,
  pageSize = 20,
  skip = 0,
}: LeaderboardParams = {}): Promise<LeaderboardResult> {
  const { data, error } = await supabase.rpc("leaderboard_first_attempt_ranking", {
    p_exam_id: examId,
    p_limit: pageSize,
    p_offset: skip + (page - 1) * pageSize,
  });

  if (error) throw new Error("Gagal memuat papan peringkat.");

  const rows = ((data as Record<string, unknown>[] | null) ?? []).map(normalize);
  const total = rows[0]?.total_rows ?? 0;
  const pageable = Math.max(0, total - skip);
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(pageable / pageSize)),
  };
}

/** Tiga peringkat teratas (podium) — selalu ranking global filter aktif. */
export async function getLeaderboardPodium(
  params: Pick<LeaderboardParams, "examId"> = {},
): Promise<LeaderboardRow[]> {
  const result = await getLeaderboard({ ...params, page: 1, pageSize: 3, skip: 0 });
  return result.rows;
}

/** Peringkat pemanggil sendiri (agar tetap terlihat walau di luar halaman aktif). */
export async function getMyLeaderboardRank({
  examId = null,
}: LeaderboardParams = {}): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase.rpc("leaderboard_my_first_attempt_rank", {
    p_exam_id: examId,
  });

  if (error) throw new Error("Gagal memuat peringkat Anda.");
  const rows = (data as Record<string, unknown>[] | null) ?? [];
  return rows[0] ? normalize(rows[0]) : null;
}

/** Opsi filter exam — hanya exam yang benar-benar memiliki hasil pada tenant. */
export async function listLeaderboardExams(): Promise<LeaderboardExamOption[]> {
  const { data, error } = await supabase.rpc("leaderboard_exam_options_v2");
  if (error) throw new Error("Gagal memuat daftar ujian.");
  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
    exam_id: String(row["exam_id"]),
    exam_title: String(row["exam_title"] ?? "Ujian"),
    result_count: Number(row["result_count"] ?? 0),
  }));
}
