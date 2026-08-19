import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { LoadingScreen } from "@/components/common/loading-screen";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth";
import { landingPathFor } from "@/lib/auth/landing";
import type { AppRole } from "@/types/auth";
import { ROLE_LABELS } from "@/types/auth";

/**
 * Guard sesi. Semua route selain "/" dan "/login" dibungkus komponen ini.
 * Sesi Supabase tersimpan di browser, sehingga pemeriksaan dilakukan di klien.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Simpan tujuan awal agar tidak tertimpa saat proses pengalihan berlangsung.
  const intended = useRef(pathname);
  // Bila sesi sempat aktif lalu hilang (logout), jangan bawa redirect sesi lama.
  const hadSession = useRef(false);

  useEffect(() => {
    if (isAuthenticated) hadSession.current = true;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({
        to: "/login",
        search: hadSession.current ? {} : { redirect: intended.current },
        replace: true,
      });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) return <LoadingScreen label="Memeriksa sesi…" />;
  if (!isAuthenticated) return <LoadingScreen label="Mengalihkan ke halaman masuk…" />;

  return <>{children}</>;
}

/** Layar penolakan akses standar (dipakai semua guard role). */
export function AccessDenied({ message }: { message: string }) {
  const { role } = useAuth();
  return (
    <div className="space-y-3 rounded-lg border border-border p-6 text-center">
      <h1 className="text-lg font-semibold">Akses ditolak</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="min-h-11">
        <Link to={landingPathFor(role)}>Kembali ke halaman utama</Link>
      </Button>
    </div>
  );
}

/** Guard berbasis daftar role yang diizinkan. */
export function RequireAnyRole({
  roles,
  children,
  message,
}: {
  roles: readonly AppRole[];
  children: ReactNode;
  message?: string;
}) {
  const { isLoading, role } = useAuth();

  return (
    <RequireAuth>
      {isLoading || !role ? (
        <LoadingScreen label="Memeriksa akses…" />
      ) : roles.includes(role) ? (
        <>{children}</>
      ) : (
        <AccessDenied
          message={
            message ?? `Halaman ini hanya untuk ${roles.map((r) => ROLE_LABELS[r]).join(", ")}.`
          }
        />
      )}
    </RequireAuth>
  );
}

/** Guard berbasis satu role. */
export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  return (
    <RequireAnyRole roles={[role]} message={`Halaman ini hanya untuk ${ROLE_LABELS[role]}.`}>
      {children}
    </RequireAnyRole>
  );
}

export const RequireOwner = ({ children }: { children: ReactNode }) => (
  <RequireRole role="owner">{children}</RequireRole>
);
export const RequireAdmin = ({ children }: { children: ReactNode }) => (
  <RequireRole role="admin">{children}</RequireRole>
);
export const RequireGuru = ({ children }: { children: ReactNode }) => (
  <RequireRole role="guru">{children}</RequireRole>
);
export const RequireSiswa = ({ children }: { children: ReactNode }) => (
  <RequireRole role="siswa">{children}</RequireRole>
);

/** Guard staf: owner, admin, dan guru (siswa ditolak). */
export const RequireStaff = ({ children }: { children: ReactNode }) => (
  <RequireAnyRole
    roles={["owner", "admin", "guru"]}
    message="Halaman ini hanya untuk pengajar, admin, dan pemilik."
  >
    {children}
  </RequireAnyRole>
);
