import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Clock, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/auth";
import { commitAvatarChange, type AvatarCooldownStatus } from "@/lib/profile/avatar.functions";
import { deleteMediaAsset } from "@/lib/media/media.functions";
import {
  buildAvatarFile,
  coverScale,
  loadImageFromFile,
  validateAvatarFile,
} from "@/lib/profile/avatar-image";
import { uploadAvatar } from "@/services/profile/avatar.service";
import { cn } from "@/lib/utils";
import { AvatarTermsDialog } from "./avatar-terms-dialog";

const VIEWPORT = 264;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl: string | null;
  cooldown: AvatarCooldownStatus | null;
  onSaved: () => void;
};

export function AvatarDialog({ open, onOpenChange, currentAvatarUrl, cooldown, onSaved }: Props) {
  const { user, tenantId, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Role bebas cooldown (owner/admin/guru) ditandai server via `exempt`.
  const locked = Boolean(cooldown && !cooldown.exempt && !cooldown.canChange);

  const reset = useCallback(() => {
    imageRef.current = null;
    setPreviewUrl(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    const check = validateAvatarFile(file);
    if (!check.valid) {
      toast.error(check.message ?? "Foto tidak valid.");
      return;
    }
    try {
      const image = await loadImageFromFile(file);
      imageRef.current = image;
      setBaseScale(coverScale(image, VIEWPORT));
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setPreviewUrl(image.src);
    } catch {
      toast.error("Foto tidak dapat dibaca.");
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setOffset({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = async () => {
    const image = imageRef.current;
    if (!image || !user) return;
    setIsSaving(true);
    try {
      // 1) Kompresi di client (512x512, <= 300KB) — belum ada upload saat crop.
      const file = await buildAvatarFile(image, {
        viewport: VIEWPORT,
        baseScale,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      });
      // 2) Upload aset baru.
      const uploaded = await uploadAvatar(file, { tenantId, userId: user.id });
      // 3) Update database (cooldown & isolasi tenant diperiksa di server).
      const result = await commitAvatarChange({
        data: { avatarUrl: uploaded.url, publicId: uploaded.publicId },
      });
      // 4) Hapus aset lama setelah database aman.
      if (result.previousPublicId) {
        try {
          await deleteMediaAsset({
            data: { publicId: result.previousPublicId, resourceType: "image" },
          });
        } catch {
          // Kegagalan pembersihan tidak boleh membatalkan perubahan foto.
        }
      }
      await refreshProfile();
      toast.success("Foto profil berhasil diperbarui.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan foto profil.");
    } finally {
      setIsSaving(false);
    }
  };

  const displayUrl = previewUrl ?? currentAvatarUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 border-border bg-background p-0">
        <div className="flex items-center gap-2 px-4 py-4">
          <DialogTitle className="flex-1 text-center text-lg font-semibold">
            Ganti Foto Profil
          </DialogTitle>
        </div>

        <div className="flex flex-col items-center px-6 pb-6">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn(
              "relative overflow-hidden rounded-full border-2 border-primary bg-surface glow-primary",
              previewUrl ? "cursor-grab touch-none active:cursor-grabbing" : "",
            )}
            style={{ width: VIEWPORT, height: VIEWPORT }}
          >
            {displayUrl ? (
              <img
                src={displayUrl}
                alt="Pratinjau foto profil"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={
                  previewUrl && imageRef.current
                    ? {
                        width: imageRef.current.naturalWidth * baseScale * zoom,
                        height: imageRef.current.naturalHeight * baseScale * zoom,
                        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                      }
                    : {
                        width: VIEWPORT,
                        height: VIEWPORT,
                        objectFit: "cover",
                        transform: "translate(-50%, -50%)",
                      }
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Camera className="h-10 w-10" />
              </div>
            )}
          </div>

          {previewUrl ? (
            <div className="mt-5 flex w-full max-w-xs items-center gap-3">
              <Minus className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.01}
                onValueChange={([next]) => setZoom(next ?? 1)}
                aria-label="Perbesaran foto"
              />
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void handlePick(event.target.files?.[0])}
          />

          <Button
            type="button"
            variant="outline"
            disabled={locked || isSaving}
            onClick={() => fileInputRef.current?.click()}
            className="mt-6 rounded-xl border-primary/60 px-6 text-primary hover:bg-primary-muted hover:text-primary"
          >
            <Camera className="mr-2 h-4 w-4" />
            Pilih Foto
          </Button>

          <p className="mt-4 max-w-xs text-center text-sm text-muted-foreground">
            Gunakan foto yang jelas dan sesuai dengan{" "}
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="rounded-md px-1 py-0.5 font-medium text-primary underline underline-offset-2 transition-colors hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ketentuan
            </button>{" "}
            komunitas kami.
          </p>

          {locked && cooldown ? (
            <div className="mt-6 w-full rounded-2xl border border-warning/30 bg-warning/10 p-5 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-warning" />
              <p className="mt-3 font-semibold text-warning">Anda telah mengubah foto profil.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Anda dapat mengubahnya kembali dalam {cooldown.daysRemaining} hari.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/15 px-4 py-2 text-sm font-medium text-warning">
                <Clock className="h-4 w-4" />
                {cooldown.daysRemaining} hari lagi
              </span>
            </div>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={locked || isSaving || !previewUrl}
            className="mt-6 h-12 w-full rounded-xl text-base font-semibold"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Simpan
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="mt-3 h-12 w-full rounded-xl text-base font-semibold"
          >
            Batal
          </Button>
        </div>
      </DialogContent>
      <AvatarTermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
    </Dialog>
  );
}
