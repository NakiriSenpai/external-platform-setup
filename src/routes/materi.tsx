import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireAuth } from "@/middleware";

export const Route = createFileRoute("/materi")({
  head: () => ({
    meta: [
      { title: "Materi — I:UM 이음" },
      { name: "description", content: "Materi pembelajaran I:UM 이음 yang sudah terbit." },
      { property: "og:title", content: "Materi — I:UM 이음" },
      {
        property: "og:description",
        content: "Materi pembelajaran I:UM 이음 yang sudah terbit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MateriLayout,
});

function MateriLayout() {
  return (
    <AppLayout>
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    </AppLayout>
  );
}
