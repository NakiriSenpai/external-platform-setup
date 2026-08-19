import { createFileRoute } from "@tanstack/react-router";

import { PagePlaceholder } from "@/components/common/page-placeholder";
import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";

export const Route = createFileRoute("/exam-studio")({
  head: () => ({
    meta: [
      { title: "Exam Studio — I:UM 이음" },
      { name: "description", content: "Studio penyusunan ujian I:UM 이음." },
      { property: "og:title", content: "Exam Studio — I:UM 이음" },
      { property: "og:description", content: "Studio penyusunan ujian I:UM 이음." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamStudioPage,
});

function ExamStudioPage() {
  return (
    <AppLayout>
      <RequireOwner>
        <PagePlaceholder title="Exam Studio" description="Penyusun soal dan ujian." />
      </RequireOwner>
    </AppLayout>
  );
}
