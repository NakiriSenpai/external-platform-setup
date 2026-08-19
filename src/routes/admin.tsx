import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireAdmin } from "@/middleware";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — I:UM 이음" },
      { name: "description", content: "Panel administrasi lembaga I:UM 이음." },
      { property: "og:title", content: "Admin — I:UM 이음" },
      { property: "og:description", content: "Panel administrasi lembaga I:UM 이음." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AppLayout>
      <RequireAdmin>
        <AdminDashboard />
      </RequireAdmin>
    </AppLayout>
  );
}
