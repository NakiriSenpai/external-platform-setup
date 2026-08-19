import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import { MaintenanceGate } from "@/components/common/maintenance-gate";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoadingScreen } from "@/components/common/loading-screen";
import { useAuth } from "@/hooks/auth";
import { resolvePostLoginTarget } from "@/lib/auth/landing";
import logoUrl from "@/assets/ium-logo.png";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search["redirect"];
    return typeof redirect === "string" && redirect.startsWith("/") ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: "Masuk ke Akun — I:UM 이음" },
      {
        name: "description",
        content: "Masuk ke I:UM 이음 menggunakan akun yang diberikan oleh lembaga Anda.",
      },
      { property: "og:title", content: "Masuk ke Akun — I:UM 이음" },
      {
        property: "og:description",
        content: "Masuk ke I:UM 이음 menggunakan akun yang diberikan oleh lembaga Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { isAuthenticated, isLoading, role } = useAuth();
  const navigate = useNavigate();
  // Role berasal dari tabel `profiles` (server), bukan penyimpanan klien.
  const target = resolvePostLoginTarget(role, redirect);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: target, replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, target]);

  return (
    <MaintenanceGate>
      <div className="ium-page min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-10">
          <header className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="Logo I:UM 이음"
              width={512}
              height={512}
              className="size-24 object-contain"
            />
            <p className="mt-2 text-sm font-semibold leading-snug">
              Belajar bahasa Korea,
              <br />
              hubungkan{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                masa depan
              </span>
              .
            </p>
          </header>

          <section className="ium-card mt-8 p-6">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary-muted">
                <Lock className="size-5 text-primary" aria-hidden />
              </span>
              <h1 className="mt-3 text-xl font-bold tracking-tight">Masuk ke Akun</h1>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Gunakan akun yang diberikan oleh lembaga Anda untuk melanjutkan.
              </p>
            </div>

            <div className="mt-6">
              {isLoading ? (
                <LoadingScreen label="Memeriksa sesi…" />
              ) : (
                <LoginForm onSuccess={() => undefined} />
              )}
            </div>
          </section>

          <div className="mt-auto flex flex-col items-center gap-2 pt-8 text-muted-foreground">
            <span className="grid size-10 place-items-center rounded-full bg-primary-muted">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
            </span>
            <p className="text-xs">Aman dan terlindungi</p>
          </div>
        </div>
      </div>
    </MaintenanceGate>
  );
}
