import { useRef, useState } from "react";
import { ImagePlus, Scissors, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadMedia } from "@/services/media";
import { ImageCropDialog } from "./image-crop-dialog";

type Props = {
  value: string;
  onChange: (url: string) => void;
};

/**
 * Field icon exam: pilih gambar → editor crop/posisi (drag + zoom) → unggah
 * hasil crop ke Cloudinary (satu kali upload). Yang disimpan tetap URL media.
 */
export function ExamIconField({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [src, setSrc] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.");
      return;
    }
    setSrc(URL.createObjectURL(file));
    setOpen(true);
  };

  const applyCrop = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `exam-icon-${Date.now()}.png`, { type: "image/png" });
      const asset = await uploadMedia(file, { folder: "exam/icons", kind: "image" });
      onChange(asset.url);
      setOpen(false);
      if (src) URL.revokeObjectURL(src);
      setSrc("");
      toast.success("Icon exam diperbarui.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah icon.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium">Icon Exam</Label>
      <p className="text-xs text-muted-foreground">
        Icon tampil pada katalog ujian. Atur posisi dan zoom sebelum disimpan.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2">
          <img
            src={value}
            alt="Pratinjau icon exam"
            className="size-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <Scissors className="mr-1 size-4" /> Ganti / Sesuaikan
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Hapus icon" onClick={() => onChange("")}>
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-1 size-4" /> Unggah icon exam
        </Button>
      )}

      <ImageCropDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && src) {
            URL.revokeObjectURL(src);
            setSrc("");
          }
        }}
        src={src}
        pending={uploading}
        onApply={applyCrop}
      />
    </div>
  );
}
