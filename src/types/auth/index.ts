import type { Session, User } from "@supabase/supabase-js";

import type { ProfileRow } from "@/types/database";

/** Daftar role aplikasi. */
export const APP_ROLES = ["owner", "admin", "guru", "siswa"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Pemilik",
  admin: "Admin",
  guru: "Guru",
  siswa: "Siswa",
};

/** Urutan hak akses, angka lebih besar = wewenang lebih tinggi. */
export const ROLE_RANK: Record<AppRole, number> = {
  siswa: 1,
  guru: 2,
  admin: 3,
  owner: 4,
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Fallback role dari metadata Supabase Auth.
 * Hanya dipakai bila baris `profiles` belum tersedia — bukan sumber utama.
 */
export function readRole(user: User | null): AppRole | null {
  if (!user) return null;
  const meta = { ...(user.app_metadata ?? {}), ...(user.user_metadata ?? {}) } as Record<
    string,
    unknown
  >;
  return isAppRole(meta["role"]) ? meta["role"] : null;
}

export type AuthUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: AppRole | null;
  tenantId: string | null;
  isActive: boolean;
};

export type AuthState = {
  user: AuthUser | null;
  session: Session | null;
  profile: ProfileRow | null;
  role: AppRole | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

export type LoginCredentials = {
  email: string;
  password: string;
};
