import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { MateriCategory } from "@/features/materi/components/materi-category";

export const Route = createFileRoute("/materi/$category")({
  head: () => ({
    meta: [
      { title: "Kategori Materi — I:UM 이음" },
      {
        name: "description",
        content: "Daftar materi per kategori beserta progres, level, dan status belajar.",
      },
      { property: "og:title", content: "Kategori Materi — I:UM 이음" },
      {
        property: "og:description",
        content: "Daftar materi per kategori beserta progres, level, dan status belajar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MateriCategoryPage,
});

function MateriCategoryPage() {
  const { category } = Route.useParams();
  const navigate = useNavigate();
  return (
    <MateriCategory
      category={category}
      onBack={() => void navigate({ to: "/materi" })}
      onOpen={(lessonId) => void navigate({ to: "/materi/lesson/$lessonId", params: { lessonId } })}
    />
  );
}
