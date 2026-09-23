import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AudioTrimDialog, MediaPreview, UploadDropzone, UploadProgress } from "@/components/media";
import { useMediaUpload } from "@/hooks/media";
import { getMediaType } from "@/lib/media/utils";
import type { MediaAsset, MediaKind } from "@/types/media";

type Props = {
  /** Jenis media yang boleh diunggah. */
  allowed?: MediaKind[];
  /** Folder tujuan di Cloudinary. */
  folder?: string;
  label?: string;
  /** Nilai awal (mis. saat mengedit data). */
  value?: MediaAsset | null;
  onChange?: (asset: MediaAsset | null) => void;
};

/**
 * Komponen pemilih media reusable: unggah, progres, batal, ulangi, pratinjau.
 * Dipakai bersama oleh seluruh fitur yang membutuhkan media.
 */
export function MediaPicker({
  allowed = ["image", "audio"],
  folder,
  label,
  value = null,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<MediaAsset | null>(value);
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const kinds = useMemo(() => allowed, [allowed]);

  const uploader = useMediaUpload({
    ...(folder ? { folder } : {}),
    allowed: kinds,
    onSuccess: (asset) => {
      setSelected(asset);
      onChange?.(asset);
    },
  });

  useEffect(() => {
    setSelected(value);
  }, [value]);

  // Jangan pernah gagal diam-diam: error unggah selalu tampil sebagai toast.
  useEffect(() => {
    if (uploader.status === "error" && uploader.error) toast.error(uploader.error);
  }, [uploader.status, uploader.error]);

  const clear = () => {
    uploader.reset();
    setSelected(null);
    onChange?.(null);
  };

  // Audio baru tidak langsung diunggah: user memilih rentang dulu di Trim Dialog.
  const handleSelect = (file: File) => {
    const expected: MediaKind | null = kinds.length === 1 ? (kinds[0] as MediaKind) : null;
    if (getMediaType(file, expected) === "audio") {
      setPendingAudio(file);
      return;
    }
    void uploader.upload(file);
  };

  return (
    <div className="space-y-3">
      <AudioTrimDialog
        open={pendingAudio !== null}
        source={pendingAudio}
        onCancel={() => setPendingAudio(null)}
        onApply={(file) => {
          setPendingAudio(null);
          void uploader.upload(file);
        }}
      />
      {selected ? (
        <div className="space-y-2">
          <MediaPreview asset={selected} fileName={uploader.file?.name} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={clear}>
              <Trash2 className="mr-1 size-4" /> Hapus pilihan
            </Button>
          </div>
        </div>
      ) : (
        <UploadDropzone
          allowed={kinds}
          disabled={uploader.isUploading}
          onSelect={handleSelect}
          {...(label ? { label } : {})}
        />
      )}

      {!selected ? (
        <UploadProgress
          status={uploader.status}
          progress={uploader.progress}
          error={uploader.error}
          fileName={uploader.file?.name}
          onCancel={uploader.cancel}
          onRetry={() => void uploader.retry()}
        />
      ) : null}
    </div>
  );
}
