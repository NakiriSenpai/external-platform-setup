import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDuration, formatFileSize } from "@/lib/media/utils";

type Props = {
  src: string;
  fileName?: string | undefined;
  duration?: number | undefined;
  bytes?: number | undefined;
};

/** Pemutar audio sederhana: play, pause, durasi, nama berkas. */
export function AudioPreview({ src, fileName, duration, bytes }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setTotal(duration ?? 0);
  }, [src, duration]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={toggle}
        aria-label={playing ? "Jeda audio" : "Putar audio"}
        className="size-11 shrink-0 rounded-full"
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{fileName ?? "Berkas audio"}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatDuration(current)} / {formatDuration(total)}
          {typeof bytes === "number" ? ` · ${formatFileSize(bytes)}` : ""}
        </p>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setTotal(value);
        }}
        className="hidden"
      />
    </div>
  );
}
