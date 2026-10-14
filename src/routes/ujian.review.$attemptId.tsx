import { createFileRoute } from "@tanstack/react-router";

import { ReviewWorkspace } from "@/features/exam-engine/workspace/review-workspace";

export const Route = createFileRoute("/ujian/review/$attemptId")({
  head: () => ({
    meta: [
      { title: "Review Ujian — I:UM 이음" },
      { name: "description", content: "Tinjau soal, jawaban benar, dan pembahasan ujian Anda." },
      { property: "og:title", content: "Review Ujian — I:UM 이음" },
      {
        property: "og:description",
        content: "Tinjau soal, jawaban benar, dan pembahasan ujian Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search['q'] === "string" ? { q: search['q'] } : {},
  component: ReviewUjianPage,
});

function ReviewUjianPage() {
  const { attemptId } = Route.useParams();
  const { q } = Route.useSearch();
  return <ReviewWorkspace attemptId={attemptId} focusQuestionId={q} />;
}
