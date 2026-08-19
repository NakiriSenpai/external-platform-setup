import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireAuth } from "@/middleware";

export const Route = createFileRoute("/ujian")({
  head: () => ({
    meta: [
      { title: "Ujian — I:UM 이음" },
      { name: "description", content: "Ujian daring untuk peserta pelatihan." },
      { property: "og:title", content: "Ujian — I:UM 이음" },
      { property: "og:description", content: "Ujian daring untuk peserta pelatihan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UjianLayout,
});

function UjianLayout() {
  return (
    <AppLayout>
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    </AppLayout>
  );
}
