import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const pickerReturnReportedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const audioOnly = allowed.length === 1 && allowed[0] === "audio";

  useEffect(() => {
    if (!audioOnly) return;
    audioDebug("AUDIO COMPONENT MOUNT", "UploadDropzone audio dipasang");
    const pending = readAudioPickerPending();
    if (pending) pickerOpenedRef.current = true;
    if (pending && pending.documentId !== getAudioDocumentId()) {
      audioDebug(
        "AUDIO DOCUMENT CHANGED",
        "Dokumen berubah saat native picker masih terbuka; File tidak dapat dikembalikan ke input lama",
      );
    }
    const reportReturn = (source: string) => {
      if (!pickerOpenedRef.current) return;
      audioDebug(source, "Halaman aktif kembali dari Android Storage");
      if (!pickerReturnReportedRef.current) {
        pickerReturnReportedRef.current = true;
        audioDebug("04 AUDIO_PICKER_RETURN", "Menunggu change event dari input yang sama");
      }
    };
    const reportVisibility = () => {
      if (!pickerOpenedRef.current) return;
      if (document.visibilityState === "hidden") {
        audioDebug("PAGE_HIDDEN", "Android Storage mengambil foreground");
      } else {
        reportReturn("PAGE_VISIBLE");
      }
    };
    const reportFocus = () => reportReturn("WINDOW_FOCUS");
    const reportBlur = () => {
      if (pickerOpenedRef.current) audioDebug("WINDOW_BLUR", "Window kehilangan focus");
    };
    const reportPageShow = () => reportReturn("PAGESHOW");
    window.addEventListener("focus", reportFocus);
    window.addEventListener("blur", reportBlur);
    window.addEventListener("pageshow", reportPageShow);
    document.addEventListener("visibilitychange", reportVisibility);
    return () => {
      audioDebug("AUDIO COMPONENT UNMOUNT", "UploadDropzone audio dilepas");
      window.removeEventListener("focus", reportFocus);
      window.removeEventListener("blur", reportBlur);
      window.removeEventListener("pageshow", reportPageShow);
      document.removeEventListener("visibilitychange", reportVisibility);
    };
  }, [audioOnly]);

  const selectFile = (file: File | undefined, source: "change" | "drop") => {
    if (!file) {
      if (audioOnly) audioDebug("07 AUDIO_FILE_OBJECT", "FAIL — File object tidak tersedia");
      return;
    }
    if (audioOnly) {
      audioDebug("07 AUDIO_FILE_OBJECT", "PASS — File object diterima");
      audioDebug("08 AUDIO_FILE_NAME", file.name || "(tanpa nama)");
      audioDebug("09 AUDIO_FILE_TYPE", file.type || "(kosong)");
      audioDebug("10 AUDIO_FILE_SIZE", String(file.size));
      audioDebug("11 AUDIO_EXTENSION", getFileExtension(file.name) || "(kosong)");
    }
    const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
    // Android/Chrome dapat mengirim input lalu change untuk pilihan yang sama.
    if (lastFileRef.current === fingerprint) {
      if (audioOnly) audioDebug("AUDIO_FILE_DUPLICATE", "File yang sama diabaikan");
      return;
    }
    lastFileRef.current = fingerprint;
    pickerOpenedRef.current = false;
    clearAudioPickerPending();
    onSelect(file);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (audioOnly) {
      if (!pickerReturnReportedRef.current) {
        pickerReturnReportedRef.current = true;
        audioDebug("04 AUDIO_PICKER_RETURN", "Picker mengembalikan kontrol melalui change event");
      }
      audioDebug("05 AUDIO_CHANGE_EVENT", "change event terpanggil");
      audioDebug("06 AUDIO_FILES_LENGTH", String(event.currentTarget.files?.length ?? 0));
    }
    selectFile(event.currentTarget.files?.[0], "change");
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

  const openPicker = () => {
    if (disabled) return;
    if (audioOnly) {
      clearAudioDebug();
      audioDebug("00 AUDIO_UPLOADER_READY", "Sesi picker audio dimulai");
      audioDebug("01 AUDIO_PICKER_BUTTON_CLICK", "Tombol picker ditekan oleh user");
      markAudioPickerPending();
      pickerOpenedRef.current = true;
      pickerReturnReportedRef.current = false;
    }
    inputRef.current?.click();
    if (audioOnly) audioDebug("03 AUDIO_PICKER_OPEN", "input.click() selesai dipanggil sinkron");
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
        onClick={() => {
          if (audioOnly) audioDebug("02 AUDIO_INPUT_CLICK", "click event diterima input ber-ref");
        }}
        onChange={handleFileInput}
      />
    </div>
  );
}
