import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { UploadStatus } from "@/types/media";

type Props = {
  status: UploadStatus;
  progress: number;
  error?: string | null;
  fileName?: string | undefined;
  onCancel?: () => void;
  onRetry?: () => void;
};

/** Indikator progres unggahan beserta aksi batal & ulangi. */
export function UploadProgress({ status, progress, error, fileName, onCancel, onRetry }: Props) {
  if (status === "idle") return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        {status === "uploading" ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : null}
        <p className="min-w-0 flex-1 truncate text-sm text-foreground">
          {fileName ?? "Berkas media"}
        </p>
        {status === "uploading" ? (
          <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
        ) : null}
      </div>

      {status === "uploading" ? <Progress value={progress} className="mt-2 h-2" /> : null}

      {status === "success" ? (
        <p className="mt-1 text-xs text-muted-foreground">Unggahan berhasil.</p>
      ) : null}

      {status === "error" || status === "canceled" ? (
        <p className="mt-1 text-xs text-destructive">{error ?? "Unggahan gagal."}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {status === "uploading" && onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            <X className="mr-1 size-4" /> Batalkan
          </Button>
        ) : null}
        {(status === "error" || status === "canceled") && onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="mr-1 size-4" /> Coba lagi
          </Button>
        ) : null}
      </div>
    </div>
  );
}
