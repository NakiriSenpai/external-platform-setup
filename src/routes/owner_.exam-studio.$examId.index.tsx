import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { ExamEditor } from "@/features/exam/components/exam-editor";

export const Route = createFileRoute("/owner_/exam-studio/$examId/")({
  head: () => ({
    meta: [
      { title: "Editor Exam — I:UM 이음" },
      { name: "description", content: "Kelola section, soal, jawaban, dan pembahasan ujian." },
      { property: "og:title", content: "Editor Exam — I:UM 이음" },
      {
        property: "og:description",
        content: "Kelola section, soal, jawaban, dan pembahasan ujian.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerExamEditorPage,
});

function OwnerExamEditorPage() {
  const { examId } = Route.useParams();
  return (
    <AppLayout>
      <RequireOwner>
        <ExamEditor examId={examId} />
      </RequireOwner>
    </AppLayout>
  );
}
