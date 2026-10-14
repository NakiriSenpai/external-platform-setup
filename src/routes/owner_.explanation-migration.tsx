import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { ExplanationMigrationPanel } from "@/features/question-bank/components/explanation-migration-panel";

export const Route = createFileRoute("/owner_/explanation-migration")({
  head: () => ({
    meta: [
      { title: "Migrasi Referensi Pilihan — I:UM 이음" },
      { name: "description", content: "Pratinjau dan migrasi nomor pilihan pada pembahasan soal." },
      { property: "og:title", content: "Migrasi Referensi Pilihan — I:UM 이음" },
      { property: "og:description", content: "Pratinjau dan migrasi nomor pilihan pada pembahasan soal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppLayout>
      <RequireOwner>
        <ExplanationMigrationPanel />
      </RequireOwner>
    </AppLayout>
  ),
});
