import {
  Bookmark,
  Headphones,
  Landmark,
  ListTree,
  MessagesSquare,
  Type,
  type LucideIcon,
} from "lucide-react";

import { LESSON_CATEGORIES } from "@/features/lesson/lesson.constants";

/**
 * Sprint 16 — Taksonomi visual kategori materi.
 * Slug kategori = identifier database (LESSON_CATEGORIES). Tidak ada taksonomi kedua.
 */
export type CategoryTone = {
  /** Tile ikon (gradien solid sesuai warna kategori). */
  tile: string;
  /** Teks beraksen kategori. */
  text: string;
  /** Isi progress bar. */
  bar: string;
  /** Border/ring lembut. */
  ring: string;
  /** Latar lembut. */
  soft: string;
};

export type CategoryMeta = {
  slug: string;
  label: string;
  subtitle: string;
  listDescription: string;
  searchPlaceholder: string;
  icon: LucideIcon;
  tone: CategoryTone;
};

/** Kelas Tailwind ditulis literal agar tidak hilang saat build. */
const TONES: Record<string, CategoryTone> = {
  "cat-grammar": {
    tile: "bg-gradient-to-br from-cat-grammar to-cat-grammar/70 text-background",
    text: "text-cat-grammar",
    bar: "bg-cat-grammar",
    ring: "ring-cat-grammar/25",
    soft: "bg-cat-grammar/12",
  },
  "cat-vocab": {
    tile: "bg-gradient-to-br from-cat-vocab to-cat-vocab/70 text-background",
    text: "text-cat-vocab",
    bar: "bg-cat-vocab",
    ring: "ring-cat-vocab/25",
    soft: "bg-cat-vocab/12",
  },
  "cat-culture": {
    tile: "bg-gradient-to-br from-cat-culture to-cat-culture/70 text-background",
    text: "text-cat-culture",
    bar: "bg-cat-culture",
    ring: "ring-cat-culture/25",
    soft: "bg-cat-culture/12",
  },
  "cat-conversation": {
    tile: "bg-gradient-to-br from-cat-conversation to-cat-conversation/70 text-background",
    text: "text-cat-conversation",
    bar: "bg-cat-conversation",
    ring: "ring-cat-conversation/25",
    soft: "bg-cat-conversation/12",
  },
  "cat-listening": {
    tile: "bg-gradient-to-br from-cat-listening to-cat-listening/70 text-background",
    text: "text-cat-listening",
    bar: "bg-cat-listening",
    ring: "ring-cat-listening/25",
    soft: "bg-cat-listening/12",
  },
  "cat-bookmark": {
    tile: "bg-gradient-to-br from-cat-bookmark to-cat-bookmark/70 text-background",
    text: "text-cat-bookmark",
    bar: "bg-cat-bookmark",
    ring: "ring-cat-bookmark/25",
    soft: "bg-cat-bookmark/12",
  },
  primary: {
    tile: "bg-gradient-to-br from-primary to-primary/70 text-background",
    text: "text-primary",
    bar: "bg-primary",
    ring: "ring-primary/25",
    soft: "bg-primary/12",
  },
};

function tone(color: string): CategoryTone {
  return TONES[color] ?? TONES["primary"]!;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  "tata-bahasa": {
    slug: "tata-bahasa",
    label: "Tatabahasa",
    subtitle: "Pola kalimat dan aturan bahasa Korea",
    listDescription: "Pola kalimat & rumus",
    searchPlaceholder: "Cari tata bahasa",
    icon: ListTree,
    tone: tone("cat-grammar"),
  },
  kosakata: {
    slug: "kosakata",
    label: "Kosakata",
    subtitle: "Perbendaharaan kata untuk kebutuhan harian",
    listDescription: "Kosakata harian",
    searchPlaceholder: "Cari kosakata",
    icon: Type,
    tone: tone("cat-vocab"),
  },
  budaya: {
    slug: "budaya",
    label: "Budaya",
    subtitle: "Budaya kerja dan etika di Korea",
    listDescription: "Budaya & etika",
    searchPlaceholder: "Cari budaya",
    icon: Landmark,
    tone: tone("cat-culture"),
  },
  conversation: {
    slug: "conversation",
    label: "Percakapan",
    subtitle: "Dialog dan ungkapan sehari-hari",
    listDescription: "Dialog sehari-hari",
    searchPlaceholder: "Cari percakapan",
    icon: MessagesSquare,
    tone: tone("cat-conversation"),
  },
  listening: {
    slug: "listening",
    label: "Listening",
    subtitle: "Latihan menyimak beserta transkrip",
    listDescription: "Audio & transkrip",
    searchPlaceholder: "Cari listening",
    icon: Headphones,
    tone: tone("cat-listening"),
  },
};

export const BOOKMARK_META: CategoryMeta = {
  slug: "bookmark",
  label: "Bookmark",
  subtitle: "Materi yang Anda simpan",
  listDescription: "Materi tersimpan",
  searchPlaceholder: "Cari materi tersimpan",
  icon: Bookmark,
  tone: tone("cat-bookmark"),
};

const FALLBACK: CategoryMeta = {
  slug: "umum",
  label: "Materi",
  subtitle: "Materi pembelajaran",
  listDescription: "Materi lainnya",
  searchPlaceholder: "Cari materi",
  icon: ListTree,
  tone: tone("primary"),
};

export const CATEGORY_ORDER: string[] = [...LESSON_CATEGORIES];

export function categoryMeta(slug: string): CategoryMeta {
  if (slug === BOOKMARK_META.slug) return BOOKMARK_META;
  return CATEGORY_META[slug] ?? { ...FALLBACK, slug, label: slug };
}
