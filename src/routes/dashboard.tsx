import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { StudentDashboard } from "@/features/dashboard/components/student-dashboard";
import { AppLayout } from "@/layouts/app-layout";
import { LoadingScreen } from "@/components/common/loading-screen";
import { useAuth } from "@/hooks/auth";
import { landingPathFor } from "@/lib/auth/landing";
import { RequireAuth } from "@/middleware";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dasbor — I:UM 이음" },
      { name: "description", content: "Dasbor peserta I:UM 이음." },
      { property: "og:title", content: "Dasbor — I:UM 이음" },
      { property: "og:description", content: "Dasbor peserta I:UM 이음." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppLayout>
      <RequireAuth>
        <DashboardByRole />
      </RequireAuth>
    </AppLayout>
  );
}

/** Non-siswa yang membuka /dashboard dialihkan ke landing role masing-masing. */
function DashboardByRole() {
  const { role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && role && role !== "siswa") {
      void navigate({ to: landingPathFor(role), replace: true });
    }
  }, [isLoading, role, navigate]);

  if (isLoading) return <LoadingScreen label="Memeriksa akses…" />;
  if (role && role !== "siswa") return <LoadingScreen label="Mengalihkan…" />;
  return <StudentDashboard />;
}
