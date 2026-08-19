import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { QuestionBankList } from "@/features/question-bank/components/question-bank-list";

export const Route = createFileRoute("/owner_/question-bank")({
  head: () => ({
    meta: [
      { title: "Question Bank — I:UM 이음" },
      {
        name: "description",
        content: "Library soal yang dapat dipakai ulang untuk Exam dan Lesson.",
      },
      { property: "og:title", content: "Question Bank — I:UM 이음" },
      {
        property: "og:description",
        content: "Library soal yang dapat dipakai ulang untuk Exam dan Lesson.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerQuestionBankPage,
});

function OwnerQuestionBankPage() {
  return (
    <AppLayout>
      <RequireOwner>
        <QuestionBankList />
      </RequireOwner>
    </AppLayout>
  );
}
