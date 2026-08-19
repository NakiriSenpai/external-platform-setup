import { createFileRoute } from "@tanstack/react-router";

import { ResultWorkspace } from "@/features/exam-engine/workspace/result-workspace";

export const Route = createFileRoute("/ujian/hasil/$attemptId")({
  head: () => ({
    meta: [
      { title: "Hasil Ujian — I:UM 이음" },
      { name: "description", content: "Nilai, status kelulusan, dan ringkasan hasil ujian Anda." },
      { property: "og:title", content: "Hasil Ujian — I:UM 이음" },
      {
        property: "og:description",
        content: "Nilai, status kelulusan, dan ringkasan hasil ujian Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HasilUjianPage,
});

function HasilUjianPage() {
  const { attemptId } = Route.useParams();
  return <ResultWorkspace attemptId={attemptId} />;
}
