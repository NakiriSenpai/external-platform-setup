import { createFileRoute } from "@tanstack/react-router";

import { ExamHistory } from "@/features/exam-engine/components/exam-history";

export const Route = createFileRoute("/ujian/riwayat/$examId")({
  head: () => ({
    meta: [
      { title: "Riwayat Ujian — I:UM 이음" },
      { name: "description", content: "Seluruh percobaan ujian Anda beserta nilai dan durasi." },
      { property: "og:title", content: "Riwayat Ujian — I:UM 이음" },
      {
        property: "og:description",
        content: "Seluruh percobaan ujian Anda beserta nilai dan durasi.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiwayatUjianPage,
});

function RiwayatUjianPage() {
  const { examId } = Route.useParams();
  return <ExamHistory examId={examId} />;
}
