/** Katalog feature flag aplikasi (satu sumber kebenaran untuk UI Owner). */
export const FEATURE_FLAGS = [
  {
    key: "exam_engine",
    name: "Ujian",
    description: "Akses menu dan pengerjaan ujian untuk pengguna.",
  },
  {
    key: "lesson",
    name: "Materi",
    description: "Akses daftar dan pembacaan materi pembelajaran.",
  },
  {
    key: "leaderboard",
    name: "Peringkat",
    description: "Papan peringkat siswa.",
  },
  {
    key: "teacher_analytics",
    name: "Analitik Pengajar",
    description: "Dashboard analitik untuk guru dan admin.",
  },
  {
    key: "content_io",
    name: "Import / Export Konten",
    description: "Impor dan ekspor bundle konten JSON.",
  },
  {
    key: "media_upload",
    name: "Unggah Media",
    description: "Unggah gambar dan audio terpusat.",
  },
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]["key"];

/** Nilai default: seluruh fitur aktif agar aplikasi existing tidak berubah. */
export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = FEATURE_FLAGS.reduce(
  (acc, flag) => ({ ...acc, [flag.key]: true }),
  {} as Record<FeatureFlagKey, boolean>,
);
