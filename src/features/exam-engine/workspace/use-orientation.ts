import { useEffect, useState } from "react";

/**
 * ORIENTATION POLICY (final, single-TWA).
 *
 * - Orientasi FISIK dikunci PORTRAIT di level aplikasi (AndroidManifest TWA +
 *   web app manifest `"orientation": "portrait"`). Tidak ada API web yang
 *   dipakai untuk mengunci/melepas rotasi: tidak ada `screen.orientation.lock`,
 *   tidak ada `requestFullscreen`, tidak ada `deviceorientation`.
 * - EXAM WORKSPACE (/ujian/:attemptId) hanya memiliki LAYOUT responsif
 *   (portrait/landscape) yang dipilih dari lebar viewport nyata. Ini murni UI,
 *   tidak memaksa rotasi perangkat.
 *
 * Catatan: rotasi fisik per-route TIDAK didukung oleh arsitektur single TWA
 * dengan API resmi.
 */

export type ExamLayout = "portrait" | "landscape";

/**
 * Layout Exam berbasis viewport — hanya dipakai oleh Exam Workspace.
 *
 * Satu listener `matchMedia`; state hanya berubah saat media query benar-benar
 * berpindah (portrait ⇄ landscape). Tidak ada polling atau event sensor.
 */
export function useExamSensorLayout(): ExamLayout {
  const [layout, setLayout] = useState<ExamLayout>("portrait");

  useEffect(() => {
    const query = window.matchMedia("(orientation: landscape)");
    setLayout(query.matches ? "landscape" : "portrait");

    const onChange = (event: MediaQueryListEvent) =>
      setLayout(event.matches ? "landscape" : "portrait");
    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  return layout;
}
