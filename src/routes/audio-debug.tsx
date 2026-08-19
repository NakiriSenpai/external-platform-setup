import { createFileRoute } from "@tanstack/react-router";

import { MediaPicker } from "@/features/media/components/media-picker";
import type { MediaAsset } from "@/types/media";

declare global {
  interface Window {
    __audioDebugAsset?: MediaAsset | null;
  }
}

export const Route = createFileRoute("/audio-debug")({
  component: AudioDebugRoute,
});

function AudioDebugRoute() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <MediaPicker
        allowed={["audio"]}
        folder="exam"
        label="Unggah audio soal"
        onChange={(asset) => {
          window.__audioDebugAsset = asset;
          console.info("[AUDIO DEBUG] test QuestionForm received change");
        }}
      />
    </main>
  );
}