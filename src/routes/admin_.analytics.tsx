import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireAdmin } from "@/middleware";
import { TeacherAnalyticsDashboard } from "@/features/teacher-analytics/components/teacher-analytics-dashboard";

export const Route = createFileRoute("/admin_/analytics")({
  head: () => ({
    meta: [
      { title: "Analitik Lembaga — I:UM 이음" },
      { name: "description", content: "Analitik performa ujian pada lembaga Anda." },
      { property: "og:title", content: "Analitik Lembaga — I:UM 이음" },
      { property: "og:description", content: "Analitik performa ujian pada lembaga Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminAnalyticsPage,
});

/** Analitik tenant untuk Admin. Scope tenant ditentukan server (analytics_require_staff). */
function AdminAnalyticsPage() {
  return (
    <AppLayout>
      <RequireAdmin>
        <TeacherAnalyticsDashboard />
      </RequireAdmin>
    </AppLayout>
  );
}
