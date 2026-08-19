import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Loader2, Play } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Audio Manager global (Sprint 11).
 * - Hanya SATU audio aktif pada satu waktu.
 * - Mode ujian: audio otomatis diulang satu kali lalu terkunci permanen.
 *   Status terkunci disimpan per attempt sehingga tetap terkunci setelah refresh.
 * - Mode review: audio bebas diputar ulang, tetap satu audio aktif.
 * - UI hanya tombol ▶ dan spinner. Tanpa counter, durasi, timeline, atau pesan.
 */
type AudioContextValue = {
  playingKey: string | null;
  busy: boolean;
  isLocked: (key: string) => boolean;
  play: (key: string, src: string) => void;
};

const AudioManagerContext = createContext<AudioContextValue | null>(null);

const storageKey = (attemptId: string) => `lpk.audio-locked.${attemptId}`;

function readLocked(attemptId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(attemptId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function AudioManagerProvider({
  attemptId,
  lockAfterPlay,
  children,
}: {
  attemptId: string;
  /** true pada Exam (sekali putar + repeat 1x lalu terkunci), false pada Review. */
  lockAfterPlay: boolean;
  children: ReactNode;
}) {
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const roundRef = useRef(0);
  const currentKey = useRef<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocked(lockAfterPlay ? new Set(readLocked(attemptId)) : new Set());
  }, [attemptId, lockAfterPlay]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    elementRef.current = audio;
    return () => {
      audio.pause();
      elementRef.current = null;
    };
  }, []);

  const stop = useCallback(
    (lockKey: string | null) => {
      currentKey.current = null;
      roundRef.current = 0;
      setPlayingKey(null);
      if (lockKey && lockAfterPlay) {
        setLocked((prev) => {
          if (prev.has(lockKey)) return prev;
          const next = new Set(prev);
          next.add(lockKey);
          try {
            window.localStorage.setItem(storageKey(attemptId), JSON.stringify(Array.from(next)));
          } catch {
            /* penyimpanan penuh — kunci tetap berlaku selama sesi */
          }
          return next;
        });
      }
    },
    [attemptId, lockAfterPlay],
  );

  useEffect(() => {
    const audio = elementRef.current;
    if (!audio) return;
    const onEnded = () => {
      const key = currentKey.current;
      if (lockAfterPlay && roundRef.current === 1) {
        roundRef.current = 2;
        audio.currentTime = 0;
        void audio.play().catch(() => stop(key));
        return;
      }
      stop(key);
    };
    const onError = () => stop(currentKey.current);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [lockAfterPlay, stop]);

  const play = useCallback(
    (key: string, src: string) => {
      const audio = elementRef.current;
      if (!audio) return;
      if (currentKey.current) return; // satu audio aktif saja
      if (lockAfterPlay && locked.has(key)) return;
      currentKey.current = key;
      roundRef.current = 1;
      setPlayingKey(key);
      audio.src = src;
      audio.currentTime = 0;
      void audio.play().catch(() => stop(key));
    },
    [locked, lockAfterPlay, stop],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      playingKey,
      busy: playingKey !== null,
      isLocked: (key: string) => lockAfterPlay && locked.has(key),
      play,
    }),
    [playingKey, locked, lockAfterPlay, play],
  );

  return <AudioManagerContext.Provider value={value}>{children}</AudioManagerContext.Provider>;
}

export function useAudioManager(): AudioContextValue {
  const ctx = useContext(AudioManagerContext);
  if (!ctx) throw new Error("useAudioManager harus dipakai di dalam AudioManagerProvider");
  return ctx;
}

/**
 * Player audio premium (Sprint UI Final).
 * Pill compact: [ ▶  Dengarkan audio  ~~~~~ ]. Tanpa timeline, durasi, atau counter.
 */
export function AudioButton({
  audioKey,
  src,
  label = "Dengarkan audio",
  size = "default",
}: {
  audioKey: string;
  src: string;
  label?: string;
  size?: "default" | "sm";
}) {
  const { play, playingKey, isLocked, busy } = useAudioManager();
  const isPlaying = playingKey === audioKey;
  const lockedState = isLocked(audioKey);
  const disabled = lockedState || (busy && !isPlaying);
  const compact = size === "sm";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || isPlaying}
      onClick={() => play(audioKey, src)}
      className={cn(
        "group inline-flex max-w-full items-center gap-2.5 rounded-full border transition-all duration-200",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        lockedState
          ? "border-border-subtle bg-surface text-muted-foreground"
          : isPlaying
            ? "border-primary/70 bg-primary-muted text-foreground glow-primary"
            : "border-primary/45 bg-primary-muted text-foreground hover:border-primary active:scale-[0.98]",
        "disabled:cursor-not-allowed",
        disabled && !lockedState && !isPlaying && "opacity-45",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full",
          compact ? "size-7" : "size-8",
          lockedState ? "bg-surface-elevated" : "bg-primary text-primary-foreground",
        )}
      >
        {lockedState ? (
          <Check className="size-3.5" />
        ) : (
          <Play className={cn("fill-current", compact ? "size-3.5" : "size-4")} />
        )}
      </span>
      <span className={cn("truncate font-medium", compact ? "text-xs" : "text-sm")}>
        {lockedState ? "Audio selesai" : label}
      </span>
      <AudioWave active={isPlaying} />
    </button>
  );
}

/** Waveform 5 bar — bergerak saat aktif, statis saat idle. */
function AudioWave({ active }: { active: boolean }) {
  const delays = ["0ms", "120ms", "240ms", "120ms", "0ms"];
  const heights = ["40%", "70%", "100%", "60%", "45%"];
  return (
    <span className="ml-auto flex h-4 shrink-0 items-end gap-[3px]" aria-hidden>
      {delays.map((delay, index) => (
        <span
          key={index}
          className={cn(
            "block w-[3px] rounded-full",
            active ? "audio-wave-bar h-full bg-primary" : "bg-muted-foreground/45",
          )}
          style={active ? { animationDelay: delay } : { height: heights[index] }}
        />
      ))}
    </span>
  );
}
