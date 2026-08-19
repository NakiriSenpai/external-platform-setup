import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import { resolvePublicOrigin } from "@/lib/env";
import type { AuthUser, LoginCredentials } from "@/types/auth";
import type { ProfileRow } from "@/types/database";

/** Ubah pesan error Supabase menjadi Bahasa Indonesia. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
  return "Gagal masuk. Silakan coba lagi.";
}

/**
 * Identitas aplikasi dibentuk dari tabel `profiles` (source of truth).
 * Session Supabase Auth hanya menyediakan id dan email.
 */
export function toAuthUser(session: Session | null, profile: ProfileRow | null): AuthUser | null {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: profile?.email ?? session.user.email ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    role: profile?.role ?? null,
    tenantId: profile?.tenant_id ?? null,
    isActive: profile?.is_active ?? true,
  };
}

export async function signInWithPassword({ email, password }: LoginCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(translateAuthError(error.message));
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Gagal keluar. Silakan coba lagi.");
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Kirim tautan reset password melalui Auth existing (tanpa sistem auth baru). */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${resolvePublicOrigin()}/reset-password`,
  });
  if (error) throw new Error(translateAuthError(error.message));
}

/** Ubah password memakai sesi recovery yang sudah divalidasi Auth. */
export async function updateUserPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("expired") || m.includes("invalid") || m.includes("session"))
      throw new Error("Sesi reset password sudah tidak berlaku. Minta tautan baru.");
    if (m.includes("should be different") || m.includes("same as the old"))
      throw new Error("Password baru harus berbeda dari password lama.");
    throw new Error("Gagal memperbarui password. Silakan coba lagi.");
  }
}
