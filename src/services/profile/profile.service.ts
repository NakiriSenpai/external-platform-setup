import { supabase } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/database";
import { TABLES } from "@/types/database";

const COLUMNS =
  "id, tenant_id, role, email, full_name, display_name, username, avatar_url, is_active, created_by, last_login_at, created_at, updated_at";

/** Ambil profil milik user tertentu. Mengembalikan null bila belum tersedia. */
export async function getProfileById(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select(COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error("Gagal memuat profil pengguna.");
  return (data as ProfileRow | null) ?? null;
}

/** Profil user yang sedang masuk. */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return getProfileById(data.user.id);
}
