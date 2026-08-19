import type {
  AnalyticsExamRow,
  AnalyticsFilterState,
  QuestionStats,
} from "@/types/analytics/analytics-v2";

/** Format tanggal YYYY-MM-DD (lokal). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIsoDate(d);
}

export const DEFAULT_FILTERS: AnalyticsFilterState = {
  from: daysAgo(29),
  to: toIsoDate(new Date()),
  examId: null,
  studentId: null,
};

export const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: "7 hari", days: 7 },
  { label: "30 hari", days: 30 },
  { label: "90 hari", days: 90 },
  { label: "1 tahun", days: 365 },
];

/** Tanggal pendek untuk sumbu chart (mis. "12 Agu"). */
export function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
}

export function longDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

export function dateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function durasi(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const menit = Math.floor(s / 60);
  const detik = s % 60;
  if (menit === 0) return `${detik}d`;
  return `${menit}m ${String(detik).padStart(2, "0")}d`;
}

export function angka(value: number, digits = 0): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function persen(value: number): string {
  return `${angka(value, value % 1 === 0 ? 0 : 1)}%`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type Insight = {
  id: string;
  tone: "positive" | "warning" | "critical" | "neutral";
  title: string;
  description: string;
};

/** Insight deterministik dari data nyata. Kosong bila data belum cukup. */
export function buildInsights(stats: QuestionStats | undefined, exam?: AnalyticsExamRow): Insight[] {
  const list: Insight[] = [];
  const questions = (stats?.questions ?? []).filter((q) => q.attempts > 0);
  if (questions.length === 0) return list;

  const sorted = [...questions].sort((a, b) => a.accuracy - b.accuracy);
  const hardest = sorted[0];
  const easiest = sorted[sorted.length - 1];

  if (hardest) {
    list.push({
      id: "hardest",
      tone: hardest.accuracy < 50 ? "critical" : "warning",
      title: `Soal tersulit: nomor ${hardest.question_index + 1}`,
      description: `Hanya ${persen(hardest.accuracy)} siswa menjawab benar dari ${angka(hardest.attempts)} jawaban.`,
    });

    const distractor = Object.entries(hardest.distribution)
      .filter(([label]) => label !== hardest.correct_label)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    if (distractor && Number(distractor[1]) > 0) {
      list.push({
        id: "distractor",
        tone: "neutral",
        title: `Pengecoh dominan pada nomor ${hardest.question_index + 1}`,
        description: `${angka(Number(distractor[1]))} siswa memilih opsi ${distractor[0]}, sedangkan kunci jawabannya ${hardest.correct_label ?? "—"}.`,
      });
    }
  }

  if (easiest && easiest.question_id !== hardest?.question_id) {
    list.push({
      id: "easiest",
      tone: "positive",
      title: `Soal termudah: nomor ${easiest.question_index + 1}`,
      description: `${persen(easiest.accuracy)} siswa menjawab benar.`,
    });
  }

  const skipped = [...questions].sort((a, b) => b.skipped_count - a.skipped_count)[0];
  if (skipped && skipped.skipped_count > 0) {
    list.push({
      id: "skipped",
      tone: "warning",
      title: `Paling sering dilewati: nomor ${skipped.question_index + 1}`,
      description: `${angka(skipped.skipped_count)} jawaban dikosongkan — indikasi soal membingungkan atau waktu tidak cukup.`,
    });
  }

  const weak = questions.filter((q) => q.accuracy < 60).length;
  if (weak > 0) {
    list.push({
      id: "weak-count",
      tone: weak > questions.length / 2 ? "critical" : "warning",
      title: `${weak} dari ${questions.length} soal di bawah 60% benar`,
      description: exam
        ? `Materi pada set "${exam.exam_title}" perlu diulang bersama siswa.`
        : "Materi terkait perlu diulang bersama siswa.",
    });
  }

  return list;
}
