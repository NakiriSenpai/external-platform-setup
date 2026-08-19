import { supabase } from "@/lib/supabase/client";
import { toSlug } from "@/features/exam/exam.constants";

export const EXAM_CATEGORY_TABLE = "exam_categories";

export type ExamCategoryRow = {
  id: string;
  tenant_id: string | null;
  slug: string;
  label: string;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ExamCategoryInput = {
  label: string;
  slug?: string;
};

/**
 * Daftar kategori ujian (sumber tunggal dari database).
 * Tenant isolation ditegakkan oleh RLS `exam_categories_select_tenant`.
 */
export async function listExamCategories(): Promise<ExamCategoryRow[]> {
  const { data, error } = await supabase
    .from(EXAM_CATEGORY_TABLE)
    .select("*")
    .order("order_index", { ascending: true })
    .order("label", { ascending: true });
  // Tabel mungkin belum dimigrasi pada environment tertentu — jangan crash UI.
  if (error) return [];
  return (data as ExamCategoryRow[] | null) ?? [];
}

export async function createExamCategory(input: ExamCategoryInput): Promise<ExamCategoryRow> {
  const label = input.label.trim();
  const slug = toSlug(input.slug || label);
  if (label.length < 2) throw new Error("Nama kategori minimal 2 karakter.");
  if (slug.length < 2) throw new Error("Slug kategori tidak valid.");

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(EXAM_CATEGORY_TABLE)
    .insert({ label, slug, created_by: userData.user?.id ?? null })
    .select("*")
    .single();
  if (error) {
    throw new Error(
      error.message.includes("duplicate")
        ? "Kategori dengan slug tersebut sudah ada."
        : "Gagal membuat kategori.",
    );
  }
  return data as ExamCategoryRow;
}

export async function updateExamCategory(
  id: string,
  input: ExamCategoryInput,
): Promise<ExamCategoryRow> {
  const label = input.label.trim();
  if (label.length < 2) throw new Error("Nama kategori minimal 2 karakter.");
  const patch: Record<string, string> = { label };
  if (input.slug) patch['slug'] = toSlug(input.slug);

  const { data, error } = await supabase
    .from(EXAM_CATEGORY_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error("Gagal memperbarui kategori.");
  return data as ExamCategoryRow;
}

/** Jumlah exam yang masih memakai slug kategori (guard sebelum hapus). */
export async function countExamsByCategory(slug: string): Promise<number> {
  const { count, error } = await supabase
    .from("exams")
    .select("id", { count: "exact", head: true })
    .eq("category", slug);
  if (error) return 0;
  return count ?? 0;
}

/** Hapus kategori. Ditolak bila masih dipakai exam (tanpa cascade ke exam). */
export async function deleteExamCategory(category: ExamCategoryRow): Promise<void> {
  const used = await countExamsByCategory(category.slug);
  if (used > 0) {
    throw new Error(`Kategori masih digunakan oleh ${used} ujian.`);
  }
  const { error } = await supabase.from(EXAM_CATEGORY_TABLE).delete().eq("id", category.id);
  if (error) throw new Error("Gagal menghapus kategori.");
}
