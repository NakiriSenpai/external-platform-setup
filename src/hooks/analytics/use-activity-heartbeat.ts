import { useEffect } from "react";

import { recordStudentActivity } from "@/services/analytics/analytics-v2.service";

const KEY = "ium:activity-heartbeat";
const THROTTLE_MS = 10 * 60 * 1000;

/** Catat kehadiran siswa (maksimal sekali tiap 10 menit). Fire-and-forget. */
export function useActivityHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const ping = () => {
      const last = Number(window.localStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < THROTTLE_MS) return;
      window.localStorage.setItem(KEY, String(Date.now()));
      void recordStudentActivity().catch(() => undefined);
    };

    ping();
    const timer = window.setInterval(ping, THROTTLE_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
}
