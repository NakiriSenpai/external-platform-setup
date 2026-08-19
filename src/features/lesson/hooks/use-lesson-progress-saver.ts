import { useCallback, useEffect, useRef, useState } from "react";

import { updateLessonProgress } from "@/services/lesson/lesson-progress.service";

export type ProgressSaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 700;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

/**
 * Penyimpan progres materi yang aman:
 * - debounce + dedupe (satu request aktif, unit digabung)
 * - retry terbatas (maks 3 percobaan), tanpa loop tak terbatas
 * - satu status error saja; navigasi UI tidak pernah menunggu save
 */
export function useLessonProgressSaver(
  lessonId: string,
  options: { enabled: boolean; onSaved?: () => void } = { enabled: true },
) {
  const { enabled, onSaved } = options;
  const [status, setStatus] = useState<ProgressSaveStatus>("idle");

  const pendingUnits = useRef<Set<string>>(new Set());
  const pendingBlock = useRef<string | null>(null);
  const inFlight = useRef(false);
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const savedCb = useRef(onSaved);
  savedCb.current = onSaved;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Jangan pernah membawa unit tertunda dari lesson lama ke lesson baru saat
  // TanStack Router mempertahankan instance komponen pada perubahan parameter.
  useEffect(() => {
    pendingUnits.current.clear();
    pendingBlock.current = null;
    attempts.current = 0;
    inFlight.current = false;
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
  }, [lessonId]);

  const flush = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    if (pendingUnits.current.size === 0 && !pendingBlock.current) return;

    const units = [...pendingUnits.current];
    const block = pendingBlock.current;
    inFlight.current = true;
    setStatus("saving");

    try {
      await updateLessonProgress(lessonId, units, block);
      units.forEach((unit) => pendingUnits.current.delete(unit));
      pendingBlock.current = null;
      attempts.current = 0;
      if (mounted.current) setStatus("saved");
      savedCb.current?.();
    } catch (error) {
      attempts.current += 1;
      if (mounted.current) setStatus("error");
      if (attempts.current < MAX_ATTEMPTS) {
        timer.current = setTimeout(() => void flush(), RETRY_DELAY_MS);
      }
      if (import.meta.env.DEV) console.error(error);
    } finally {
      inFlight.current = false;
    }
  }, [enabled, lessonId]);

  /** Antrikan unit yang sudah dibaca. Tidak pernah memblokir navigasi. */
  const queue = useCallback(
    (blockIds: string[], currentBlockId: string | null) => {
      if (!enabled) return;
      blockIds.forEach((id) => pendingUnits.current.add(id));
      if (currentBlockId) pendingBlock.current = currentBlockId;
      attempts.current = 0;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [enabled, flush],
  );

  /** Coba lagi manual setelah gagal. */
  const retry = useCallback(() => {
    attempts.current = 0;
    void flush();
  }, [flush]);

  return { status, queue, retry, flush };
}
