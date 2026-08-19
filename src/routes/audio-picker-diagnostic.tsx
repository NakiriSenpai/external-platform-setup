import { createFileRoute } from "@tanstack/react-router";

import { MediaPicker } from "@/features/media";

export const Route = createFileRoute("/audio-picker-diagnostic")({
  head: () => ({
    meta: [
      { title: "Audio Picker Diagnostic — I:UM 이음" },
      { name: "description", content: "Diagnostic audio picker I:UM 이음." },
      { property: "og:title", content: "Audio Picker Diagnostic — I:UM 이음" },
      { property: "og:description", content: "Diagnostic audio picker I:UM 이음." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AudioPickerDiagnostic,
});

function AudioPickerDiagnostic() {
  return (
    <main className="mx-auto w-full max-w-xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Audio Picker Diagnostic</h1>
      <MediaPicker allowed={["audio"]} folder="lpk/media/audio-diagnostic" />
    </main>
  );
}