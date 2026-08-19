import type { AppRole } from "@/types/auth";

/** Landing page utama per role (dipakai login redirect & tombol kembali). */
export const ROLE_LANDING: Record<AppRole, string> = {
  owner: "/owner",
  admin: "/admin",
  guru: "/teacher",
  siswa: "/dashboard",
};

export function landingPathFor(role: AppRole | null | undefined): string {
  return role ? ROLE_LANDING[role] : "/dashboard";
}

/** Route yang hanya boleh menjadi tujuan redirect bila cocok dengan role. */
const ROLE_PREFIX: Record<string, readonly AppRole[]> = {
  "/owner": ["owner"],
  "/admin": ["admin"],
  "/teacher": ["owner", "admin", "guru"],
  "/exam-studio": ["owner"],
  "/lesson-studio": ["owner"],
  "/media": ["owner"],
};

function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Landing page role adalah otoritas utama setelah login.
 *
 * `redirect` hanya boleh dipakai bila:
 * - bukan landing page milik role lain (sisa sesi sebelumnya), dan
 * - route tersebut memang diizinkan untuk role saat ini.
 *
 * Owner SELALU diarahkan ke `/owner` (tidak boleh mewarisi rute sesi lama).
 */
export function resolvePostLoginTarget(role: AppRole | null, redirect?: string): string {
  const landing = landingPathFor(role);
  if (!role) return landing;
  // Owner absolut: abaikan seluruh redirect state dari sesi sebelumnya.
  if (role === "owner") return landing;
  if (!redirect || !redirect.startsWith("/") || redirect === "/login" || redirect === "/") {
    return landing;
  }
  // Redirect yang merupakan landing role lain = sisa sesi lama → buang.
  const foreignLanding = Object.entries(ROLE_LANDING).some(
    ([otherRole, path]) => otherRole !== role && matchesPrefix(redirect, path),
  );
  if (foreignLanding) return landing;

  const match = Object.entries(ROLE_PREFIX).find(([prefix]) => matchesPrefix(redirect, prefix));
  if (match && !match[1].includes(role)) return landing;
  return redirect;
}
