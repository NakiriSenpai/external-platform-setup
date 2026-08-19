import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { ExamPreview } from "@/features/exam/components/exam-preview";

export const Route = createFileRoute("/owner_/exam-studio/$examId/preview")({
  head: () => ({
    meta: [
      { title: "Preview Ujian — I:UM 이음" },
      { name: "description", content: "Simulasi ujian read-only sebelum dipublish." },
      { property: "og:title", content: "Preview Ujian — I:UM 이음" },
      { property: "og:description", content: "Simulasi ujian read-only sebelum dipublish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerExamPreviewPage,
});

function OwnerExamPreviewPage() {
  const { examId } = Route.useParams();
  return (
    <AppLayout>
      <RequireOwner>
        <ExamPreview examId={examId} />
      </RequireOwner>
    </AppLayout>
  );
}
