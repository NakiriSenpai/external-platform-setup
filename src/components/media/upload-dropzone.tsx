import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";
import { acceptMime, formatFileSize } from "@/lib/media/utils";
import { MEDIA_SIZE_LIMIT } from "@/lib/media/constants";
import { getFileExtension } from "@/lib/media/utils";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const selectFile = (file: File | undefined, source: "input" | "drop") => {
    console.info(`[AUDIO DEBUG] ${source === "input" ? "file input changed" : "file dropped"}`);
    if (!file) {
      console.warn("[AUDIO DEBUG] no file received");
      return;
    }
    // Some Android WebViews dispatch both input and change for one selection.
    if (lastFileRef.current === file) return;
    lastFileRef.current = file;
    console.info("[AUDIO DEBUG] file selected");
    console.info(`[AUDIO DEBUG] name=${file.name || "(tanpa nama)"}`);
    console.info(`[AUDIO DEBUG] type=${file.type || "(kosong)"}`);
    console.info(`[AUDIO DEBUG] size=${file.size}`);
    console.info(`[AUDIO DEBUG] extension=${getFileExtension(file.name) || "(kosong)"}`);
    onSelect(file);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.currentTarget.files?.[0], "input");
    // Reset after reading so selecting the same file again still emits change.
    event.currentTarget.value = "";
    queueMicrotask(() => {
      lastFileRef.current = null;
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    selectFile(event.dataTransfer.files?.[0], "drop");
  };

  const hint = allowed
    .map((kind) =>
      kind === "image"
        ? `Gambar JPG, PNG, WEBP, SVG (maks ${formatFileSize(MEDIA_SIZE_LIMIT.image)})`
        : `Audio MP3, WAV, M4A, OGG (maks ${formatFileSize(MEDIA_SIZE_LIMIT.audio)})`,
    )
    .join(" · ");

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
        "relative flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors",
        dragging && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <UploadCloud className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        aria-label={label}
        disabled={disabled}
        className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 file:cursor-pointer"
        accept={acceptMime(allowed)}
        onClick={() => console.info("[AUDIO DEBUG] native file input opened")}
        onChange={handleFileInput}
      />
    </div>
  );
}
