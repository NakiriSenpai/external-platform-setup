import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { LessonPreview } from "@/features/lesson/components/lesson-preview";

export const Route = createFileRoute("/owner_/lesson-studio/$lessonId/preview")({
  head: () => ({
    meta: [
      { title: "Preview Lesson — I:UM 이음" },
      { name: "description", content: "Pratinjau tampilan materi untuk siswa." },
      { property: "og:title", content: "Preview Lesson — I:UM 이음" },
      { property: "og:description", content: "Pratinjau tampilan materi untuk siswa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerLessonPreviewPage,
});

function OwnerLessonPreviewPage() {
  const { lessonId } = Route.useParams();
  return (
    <AppLayout>
      <RequireOwner>
        <LessonPreview lessonId={lessonId} />
      </RequireOwner>
    </AppLayout>
  );
}
