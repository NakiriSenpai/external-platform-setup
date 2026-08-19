import { createFileRoute } from "@tanstack/react-router";

import { ColorTestWorkspace } from "@/features/color-test/components/color-test-workspace";

export const Route = createFileRoute("/ujian/color-test/$attemptId")({
  head: () => ({
    meta: [
      { title: "Tes Buta Warna — I:UM 이음" },
      {
        name: "description",
        content: "Tahap tes buta warna setelah ujian: 12 soal, minimal 7 benar untuk lulus.",
      },
      { property: "og:title", content: "Tes Buta Warna — I:UM 이음" },
      {
        property: "og:description",
        content: "Tahap tes buta warna setelah ujian: 12 soal, minimal 7 benar untuk lulus.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ColorTestPage,
});

function ColorTestPage() {
  const { attemptId } = Route.useParams();
  return <ColorTestWorkspace attemptId={attemptId} />;
}
