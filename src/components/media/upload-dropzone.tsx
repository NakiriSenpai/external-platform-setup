import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";
import { acceptMime, formatFileSize } from "@/lib/media/utils";
import { MEDIA_SIZE_LIMIT } from "@/lib/media/constants";
import { getFileExtension } from "@/lib/media/utils";
import {
  audioDebug,
  clearAudioPickerPending,
  clearAudioDebug,
  getAudioDocumentId,
  markAudioPickerPending,
  readAudioPickerPending,
} from "@/lib/media/audio-debug";
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
  const lastFileRef = useRef("");
  const pickerOpenedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const audioOnly = allowed.length === 1 && allowed[0] === "audio";

  useEffect(() => {
    if (!audioOnly) return;
    const pending = readAudioPickerPending();
    if (pending && pending.documentId !== getAudioDocumentId()) {
      audioDebug(
        "02 DOCUMENT_RELOADED",
        "Dokumen berubah saat native picker masih terbuka; File tidak dapat dikembalikan ke input lama",
      );
      clearAudioPickerPending();
    }
    const reportReturn = () => {
      if (!pickerOpenedRef.current) return;
      audioDebug("02 PICKER_RETURN", "Halaman aktif kembali; menunggu event input/change");
    };
    const reportVisibility = () => {
      if (!pickerOpenedRef.current) return;
      audioDebug(
        "02 PICKER_VISIBILITY",
        document.visibilityState === "hidden" ? "Storage dibuka" : "Halaman terlihat kembali",
      );
    };
    window.addEventListener("focus", reportReturn);
    document.addEventListener("visibilitychange", reportVisibility);
    return () => {
      window.removeEventListener("focus", reportReturn);
      document.removeEventListener("visibilitychange", reportVisibility);
    };
  }, [audioOnly]);

  const selectFile = (file: File | undefined, source: "input" | "drop") => {
    audioDebug("03 FILE_EVENT", source === "input" ? "Native input/change terpanggil" : "File dropped");
    if (!file) {
      audioDebug("03 FILE_MISSING", "Event terpanggil tetapi File tidak tersedia");
      return;
    }
    const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
    // Android/Chrome dapat mengirim input lalu change untuk pilihan yang sama.
    if (lastFileRef.current === fingerprint) {
      audioDebug("03 FILE_DUPLICATE", "Event duplikat diabaikan");
      return;
    }
    lastFileRef.current = fingerprint;
    pickerOpenedRef.current = false;
    clearAudioPickerPending();
    audioDebug(
      "04 FILE_RECEIVED",
      `name=${file.name || "(tanpa nama)"}; type=${file.type || "(kosong)"}; size=${file.size}; ext=${getFileExtension(file.name) || "(kosong)"}`,
    );
    onSelect(file);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.currentTarget.files?.[0], "input");
    // Reset after reading so selecting the same file again still emits change.
    event.currentTarget.value = "";
    window.setTimeout(() => {
      lastFileRef.current = "";
    }, 1500);
  };

  const handleFileInputEvent = (event: FormEvent<HTMLInputElement>) => {
    selectFile(event.currentTarget.files?.[0], "input");
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
        onClick={() => {
          pickerOpenedRef.current = true;
          if (audioOnly) {
            clearAudioDebug();
            markAudioPickerPending();
            audioDebug("01 PICKER_OPEN", `Native picker dibuka; accept=${acceptMime(allowed)}`);
          }
        }}
        onInput={handleFileInputEvent}
        onChange={handleFileInput}
      />
    </div>
  );
}
