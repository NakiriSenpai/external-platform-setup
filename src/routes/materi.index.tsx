import { createFileRoute } from "@tanstack/react-router";

import { MateriHome } from "@/features/materi/components/materi-home";

export const Route = createFileRoute("/materi/")({
  head: () => ({
    meta: [
      { title: "Materi — Belajar per Kategori | I:UM 이음" },
      {
        name: "description",
        content: "Progres belajar, kategori materi, dan daftar materi terbit I:UM 이음.",
      },
      { property: "og:title", content: "Materi — Belajar per Kategori | I:UM 이음" },
      {
        property: "og:description",
        content: "Progres belajar, kategori materi, dan daftar materi terbit I:UM 이음.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MateriHome,
});
