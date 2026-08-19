import { useCallback, useEffect, useState } from "react";

/**
 * Proteksi foreground khusus halaman Tes Buta Warna.
 *
 * Mengikuti mekanisme lifecycle yang sudah dipakai Exam Runner
 * (visibilitychange / pagehide / freeze / blur), namun TANPA counter
 * violation dan TANPA auto-submit: keluar aplikasi hanya memunculkan
 * overlay protektif sampai user menekan "Lanjutkan Tes".
 *
 * Listener dipasang hanya selama komponen Color Test hidup, sehingga
 * tidak pernah menjadi global listener dan tidak mengganggu uploader
 * (Android Storage) di halaman lain.
 */
export function useColorTestForeground(enabled: boolean) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const pause = () => setPaused(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    const onHidden = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") return;
      setPaused(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("freeze", onHidden);
    window.addEventListener("pagehide", onHidden);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("freeze", onHidden);
      window.removeEventListener("pagehide", onHidden);
      window.removeEventListener("blur", pause);
    };
  }, [enabled]);

  const resume = useCallback(() => setPaused(false), []);

  return { paused, resume };
}
