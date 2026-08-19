import type { AnswerLabel, ExamDifficulty, ExamSectionType, ExamStatus } from "@/types/exam";

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const EXAM_DIFFICULTY_LABELS: Record<ExamDifficulty, string> = {
  mudah: "Mudah",
  sedang: "Sedang",
  sulit: "Sulit",
};

export const EXAM_SECTION_LABELS: Record<ExamSectionType, string> = {
  reading: "Reading",
  listening: "Listening",
};

export const ANSWER_LABELS: AnswerLabel[] = ["A", "B", "C", "D"];

/** Kategori bawaan Exam (dapat diperluas di sprint berikutnya). */
export const EXAM_CATEGORIES = [
  "umum",
  "jlpt-n5",
  "jlpt-n4",
  "jlpt-n3",
  "grammar",
  "kosakata",
  "kanji",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  umum: "Umum",
  "jlpt-n5": "JLPT N5",
  "jlpt-n4": "JLPT N4",
  "jlpt-n3": "JLPT N3",
  grammar: "Grammar",
  kosakata: "Kosakata",
  kanji: "Kanji",
};

/** Tag grammar bawaan untuk pembahasan soal. */
export const GRAMMAR_TAGS = [
  "partikel",
  "kata-kerja",
  "kata-sifat",
  "bentuk-te",
  "bentuk-ta",
  "keigo",
  "pola-kalimat",
  "kosakata",
  "kanji",
  "listening",
] as const;

/** Nilai total ujian selalu 100 dan tidak dapat diisi manual. */
export const EXAM_TOTAL_SCORE = 100;

/** Poin per soal dihitung otomatis: 100 dibagi jumlah soal. */
export function pointsPerQuestion(questionCount: number): number {
  if (questionCount <= 0) return 0;
  return EXAM_TOTAL_SCORE / questionCount;
}

/** Format poin per soal agar mudah dibaca (mis. 2.5 atau 3.333). */
export function formatPoints(value: number): string {
  if (value <= 0) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded).replace(".", ",");
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
