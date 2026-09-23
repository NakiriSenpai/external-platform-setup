import { useEffect, useState } from "react";
import { RefreshCw, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AudioTrimDialog, UploadProgress } from "@/components/media";
import { MediaPicker } from "@/features/media/components/media-picker";
import { useMediaUpload } from "@/hooks/media";
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
 * (gambar/audio), bukan URL mentah, plus aksi ganti, potong (audio), dan hapus.
 */
export function ExamMediaField({ kind, url, onChange, uploadLabel, folder = "exam" }: Props) {
  const [replacing, setReplacing] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [lastTrimFile, setLastTrimFile] = useState<File | null>(null);

  const uploader = useMediaUpload({
    folder,
    allowed: [kind],
    onSuccess: (asset) => {
      // URL lama hanya diganti setelah unggahan hasil potong benar-benar sukses.
      onChange(asset.url);
      setLastTrimFile(null);
    },
  });

  useEffect(() => {
    if (uploader.status === "error" && uploader.error) toast.error(uploader.error);
  }, [uploader.status, uploader.error]);

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

      {kind === "audio" ? (
        <>
          <AudioTrimDialog
            open={trimming}
            source={trimming ? url : null}
            onCancel={() => setTrimming(false)}
            onApply={(file) => {
              setTrimming(false);
              setLastTrimFile(file);
              void uploader.upload(file);
            }}
          />
          {uploader.status !== "idle" ? (
            <UploadProgress
              status={uploader.status}
              progress={uploader.progress}
              error={uploader.error}
              fileName={lastTrimFile?.name ?? uploader.file?.name}
              onCancel={uploader.cancel}
              onRetry={() => void uploader.retry()}
            />
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setReplacing(true)}>
          <RefreshCw className="mr-1 size-3.5" />
          {kind === "image" ? "Ganti Gambar" : "Ganti Audio"}
        </Button>
        {kind === "audio" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploader.isUploading}
            onClick={() => setTrimming(true)}
          >
            <Scissors className="mr-1 size-3.5" />
            Potong Audio
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
          <Trash2 className="mr-1 size-3.5 text-destructive" />
          Hapus
        </Button>
      </div>
    </div>
  );
}
