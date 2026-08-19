import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Object URL / URL gambar sumber. */
  src: string;
  /** Ukuran output persegi (px). */
  outputSize?: number;
  pending?: boolean;
  onApply: (blob: Blob) => void | Promise<void>;
};

const VIEW = 240;

/**
 * Editor crop/posisi sederhana: geser (drag) + zoom, output persegi.
 * Murni canvas di browser — tidak menambah dependency dan tidak upload dua kali.
 */
export function ImageCropDialog({
  open,
  onOpenChange,
  src,
  outputSize = 512,
  pending = false,
  onApply,
}: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open || !src) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [open, src]);

  /** Skala dasar agar gambar menutupi area crop (cover). */
  const baseScale = image ? Math.max(VIEW / image.width, VIEW / image.height) : 1;

  const draw = useCallback(
    (canvas: HTMLCanvasElement, size: number) => {
      if (!image) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ratio = size / VIEW;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      const scale = baseScale * zoom * ratio;
      const w = image.width * scale;
      const h = image.height * scale;
      const x = size / 2 - w / 2 + offset.x * ratio;
      const y = size / 2 - h / 2 + offset.y * ratio;
      ctx.drawImage(image, x, y, w, h);
    },
    [image, baseScale, zoom, offset],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) draw(canvas, VIEW);
  }, [draw]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current;
    if (!start) return;
    setOffset({ x: event.clientX - start.x, y: event.clientY - start.y });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const apply = async () => {
    const canvas = document.createElement("canvas");
    draw(canvas, outputSize);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 0.92),
    );
    if (blob) await onApply(blob);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sesuaikan Icon</DialogTitle>
          <DialogDescription>Geser gambar dan atur zoom, lalu terapkan.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={VIEW}
            height={VIEW}
            className="max-w-full touch-none rounded-2xl border border-border bg-muted"
            style={{ width: VIEW, height: VIEW, cursor: "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Perkecil"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.1).toFixed(2))))}
          >
            <Minus className="size-4" />
          </Button>
          <Slider
            className="min-w-0 flex-1"
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={([v]) => setZoom(v ?? 1)}
            aria-label="Zoom icon"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Perbesar"
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="justify-self-start"
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          <RotateCcw className="mr-1 size-4" /> Reset
        </Button>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" disabled={pending || !image} onClick={() => void apply()}>
            {pending ? "Menyimpan…" : "Terapkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
