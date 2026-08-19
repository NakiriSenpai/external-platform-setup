import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { ExamList } from "@/features/exam/components/exam-list";

export const Route = createFileRoute("/owner_/exam-studio/")({
  head: () => ({
    meta: [
      { title: "Exam Studio — I:UM 이음" },
      { name: "description", content: "Susun ujian, section, dan soal I:UM 이음." },
      { property: "og:title", content: "Exam Studio — I:UM 이음" },
      { property: "og:description", content: "Susun ujian, section, dan soal I:UM 이음." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerExamStudioPage,
});

function OwnerExamStudioPage() {
  return (
    <AppLayout>
      <RequireOwner>
        <ExamList />
      </RequireOwner>
    </AppLayout>
  );
}
