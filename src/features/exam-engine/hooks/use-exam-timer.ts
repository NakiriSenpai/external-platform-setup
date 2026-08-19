import { useEffect, useState } from "react";

type TimerState = {
  remaining: number;
  /** Timer siap dipakai (expires_at valid dan sudah dihitung di klien). */
  isReady: boolean;
  isExpired: boolean;
  label: string;
};

/**
 * Sisa waktu dihitung dari `expires_at` server, sehingga tahan refresh browser.
 * `startedAt` dipakai sebagai proteksi: bila expires_at tidak lebih besar dari
 * started_at (durasi rusak), timer dianggap TIDAK valid dan ujian tidak pernah
 * dianggap habis waktu.
 */
export function useExamTimer(
  expiresAt: string | undefined,
  active: boolean,
  startedAt?: string,
): TimerState {
  const valid = isValidWindow(expiresAt, startedAt);
  const [remaining, setRemaining] = useState(() => (valid ? computeRemaining(expiresAt) : 0));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!valid) {
      setIsReady(false);
      setRemaining(0);
      return;
    }
    setRemaining(computeRemaining(expiresAt));
    setIsReady(true);
    if (!active) return;
    const id = window.setInterval(() => setRemaining(computeRemaining(expiresAt)), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, active, valid]);

  return {
    remaining,
    isReady: isReady && valid,
    isExpired: valid && isReady && remaining <= 0,
    label: valid ? formatRemaining(remaining) : "--:--",
  };
}

function isValidWindow(expiresAt: string | undefined, startedAt?: string): boolean {
  if (!expiresAt) return false;
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return false;
  if (!startedAt) return true;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return true;
  return end > start;
}

function computeRemaining(expiresAt: string | undefined): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function formatRemaining(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
