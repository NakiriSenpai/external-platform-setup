import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { ColorTestPoolManager } from "@/features/color-test/components/color-test-pool-manager";

export const Route = createFileRoute("/owner_/color-test")({
  head: () => ({
    meta: [
      { title: "Bank Soal Tes Buta Warna — I:UM 이음" },
      {
        name: "description",
        content: "Kelola pool soal tes buta warna: unggah gambar, jawaban benar, dan status aktif.",
      },
      { property: "og:title", content: "Bank Soal Tes Buta Warna — I:UM 이음" },
      {
        property: "og:description",
        content: "Kelola pool soal tes buta warna: unggah gambar, jawaban benar, dan status aktif.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ColorTestPoolPage,
});

function ColorTestPoolPage() {
  return (
    <AppLayout>
      <RequireOwner>
        <ColorTestPoolManager />
      </RequireOwner>
    </AppLayout>
  );
}
