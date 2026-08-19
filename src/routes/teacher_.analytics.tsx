import { createFileRoute } from "@tanstack/react-router";

import { TeacherAnalyticsDashboard } from "@/features/teacher-analytics/components/teacher-analytics-dashboard";
import { AppLayout } from "@/layouts/app-layout";
import { RequireStaff } from "@/middleware";

export const Route = createFileRoute("/teacher_/analytics")({
  head: () => ({
    meta: [
      { title: "Analitik Pengajar — I:UM 이음" },
      { name: "description", content: "Analisis performa ujian siswa untuk pengajar LPK." },
      { property: "og:title", content: "Analitik Pengajar — I:UM 이음" },
      { property: "og:description", content: "Analisis performa ujian siswa untuk pengajar LPK." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherAnalyticsPage,
});

/** Analytics hanya untuk staf (guru, admin, owner). Siswa ditolak oleh guard. */
function TeacherAnalyticsPage() {
  return (
    <AppLayout>
      <RequireStaff>
        <TeacherAnalyticsDashboard />
      </RequireStaff>
    </AppLayout>
  );
}
