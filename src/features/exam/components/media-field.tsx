import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/features/media/components/media-picker";
import type { MediaKind } from "@/types/media";

type Props = {
  /** Jenis media ditentukan oleh slot/metadata field, bukan menebak dari URL. */
  kind: MediaKind;
  url: string | null;
  onChange: (url: string | null) => void;
  uploadLabel: string;
  folder?: string;
};

/**
 * Renderer media tunggal untuk seluruh editor soal: menampilkan media asli
 * (gambar/audio), bukan URL mentah, plus aksi ganti dan hapus.
 */
export function ExamMediaField({ kind, url, onChange, uploadLabel, folder = "exam" }: Props) {
  const [replacing, setReplacing] = useState(false);

  if (!url || replacing) {
    return (
      <div className="min-w-0 space-y-2">
        <MediaPicker
          allowed={[kind]}
          folder={folder}
          label={uploadLabel}
          onChange={(asset) => {
            if (!asset) return;
            onChange(asset.url);
            setReplacing(false);
          }}
        />
        {url ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setReplacing(false)}>
            Batal ganti
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/30 p-2">
      {kind === "image" ? (
        <img
          src={url}
          alt="Pratinjau media soal"
          loading="lazy"
          className="max-h-44 w-full max-w-full rounded-md border border-border bg-background object-contain"
        />
      ) : (
        <audio controls src={url} className="w-full max-w-full">
          <track kind="captions" />
        </audio>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setReplacing(true)}>
          <RefreshCw className="mr-1 size-3.5" />
          {kind === "image" ? "Ganti Gambar" : "Ganti Audio"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
          <Trash2 className="mr-1 size-3.5 text-destructive" />
          Hapus
        </Button>
      </div>
    </div>
  );
}
