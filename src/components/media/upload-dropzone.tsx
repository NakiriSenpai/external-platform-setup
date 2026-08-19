import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { acceptMime, formatFileSize } from "@/lib/media/utils";
import { MEDIA_SIZE_LIMIT } from "@/lib/media/constants";
import type { MediaKind } from "@/types/media";

type Props = {
  allowed?: MediaKind[];
  disabled?: boolean;
  onSelect: (file: File) => void;
  label?: string;
};

/** Area unggah dengan dukungan tap (mobile) dan drag & drop (desktop). */
export function UploadDropzone({
  allowed = ["image", "audio"],
  disabled = false,
  onSelect,
  label = "Pilih atau seret berkas ke sini",
}: Props) {
  // Satu input stabil ber-ref; jangan pernah di-remount atau di-reset saat
  // picker Android sedang terbuka — inilah inti perbaikan lifecycle Android.
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef("");
  const [dragging, setDragging] = useState(false);

  const selectFile = (file: File | undefined) => {
    if (!file) return;
    const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
    // Android/Chrome dapat mengirim input lalu change untuk pilihan yang sama.
    if (lastFileRef.current === fingerprint) return;
    lastFileRef.current = fingerprint;
    onSelect(file);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.currentTarget.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    selectFile(event.dataTransfer.files?.[0]);
  };

  const hint = allowed
    .map((kind) =>
      kind === "image"
        ? `Gambar JPG, PNG, WEBP, SVG (maks ${formatFileSize(MEDIA_SIZE_LIMIT.image)})`
        : `Audio MP3, WAV, M4A, OGG (maks ${formatFileSize(MEDIA_SIZE_LIMIT.audio)})`,
    )
    .join(" · ");

  /** Harus sinkron dari user gesture agar Android membuka Storage. */
  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div
      aria-disabled={disabled}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex min-h-32 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors",
        dragging && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <UploadCloud className="size-6 text-muted-foreground" aria-hidden />
      <Button type="button" variant="ghost" disabled={disabled} onClick={openPicker}>
        {label}
      </Button>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        aria-label={`${label} file input`}
        disabled={disabled}
        className="sr-only"
        accept={acceptMime(allowed)}
        onChange={handleFileInput}
      />
    </div>
  );
}
