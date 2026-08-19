import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { TeacherDashboard } from "@/features/dashboard/components/teacher-dashboard";
import { RequireStaff } from "@/middleware";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Dashboard Pengajar — I:UM 이음" },
      { name: "description", content: "Pantau aktivitas belajar siswa pada lembaga Anda." },
      { property: "og:title", content: "Dashboard Pengajar — I:UM 이음" },
      {
        property: "og:description",
        content: "Pantau aktivitas belajar siswa pada lembaga Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherPage,
});

function TeacherPage() {
  return (
    <AppLayout>
      <RequireStaff>
        <TeacherDashboard />
      </RequireStaff>
    </AppLayout>
  );
}
