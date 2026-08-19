import type { LessonBlockType, LessonStatus } from "@/types/lesson";

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const LESSON_BLOCK_LABELS: Record<LessonBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  bullet_list: "Bullet List",
  image: "Image",
  audio: "Audio",
  callout: "Callout",
  divider: "Divider",
  grammar_highlight: "Grammar Highlight",
};

export const LESSON_BLOCK_TYPES: LessonBlockType[] = [
  "heading",
  "paragraph",
  "bullet_list",
  "image",
  "audio",
  "callout",
  "divider",
  "grammar_highlight",
];

/** Block yang memerlukan teks isi. */
export const BLOCK_NEEDS_TEXT: LessonBlockType[] = [
  "heading",
  "paragraph",
  "callout",
  "grammar_highlight",
];

export function blockPreview(type: LessonBlockType, content: string | null, items: string[]) {
  if (type === "divider") return "———";
  if (type === "bullet_list") return items.join(" · ") || "(daftar kosong)";
  return content?.trim() || "(kosong)";
}

// ---------- SPRINT 16: TAKSONOMI KATEGORI MATERI ----------
// Satu-satunya taksonomi kategori Lesson (dipakai Lesson Studio & /materi).

export const LESSON_CATEGORIES = [
  "tata-bahasa",
  "kosakata",
  "budaya",
  "listening",
  "conversation",
] as const;

export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export const LESSON_CATEGORY_LABELS: Record<string, string> = {
  "tata-bahasa": "Tata Bahasa",
  kosakata: "Kosakata",
  budaya: "Budaya & Informasi",
  listening: "Listening",
  conversation: "Conversation",
};

/** Label kategori dengan fallback untuk lesson lama. */
export function lessonCategoryLabel(category: string): string {
  return LESSON_CATEGORY_LABELS[category] ?? category;
}

export const LESSON_PROGRESS_LABELS = {
  not_started: "Belum dimulai",
  in_progress: "Sedang dipelajari",
  completed: "Selesai",
} as const;
