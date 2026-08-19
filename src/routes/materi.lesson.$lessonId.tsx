import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { LessonViewer } from "@/features/lesson/components/lesson-viewer";

export const Route = createFileRoute("/materi/lesson/$lessonId")({
  head: () => ({
    meta: [
      { title: "Belajar Materi — I:UM 이음" },
      {
        name: "description",
        content: "Baca materi pembelajaran per bagian dengan progres tersimpan otomatis.",
      },
      { property: "og:title", content: "Belajar Materi — I:UM 이음" },
      {
        property: "og:description",
        content: "Baca materi pembelajaran per bagian dengan progres tersimpan otomatis.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MateriLessonPage,
});

function MateriLessonPage() {
  const { lessonId } = Route.useParams();
  const navigate = useNavigate();
  return <LessonViewer lessonId={lessonId} onBack={() => void navigate({ to: "/materi" })} />;
}
