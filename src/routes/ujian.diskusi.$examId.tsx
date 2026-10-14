import { createFileRoute } from "@tanstack/react-router";

import { ExamDiscussionPage } from "@/features/discussion/components/exam-discussion-page";

export const Route = createFileRoute("/ujian/diskusi/$examId")({
  validateSearch: (search: Record<string, unknown>): { q?: string; t?: string } => ({
    ...(typeof search['q'] === "string" ? { q: search['q'] } : {}),
    ...(typeof search['t'] === "string" ? { t: search['t'] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Diskusi Ujian — I:UM 이음" },
      { name: "description", content: "Diskusi soal ujian bersama siswa dan guru." },
      { property: "og:title", content: "Diskusi Ujian — I:UM 이음" },
      { property: "og:description", content: "Diskusi soal ujian bersama siswa dan guru." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiskusiPage,
});

function DiskusiPage() {
  const { examId } = Route.useParams();
  const { q, t } = Route.useSearch();
  return <ExamDiscussionPage examId={examId} focusQuestionId={q} tenantId={t} />;
}
