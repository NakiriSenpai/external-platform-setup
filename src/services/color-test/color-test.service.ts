import { supabase } from "@/lib/supabase/client";
import type {
  ColorTestPayload,
  ColorTestPoolQuestion,
  ColorTestSummary,
} from "@/types/color-test";

/**
 * Seluruh logika Color Test (randomisasi, penilaian, batas skip, timer akhir)
 * dijalankan oleh function SECURITY DEFINER di database. Klien hanya memanggil.
 */

/** Mulai (atau pulihkan) sesi Color Test milik satu exam attempt. */
export async function startColorTest(attemptId: string): Promise<ColorTestPayload> {
  const { data, error } = await supabase.rpc("start_color_test", { p_attempt_id: attemptId });
  if (error || !data) throw new Error(error?.message ?? "Gagal memulai tes buta warna.");
  return data as ColorTestPayload;
}

/** Baca sesi Color Test milik attempt (null bila belum pernah dibuat). */
export async function getColorTest(attemptId: string): Promise<ColorTestPayload | null> {
  const { data, error } = await supabase.rpc("get_color_test", { p_attempt_id: attemptId });
  if (error) throw new Error(error.message);
  return (data as ColorTestPayload | null) ?? null;
}

/** Kirim jawaban satu soal (dinilai di server). */
export async function answerColorTest(input: {
  sessionId: string;
  questionId: string;
  answer: string;
}): Promise<ColorTestPayload> {
  const { data, error } = await supabase.rpc("answer_color_test", {
    p_session_id: input.sessionId,
    p_question_id: input.questionId,
    p_answer: input.answer,
    p_skip: false,
  });
  if (error || !data) throw new Error(error?.message ?? "Gagal menyimpan jawaban.");
  return data as ColorTestPayload;
}

/** Lewati satu soal (skip dihitung server; 3 skip = gagal). */
export async function skipColorTest(input: {
  sessionId: string;
  questionId: string;
}): Promise<ColorTestPayload> {
  const { data, error } = await supabase.rpc("answer_color_test", {
    p_session_id: input.sessionId,
    p_question_id: input.questionId,
    p_answer: null,
    p_skip: true,
  });
  if (error || !data) throw new Error(error?.message ?? "Gagal melewati soal.");
  return data as ColorTestPayload;
}

/** Selesaikan sesi. `exit` dipakai saat user keluar (hasil otomatis gagal). */
export async function finishColorTest(
  sessionId: string,
  reason: "manual" | "exit" | "time_up" = "manual",
): Promise<ColorTestPayload> {
  const { data, error } = await supabase.rpc("finish_color_test", {
    p_session_id: sessionId,
    p_reason: reason,
  });
  if (error || !data) throw new Error(error?.message ?? "Gagal menyelesaikan tes buta warna.");
  return data as ColorTestPayload;
}

/** Ringkasan Color Test untuk sejumlah attempt (Result Page & Riwayat). */
export async function listColorTestSummaries(attemptIds: string[]): Promise<ColorTestSummary[]> {
  if (attemptIds.length === 0) return [];
  const { data, error } = await supabase.rpc("list_color_test_summaries", {
    p_attempt_ids: attemptIds,
  });
  if (error) return [];
  return (data as ColorTestSummary[] | null) ?? [];
}

/* ------------------------------------------------------------------ */
/* POOL MANAGEMENT (Owner only — otorisasi dijaga RLS)                 */
/* ------------------------------------------------------------------ */

export async function listColorTestPool(): Promise<ColorTestPoolQuestion[]> {
  const { data, error } = await supabase
    .from("color_test_questions")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Gagal memuat bank soal tes buta warna.");
  return (data as ColorTestPoolQuestion[] | null) ?? [];
}

export type ColorTestQuestionInput = {
  image_url: string;
  image_public_id?: string | null;
  correct_answer: string;
  answer_type?: string;
  difficulty?: string | null;
  category?: string | null;
};

/** Tambah soal (satuan maupun bulk import). */
export async function createColorTestQuestions(
  items: ColorTestQuestionInput[],
): Promise<ColorTestPoolQuestion[]> {
  const { data, error } = await supabase
    .from("color_test_questions")
    .insert(
      items.map((item) => ({
        image_url: item.image_url,
        image_public_id: item.image_public_id ?? null,
        correct_answer: item.correct_answer,
        answer_type: item.answer_type ?? "numeric",
        difficulty: item.difficulty ?? null,
        category: item.category ?? null,
      })),
    )
    .select("*");
  if (error) throw new Error(error.message);
  return (data as ColorTestPoolQuestion[] | null) ?? [];
}

export async function setColorTestQuestionActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from("color_test_questions")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Arsip (soft delete) — riwayat sesi lama tetap utuh. */
export async function archiveColorTestQuestion(id: string): Promise<void> {
  const { error } = await supabase
    .from("color_test_questions")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Ubah soal pool (gambar, jawaban, status aktif). */
export async function updateColorTestQuestion(
  id: string,
  patch: Partial<Pick<ColorTestQuestionInput, "image_url" | "image_public_id" | "correct_answer">> & {
    active?: boolean;
  },
): Promise<void> {
  const { error } = await supabase
    .from("color_test_questions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
