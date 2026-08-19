import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

type Options<T> = {
  /** Nilai form yang dipantau. */
  value: T;
  /** Penyimpan; hanya dipanggil bila nilai berubah dari state tersimpan. */
  onSave: (value: T) => Promise<void>;
  /** Jeda debounce (ms). */
  delay?: number;
  /** Autosave hanya berjalan bila true (mis. validasi lolos). */
  enabled?: boolean;
};

/**
 * Autosave berbasis debounce. Membandingkan snapshot JSON nilai dengan
 * versi terakhir yang tersimpan agar tidak menyimpan ulang tanpa perubahan.
 *
 * Anti race-condition: setiap penyimpanan diberi nomor urut; hasil penyimpanan
 * lama tidak boleh menimpa status/baseline dari penyimpanan yang lebih baru.
 */
export function useAutosave<T>({ value, onSave, delay = 800, enabled = true }: Options<T>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const valueRef = useRef(value);
  valueRef.current = value;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const seqRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  /** Tandai nilai saat ini sebagai baseline tersimpan (tanpa memanggil server). */
  const markSaved = useCallback((next: T) => {
    savedRef.current = JSON.stringify(next);
    setStatus("saved");
    setError(null);
  }, []);

  /** Simpan sekarang (dipakai sebelum pindah halaman / buka preview). */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = valueRef.current;
    const snapshot = JSON.stringify(current);
    if (!enabledRef.current || savedRef.current === null || snapshot === savedRef.current) {
      await inFlightRef.current?.catch(() => undefined);
      return;
    }
    const seq = ++seqRef.current;
    setStatus("saving");
    const run = saveRef
      .current(current)
      .then(() => {
        if (seq !== seqRef.current) return;
        savedRef.current = snapshot;
        setStatus("saved");
        setError(null);
      })
      .catch((err: unknown) => {
        if (seq !== seqRef.current) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
      });
    inFlightRef.current = run;
    await run;
  }, []);

  useEffect(() => {
    const snapshot = JSON.stringify(value);
    if (savedRef.current === null) {
      savedRef.current = snapshot;
      return;
    }
    if (!enabled || snapshot === savedRef.current) return;

    setStatus("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const seq = ++seqRef.current;
      setStatus("saving");
      const run = saveRef
        .current(value)
        .then(() => {
          if (seq !== seqRef.current) return;
          savedRef.current = snapshot;
          setStatus("saved");
          setError(null);
        })
        .catch((err: unknown) => {
          if (seq !== seqRef.current) return;
          setStatus("error");
          setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
        });
      inFlightRef.current = run;
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, enabled, delay]);

  return { status, error, markSaved, flush };
}
