import { useEffect, useState } from "react";

const STANDALONE_QUERIES = ["(display-mode: standalone)", "(display-mode: fullscreen)", "(display-mode: minimal-ui)"];

/**
 * True bila aplikasi berjalan sebagai installed PWA / TWA (APK), bukan tab browser.
 * Tidak memakai user-agent; murni display-mode + fallback iOS Safari.
 */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const matches = STANDALONE_QUERIES.some((query) => window.matchMedia?.(query).matches);
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const androidTwa = document.referrer.startsWith("android-app://");
  return matches || iosStandalone || androidTwa;
}

/**
 * Versi React-safe: SSR/hydrate selalu `false` (mode browser), lalu sinkron setelah mount
 * dan ikut berubah saat display-mode berpindah.
 */
export function useIsStandaloneApp(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const update = () => setStandalone(isStandaloneApp());
    update();
    const lists = STANDALONE_QUERIES.map((query) => window.matchMedia(query));
    lists.forEach((list) => list.addEventListener("change", update));
    return () => lists.forEach((list) => list.removeEventListener("change", update));
  }, []);

  return standalone;
}
