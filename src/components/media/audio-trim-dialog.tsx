import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  AudioTrimError,
  formatPreciseTime,
  trimAudioBlob,
} from "@/lib/media/audio-trim";

type Props = {
  open: boolean;
  /** Sumber audio: berkas lokal yang baru dipilih atau URL audio tersimpan. */
  source: File | string | null;
  /** Nama berkas untuk hasil trim. */
  fileName?: string;
  /** Dipanggil dengan berkas final (asli bila rentang tidak diubah). */
  onApply: (file: File) => void;
  onCancel: () => void;
};

/** Dialog potong durasi audio — mobile-first, tanpa scroll panjang. */
export function AudioTrimDialog({ open, source, fileName, onApply, onCancel }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rangeOnly, setRangeOnly] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = useMemo(() => {
    if (fileName) return fileName;
    if (source instanceof File) return source.name;
    if (typeof source === "string") return source.split("/").pop() ?? "audio";
    return "audio";
  }, [fileName, source]);

  // Buat object URL sekali per sumber, selalu di-revoke saat berganti/menutup.
  useEffect(() => {
    if (!open || !source) {
      setSrc(null);
      return;
    }
    if (typeof source === "string") {
      setSrc(source);
      return;
    }
    const url = URL.createObjectURL(source);
    objectUrlRef.current = url;
    setSrc(url);
    return () => {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
    };
  }, [open, source]);

  useEffect(() => {
    if (!open) {
      setDuration(0);
      setRange([0, 0]);
      setCurrent(0);
      setPlaying(false);
      setRangeOnly(false);
      setProcessing(false);
      setError(null);
    }
  }, [open]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const playFrom = useCallback((from: number, limited: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    setRangeOnly(limited);
    audio.currentTime = from;
    void audio.play().catch(() => setError("Audio tidak dapat diputar di perangkat ini."));
  }, []);

  const [start, end] = range;
  const resultDuration = Math.max(0, end - start);
  const untouched = duration > 0 && start <= 0.05 && end >= duration - 0.05;

  const apply = async () => {
    if (!source || resultDuration <= 0) return;
    setError(null);
    pause();
    if (untouched && source instanceof File) {
      onApply(source);
      return;
    }
    setProcessing(true);
    try {
      const blob =
        source instanceof File
          ? source
          : await fetch(source).then((response) => {
              if (!response.ok) throw new AudioTrimError("Audio tersimpan tidak dapat diambil.");
              return response.blob();
            });
      const file = await trimAudioBlob(blob, start, end, name);
      onApply(file);
    } catch (err) {
      setError(
        err instanceof AudioTrimError
          ? err.message
          : "Gagal memproses audio. Silakan coba lagi.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !processing) {
          pause();
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Scissors className="size-4" /> Potong Audio
          </DialogTitle>
          <DialogDescription className="truncate">{name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-11 shrink-0 rounded-full"
              aria-label={playing ? "Jeda audio" : "Putar audio"}
              onClick={() => (playing ? pause() : playFrom(current, false))}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <p className="text-sm tabular-nums text-foreground">
              {formatPreciseTime(current)} / {formatPreciseTime(duration)}
            </p>
          </div>

          <div className="space-y-2">
            <SliderPrimitive.Root
              className="relative flex w-full touch-none select-none items-center py-2"
              value={range}
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.1}
              minStepsBetweenThumbs={1}
              onValueChange={(value) => {
                const next: [number, number] = [value[0] ?? 0, value[1] ?? duration];
                if (next[1] - next[0] < 0.1) return;
                setRange(next);
              }}
            >
              <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20">
                <SliderPrimitive.Range className="absolute h-full bg-primary" />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb
                aria-label="Waktu mulai"
                className="block size-5 rounded-full border-2 border-primary bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <SliderPrimitive.Thumb
                aria-label="Waktu selesai"
                className="block size-5 rounded-full border-2 border-primary bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </SliderPrimitive.Root>
            <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
              <span>Mulai {formatPreciseTime(start)}</span>
              <span>Selesai {formatPreciseTime(end)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-sm text-muted-foreground">Durasi hasil</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatPreciseTime(resultDuration)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={resultDuration <= 0}
              onClick={() => playFrom(start, true)}
            >
              <Play className="mr-1 size-4" /> Preview Hasil
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                pause();
                setRange([0, duration]);
              }}
            >
              <RotateCcw className="mr-1 size-4" /> Reset
            </Button>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {processing ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Memproses audio…
            </p>
          ) : null}
        </div>

        {src ? (
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            className="hidden"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={(event) => {
              const value = event.currentTarget.duration;
              if (Number.isFinite(value) && value > 0) {
                setDuration(value);
                setRange([0, value]);
              }
            }}
            onTimeUpdate={(event) => {
              const audio = event.currentTarget;
              setCurrent(audio.currentTime);
              if (rangeOnly && audio.currentTime >= end) {
                audio.pause();
                audio.currentTime = end;
                setRangeOnly(false);
              }
            }}
          />
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={processing}
            onClick={() => {
              pause();
              onCancel();
            }}
          >
            Batal
          </Button>
          <Button type="button" disabled={processing || resultDuration <= 0} onClick={() => void apply()}>
            {processing ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
