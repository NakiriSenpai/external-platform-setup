import { createFileRoute } from "@tanstack/react-router";

import { DownloadView } from "@/features/download/components/download-view";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download Aplikasi — I:UM 이음" },
      {
        name: "description",
        content:
          "Unduh aplikasi Android I:UM 이음 langsung dari situs resmi beserta panduan instalasi APK.",
      },
      { property: "og:title", content: "Download Aplikasi — I:UM 이음" },
      {
        property: "og:description",
        content: "Unduh APK resmi I:UM 이음 dan ikuti panduan instalasi di perangkat Android.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

function DownloadPage() {
  return <DownloadView />;
}
