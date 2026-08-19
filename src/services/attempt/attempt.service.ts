import { supabase } from "@/lib/supabase/client";
import { pointsPerQuestion } from "@/features/exam/exam.constants";
import { getExam, listQuestions, listSections } from "@/services/exam";
import {
  ATTEMPT_TABLES,
  FULLSCREEN_VIOLATION_LIMIT,
  RESULT_TABLE,
  type AttemptAnswerRow,
  type AttemptResultRow,
  type AttemptReview,
  type AttemptRow,
  type AttemptSession,
  type ExamSnapshot,
  type ReviewSnapshot,
  type SnapshotQuestion,
  type SnapshotSection,
} from "@/types/attempt";
import type { AnswerLabel, ExamRow } from "@/types/exam";

const SNAPSHOT_SELECT = "id, attempt_id, exam_id, student_payload, created_at";

function shuffled<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
  }
  return copy;
}

/** Bangun snapshot lengkap (internal) + versi siswa dari data live exam. */
async function buildSnapshot(exam: ExamRow) {
  const [sections, questions] = await Promise.all([listSections(exam.id), listQuestions(exam.id)]);

  // Acak soal HANYA di dalam section masing-masing; urutan section tetap.
  const sectionOrder = sections.map((s) => s.id);
  const ordered = exam.shuffle_questions
    ? [
        ...sectionOrder.flatMap((sectionId) =>
          shuffled(questions.filter((q) => q.section_id === sectionId)),
        ),
        ...questions.filter((q) => !sectionOrder.includes(q.section_id)),
      ]
    : questions;

  const full: SnapshotQuestion[] = ordered.map((q, index) => {
    const answers = exam.shuffle_answers ? shuffled(q.answers) : q.answers;
    const correct = q.answers.find((a) => a.is_correct) ?? null;
    return {
      question_id: q.question_id,
      index,
      section_id: q.section_id,
      text: q.text,
      instruction: q.instruction ?? null,
      image_url: q.image_url,
      audio_url: q.audio_url,
      lesson_id: q.lesson_id,
      explanation: q.explanation,
      correct_label: (correct?.label as AnswerLabel | undefined) ?? null,
      answers: answers.map((a) => ({
        label: a.label as AnswerLabel,
        text: a.text,
        image_url: a.image_url,
        audio_url: a.audio_url,
      })),
    };
  });

  const snapshotSections: SnapshotSection[] = sections.map((s) => ({
    section_id: s.id,
    type: s.type,
    title: s.title,
    instruction: s.instruction,
    order_index: s.order_index,
    question_ids: full.filter((q) => q.section_id === s.id).map((q) => q.question_id),
  }));

  const base = {
    version: 1 as const,
    created_at: new Date().toISOString(),
    exam: {
      id: exam.id,
      title: exam.title,
      slug: exam.slug,
      category: exam.category,
      description: exam.description,
      difficulty: exam.difficulty,
      passing_score: exam.passing_score,
      duration_minutes: exam.duration_minutes,
      shuffle_questions: exam.shuffle_questions,
      shuffle_answers: exam.shuffle_answers,
      total_score: exam.total_score,
    },
    sections: snapshotSections,
    points_per_question: pointsPerQuestion(full.length),
    fullscreen_limit: FULLSCREEN_VIOLATION_LIMIT,
  };

  const payload: ExamSnapshot = { ...base, questions: full };
  const studentPayload: ExamSnapshot = {
    ...base,
    questions: full.map(({ explanation: _e, correct_label: _c, ...rest }) => rest),
  };

  return { payload, studentPayload };
}

/** Attempt yang sudah lewat `expires_at` (waktu server) — bukan lagi attempt aktif. */
export class ExamAttemptExpiredError extends Error {
  constructor() {
    super("Waktu ujian telah habis.");
    this.name = "ExamAttemptExpiredError";
  }
}

/** Data ujian benar-benar tidak ada (snapshot hilang) meski attempt masih valid. */
export class ExamSnapshotMissingError extends Error {
  constructor() {
    super("Data ujian tidak dapat dipulihkan.");
    this.name = "ExamSnapshotMissingError";
  }
}

/**
 * Finalisasi seluruh attempt kadaluarsa milik user (waktu server, bukan browser).
 * Reuse lifecycle existing: submit_exam_attempt('time_up') di dalam function DB.
 */
export async function finalizeMyStaleAttempts(): Promise<void> {
  const { error } = await supabase.rpc("finalize_my_stale_attempts");
  if (error) {
    // Non-fatal: pembacaan tetap dilanjutkan, filter status tetap berlaku.
    console.warn("finalize_my_stale_attempts gagal", error.message);
  }
}

/** Attempt aktif milik user pada exam tertentu (anti duplicate). */
export async function getActiveAttempt(examId: string): Promise<AttemptRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");

  // Stale attempt difinalisasi dulu sehingga tidak pernah dikembalikan sebagai aktif.
  await finalizeMyStaleAttempts();

  const { data, error } = await supabase
    .from(ATTEMPT_TABLES.attempts)
    .select("*")
    .eq("exam_id", examId)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (error) throw new Error("Gagal memeriksa ujian yang sedang berjalan.");
  return (data as AttemptRow | null) ?? null;
}

/**
 * MULAI UJIAN: satu klik = satu attempt + satu snapshot immutable.
 * Jika sudah ada attempt aktif, attempt tersebut yang dikembalikan.
 */
export async function startAttempt(examId: string): Promise<AttemptRow> {
  const existing = await getActiveAttempt(examId);
  if (existing) return existing;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");

  const exam = await getExam(examId);
  if (exam.status !== "published") throw new Error("Ujian ini belum dipublikasikan.");

  const { payload, studentPayload } = await buildSnapshot(exam);
  if (payload.questions.length === 0) throw new Error("Ujian ini belum memiliki soal.");

  // PROTEKSI: durasi tidak valid (0/null) pernah membuat ujian langsung "waktu habis".
  const rawDuration = Number(exam.duration_minutes);
  const durationMinutes = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 60;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60_000);

  const { data: attempt, error } = await supabase
    .from(ATTEMPT_TABLES.attempts)
    .insert({
      exam_id: exam.id,
      user_id: userId,
      tenant_id: exam.tenant_id,
      status: "in_progress",
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      duration_minutes: durationMinutes,
      total_questions: payload.questions.length,
      fullscreen_limit: FULLSCREEN_VIOLATION_LIMIT,
    })
    .select("*")
    .single();

  // Balapan klik ganda: unique index menolak attempt kedua, pulihkan yang aktif.
  if (error) {
    const active = await getActiveAttempt(examId);
    if (active) return active;
    throw new Error("Gagal memulai ujian.");
  }

  const row = attempt as AttemptRow;
  const { error: snapshotError } = await supabase.from(ATTEMPT_TABLES.snapshots).insert({
    attempt_id: row.id,
    exam_id: exam.id,
    payload,
    student_payload: studentPayload,
  });
  if (snapshotError) {
    await supabase
      .from(ATTEMPT_TABLES.attempts)
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", row.id);
    throw new Error("Gagal membuat snapshot ujian.");
  }

  return row;
}

/**
 * RECOVERY: muat attempt + snapshot immutable + jawaban tersimpan.
 *
 * Dipakai juga untuk "Melanjutkan Ujian" setelah browser force close:
 * TIDAK pernah membuat attempt/snapshot baru dan tidak pernah membaca ulang
 * soal dari Exam Studio / Question Bank.
 */
export async function getAttemptSession(attemptId: string): Promise<AttemptSession> {
  // Session Supabase harus benar-benar pulih dulu; tanpa ini RLS mengembalikan
  // 0 baris dan resume gagal dengan "Attempt/Snapshot tidak ditemukan".
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");

  // VALIDASI SEBELUM SNAPSHOT: attempt ada? masih in_progress? belum lewat waktu?
  const { data: state } = await supabase.rpc("finalize_attempt_if_stale", {
    p_attempt_id: attemptId,
  });
  if (state === "not_found") throw new Error("Ujian tidak ditemukan.");
  if (state === "finalized" || state === "missing_snapshot") throw new ExamAttemptExpiredError();

  const { data: attempt, error } = await supabase
    .from(ATTEMPT_TABLES.attempts)
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error("Gagal memuat ujian. Periksa koneksi Anda.");
  if (!attempt) throw new Error("Ujian tidak ditemukan.");

  const [{ data: snapshot, error: snapshotError }, { data: answers }] = await Promise.all([
    supabase
      .from(ATTEMPT_TABLES.snapshots)
      .select(SNAPSHOT_SELECT)
      .eq("attempt_id", attemptId)
      .maybeSingle(),
    supabase
      .from(ATTEMPT_TABLES.answers)
      .select("*")
      .eq("attempt_id", attemptId)
      .order("question_index", { ascending: true }),
  ]);

  if (snapshotError) throw new Error("Gagal memuat soal ujian. Periksa koneksi Anda.");
  if (!snapshot) throw new ExamSnapshotMissingError();

  return {
    attempt: attempt as AttemptRow,
    snapshot: (snapshot as { student_payload: ExamSnapshot }).student_payload,
    answers: ((answers as AttemptAnswerRow[] | null) ?? []).map((row) => ({ ...row })),
  };
}

/** AUTO SAVE jawaban (upsert per soal, tanpa tombol simpan). */
export async function saveAnswer(input: {
  attemptId: string;
  questionId: string;
  questionIndex: number;
  label: AnswerLabel;
}): Promise<void> {
  const { error } = await supabase.from(ATTEMPT_TABLES.answers).upsert(
    {
      attempt_id: input.attemptId,
      question_id: input.questionId,
      question_index: input.questionIndex,
      selected_label: input.label,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,question_id" },
  );
  if (error) throw new Error("Gagal menyimpan jawaban.");
}

/** Tandai / lepas tanda soal. */
export async function setFlag(input: {
  attemptId: string;
  questionId: string;
  questionIndex: number;
  flagged: boolean;
}): Promise<void> {
  const { error } = await supabase.from(ATTEMPT_TABLES.answers).upsert(
    {
      attempt_id: input.attemptId,
      question_id: input.questionId,
      question_index: input.questionIndex,
      is_flagged: input.flagged,
    },
    { onConflict: "attempt_id,question_id" },
  );
  if (error) throw new Error("Gagal menandai soal.");
}

/** Catat pelanggaran fullscreen dan kembalikan jumlah terbaru. */
export async function recordFullscreenViolation(attemptId: string): Promise<number> {
  const { data, error } = await supabase
    .from(ATTEMPT_TABLES.attempts)
    .select("fullscreen_violations")
    .eq("id", attemptId)
    .maybeSingle();
  if (error || !data) throw new Error("Gagal mencatat pelanggaran layar penuh.");

  const next = ((data as { fullscreen_violations: number }).fullscreen_violations ?? 0) + 1;
  const { error: updateError } = await supabase
    .from(ATTEMPT_TABLES.attempts)
    .update({ fullscreen_violations: next })
    .eq("id", attemptId);
  if (updateError) throw new Error("Gagal mencatat pelanggaran layar penuh.");
  return next;
}

export type SubmitReason = "manual" | "time_up" | "fullscreen_violation";

/**
 * SUBMIT + SCORING SATU KALI.
 * Perhitungan dilakukan di database (function SECURITY DEFINER) karena kunci
 * jawaban berada pada kolom `payload` yang tidak dapat dibaca siswa.
 * Jika attempt sudah dinilai, hasil tersimpan dikembalikan apa adanya.
 */
export async function submitAttempt(
  attemptId: string,
  reason: SubmitReason = "manual",
): Promise<AttemptResultRow> {
  const { data, error } = await supabase.rpc("submit_exam_attempt", {
    p_attempt_id: attemptId,
    p_reason: reason,
  });
  if (error || !data) throw new Error(error?.message ?? "Gagal mengumpulkan ujian.");
  return data as AttemptResultRow;
}

/** RESULT PAGE: hanya membaca hasil yang sudah tersimpan. */
export async function getAttemptResult(attemptId: string): Promise<AttemptResultRow> {
  const { data, error } = await supabase
    .from(RESULT_TABLE)
    .select("*")
    .eq("attempt_id", attemptId)
    .maybeSingle();
  if (error) throw new Error("Gagal memuat hasil ujian.");
  if (!data) throw new Error("Hasil ujian belum tersedia.");
  return data as AttemptResultRow;
}

/** REVIEW: membaca snapshot beku (bukan Exam Studio / Question Bank / Lesson). */
export async function getAttemptReview(attemptId: string): Promise<AttemptReview> {
  const [{ data: attempt, error: attemptError }, { data: payload, error: payloadError }] =
    await Promise.all([
      supabase.from(ATTEMPT_TABLES.attempts).select("*").eq("id", attemptId).maybeSingle(),
      supabase.rpc("get_exam_attempt_review", { p_attempt_id: attemptId }),
    ]);

  if (attemptError || !attempt) throw new Error("Attempt tidak ditemukan.");
  if (payloadError || !payload)
    throw new Error(payloadError?.message ?? "Review ujian tidak tersedia.");

  const { data: answers } = await supabase
    .from(ATTEMPT_TABLES.answers)
    .select("*")
    .eq("attempt_id", attemptId)
    .order("question_index", { ascending: true });

  return {
    attempt: attempt as AttemptRow,
    snapshot: payload as ReviewSnapshot,
    answers: ((answers as AttemptAnswerRow[] | null) ?? []).map((row) => ({ ...row })),
  };
}

/** Daftar ujian published yang dapat dikerjakan siswa. */
export async function listAvailableExams(): Promise<ExamRow[]> {
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Gagal memuat daftar ujian.");
  return (data as ExamRow[] | null) ?? [];
}

/** Attempt milik user (untuk indikator "lanjutkan ujian"). */
export async function listMyAttempts(): Promise<AttemptRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  // Cleanup lifecycle: attempt kadaluarsa difinalisasi sebelum daftar dibaca,
  // sehingga tidak pernah muncul sebagai "Lanjutkan Ujian".
  await finalizeMyStaleAttempts();

  const { data, error } = await supabase
    .from(ATTEMPT_TABLES.attempts)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data as AttemptRow[] | null) ?? [];
}

/**
 * Semua hasil ujian milik user (read-only) untuk statistik katalog.
 * Tidak menyentuh Exam Engine — hanya membaca tabel hasil.
 */
export async function listMyResults(): Promise<AttemptResultRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from(RESULT_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: true });
  if (error) return [];
  return (data as AttemptResultRow[] | null) ?? [];
}

/**
 * Hapus satu riwayat attempt (Owner only).
 * Otorisasi dijaga oleh RLS/RPC di server; klien hanya menyembunyikan tombol.
 */
export async function deleteAttempt(attemptId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_exam_attempt", { p_attempt_id: attemptId });
  if (error) throw new Error("Gagal menghapus riwayat ujian.");
}
