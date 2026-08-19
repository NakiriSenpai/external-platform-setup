import { createFileRoute } from "@tanstack/react-router";

import { ExamCatalog } from "@/features/exam-engine/components/exam-catalog";

export const Route = createFileRoute("/ujian/")({
  head: () => ({
    meta: [
      { title: "Daftar Ujian — I:UM 이음" },
      { name: "description", content: "Pilih dan mulai ujian yang tersedia untuk Anda." },
      { property: "og:title", content: "Daftar Ujian — I:UM 이음" },
      { property: "og:description", content: "Pilih dan mulai ujian yang tersedia untuk Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UjianIndexPage,
});

function UjianIndexPage() {
  return <ExamCatalog />;
}
