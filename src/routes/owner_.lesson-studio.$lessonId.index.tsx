import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { LessonEditor } from "@/features/lesson/components/lesson-editor";

export const Route = createFileRoute("/owner_/lesson-studio/$lessonId/")({
  head: () => ({
    meta: [
      { title: "Editor Lesson — I:UM 이음" },
      { name: "description", content: "Kelola section, konten, dan latihan materi." },
      { property: "og:title", content: "Editor Lesson — I:UM 이음" },
      { property: "og:description", content: "Kelola section, konten, dan latihan materi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerLessonEditorPage,
});

function OwnerLessonEditorPage() {
  const { lessonId } = Route.useParams();
  return (
    <AppLayout>
      <RequireOwner>
        <LessonEditor lessonId={lessonId} />
      </RequireOwner>
    </AppLayout>
  );
}
