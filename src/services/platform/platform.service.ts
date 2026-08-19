import { supabase } from "@/lib/supabase/client";
import { TABLES } from "@/types/database";

export type PlatformStats = {
  tenants: number;
  users: number;
  activeUsers: number;
  publishedExams: number;
  publishedLessons: number;
};

/** Ringkasan platform untuk Owner Control Center (hanya angka agregat). */
export async function getPlatformStats(): Promise<PlatformStats> {
  const head = { count: "exact" as const, head: true };

  const [tenants, users, activeUsers, exams, lessons] = await Promise.all([
    supabase.from(TABLES.tenants).select("id", head),
    supabase.from(TABLES.profiles).select("id", head),
    supabase.from(TABLES.profiles).select("id", head).eq("is_active", true),
    supabase.from("exams").select("id", head).eq("status", "published"),
    supabase.from("lessons").select("id", head).eq("status", "published"),
  ]);

  const failed = [tenants, users, activeUsers, exams, lessons].find((r) => r.error);
  if (failed?.error) throw new Error("Gagal memuat ringkasan platform.");

  return {
    tenants: tenants.count ?? 0,
    users: users.count ?? 0,
    activeUsers: activeUsers.count ?? 0,
    publishedExams: exams.count ?? 0,
    publishedLessons: lessons.count ?? 0,
  };
}
