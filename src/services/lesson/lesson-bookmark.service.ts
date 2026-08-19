import { supabase } from "@/lib/supabase/client";

/**
 * Sprint 16B — Bookmark materi (per siswa).
 * Tabel: public.lesson_bookmarks. Bila migrasi belum dijalankan,
 * fungsi mengembalikan daftar kosong agar UI tetap hidup.
 */
const TABLE = "lesson_bookmarks";

export async function listBookmarkedLessonIds(): Promise<string[]> {
  const { data, error } = await supabase.from(TABLE).select("lesson_id");
  if (error) return [];
  return (data ?? []).map((row) => (row as { lesson_id: string }).lesson_id);
}

export async function setLessonBookmark(lessonId: string, bookmarked: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sesi berakhir. Silakan masuk kembali.");

  if (bookmarked) {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });
    if (error) throw new Error("Gagal menyimpan bookmark.");
    return;
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("lesson_id", lessonId);
  if (error) throw new Error("Gagal menghapus bookmark.");
}
