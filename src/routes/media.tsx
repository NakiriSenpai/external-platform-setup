import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/layouts/app-layout";
import { RequireOwner } from "@/middleware";
import { MediaPicker } from "@/features/media";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title: "Media — I:UM 이음" },
      { name: "description", content: "Pusat unggah media gambar dan audio I:UM 이음." },
      { property: "og:title", content: "Media — I:UM 이음" },
      {
        property: "og:description",
        content: "Pusat unggah media gambar dan audio I:UM 이음.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  return (
    <AppLayout>
      <RequireOwner>
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
          <header>
            <h1 className="text-xl font-semibold text-foreground">Media</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Uji coba sistem media terpusat: unggah gambar dan audio ke Cloudinary.
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unggah gambar</CardTitle>
              <CardDescription>JPG, PNG, WEBP, atau SVG.</CardDescription>
            </CardHeader>
            <CardContent>
              <MediaPicker allowed={["image"]} folder="lpk/media/image" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unggah audio</CardTitle>
              <CardDescription>MP3, WAV, M4A, atau OGG.</CardDescription>
            </CardHeader>
            <CardContent>
              <MediaPicker allowed={["audio"]} folder="lpk/media/audio" />
            </CardContent>
          </Card>
        </div>
      </RequireOwner>
    </AppLayout>
  );
}
