/**
 * Konfigurasi rilis APK Android I:UM 이음 — satu-satunya sumber informasi rilis.
 * Selama `apkUrl` masih null, halaman /download menampilkan status APK_UNAVAILABLE
 * dan tombol download dinonaktifkan (tidak boleh memakai URL palsu).
 */
export type ApkAvailability = "APK_AVAILABLE" | "APK_UNAVAILABLE";

export type AppRelease = {
  version: string;
  versionCode: number;
  /** URL APK production. `null` selama APK belum diunggah ke hosting. */
  apkUrl: string | null;
  /** Ukuran file APK sebenarnya, mis. "24.6 MB". `null` bila belum diketahui. */
  fileSize: string | null;
  /** Tanggal rilis ISO (YYYY-MM-DD). `null` bila belum dirilis. */
  releaseDate: string | null;
  fileName: string;
};

export const appRelease: AppRelease = {
  version: "1.0.0",
  versionCode: 1,
  apkUrl: null,
  fileSize: null,
  releaseDate: null,
  fileName: "ium.apk",
};

export function apkAvailability(release: AppRelease = appRelease): ApkAvailability {
  return release.apkUrl ? "APK_AVAILABLE" : "APK_UNAVAILABLE";
}

export function formatReleaseDate(value: string | null): string {
  if (!value) return "Belum dirilis";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
