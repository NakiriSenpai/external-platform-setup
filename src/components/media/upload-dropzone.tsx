import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onSelect(file);
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
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors",
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
        className="hidden"
        accept={acceptMime(allowed)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
