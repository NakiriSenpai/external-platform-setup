import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import {
  BookmarkButton,
  CategoryTile,
  DIFFICULTY_TONE,
  FilterChip,
  ToneBar,
} from "@/features/materi/components/materi-primitives";
import { BOOKMARK_META, categoryMeta } from "@/features/materi/materi.constants";
import { useAuth } from "@/hooks/auth";
import {
  useLessonBookmarks,
  useLessonsWithProgress,
  useToggleLessonBookmark,
} from "@/hooks/lesson";
import { cn } from "@/lib/utils";
import type { ExamDifficulty } from "@/types/exam";

const LEVELS: Array<{ value: "semua" | ExamDifficulty; label: string }> = [
  { value: "semua", label: "Semua Level" },
  { value: "mudah", label: "Mudah" },
  { value: "sedang", label: "Sedang" },
  { value: "sulit", label: "Sulit" },
];

const STATUSES: Array<{ value: "semua" | "belum" | "selesai"; label: string }> = [
  { value: "semua", label: "Semua" },
  { value: "belum", label: "Belum selesai" },
  { value: "selesai", label: "Selesai" },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Halaman kategori materi (referensi Gambar 2). */
export function MateriCategory({
  category,
  onBack,
  onOpen,
}: {
  category: string;
  onBack: () => void;
  onOpen: (lessonId: string) => void;
}) {
  const { profile } = useAuth();
  const isStudent = profile?.role === "siswa";
  const isBookmarkView = category === BOOKMARK_META.slug;
  const meta = categoryMeta(category);

  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"semua" | ExamDifficulty>("semua");
  const [status, setStatus] = useState<"semua" | "belum" | "selesai">("semua");

  const { data, isLoading, isError, refetch } = useLessonsWithProgress();
  const bookmarksQuery = useLessonBookmarks();
  const toggleBookmark = useToggleLessonBookmark();
  const bookmarks = useMemo(() => new Set(bookmarksQuery.data ?? []), [bookmarksQuery.data]);

  const scoped = useMemo(() => {
    const rows = data ?? [];
    return isBookmarkView
      ? rows.filter((l) => bookmarks.has(l.id))
      : rows.filter((l) => l.category === category);
  }, [data, category, isBookmarkView, bookmarks]);

  const stats = useMemo(() => {
    const total = scoped.length;
    const completed = scoped.filter((l) => l.progress?.status === "completed").length;
    return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
  }, [scoped]);

  const lessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((lesson) => {
      if (q && !`${lesson.title} ${lesson.description ?? ""}`.toLowerCase().includes(q))
        return false;
      if (level !== "semua" && lesson.difficulty !== level) return false;
      if (status === "selesai" && lesson.progress?.status !== "completed") return false;
      if (status === "belum" && lesson.progress?.status === "completed") return false;
      return true;
    });
  }, [scoped, query, level, status]);

  const handleBookmark = (lessonId: string, next: boolean) => {
    toggleBookmark.mutate(
      { lessonId, bookmarked: next },
      {
        onSuccess: () => toast.success(next ? "Materi disimpan." : "Bookmark dihapus."),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Gagal menyimpan bookmark."),
      },
    );
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary/40 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <div className="min-w-0" />
      </div>

      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <CategoryTile meta={meta} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground">{meta.label}</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">{meta.subtitle}</p>
        </div>
      </header>

      {isStudent ? (
        <section
          aria-label={`Progres ${meta.label}`}
          className={cn(
            "space-y-3 rounded-3xl border border-border p-4 ring-1 ring-inset",
            meta.tone.soft,
            meta.tone.ring,
          )}
        >
          <p className="text-sm font-semibold text-foreground">Progress {meta.label}</p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <ToneBar value={stats.percent} bar={meta.tone.bar} />
            <p className={cn("shrink-0 text-xs font-semibold", meta.tone.text)}>
              {pad(stats.completed)}/{pad(stats.total)} • {stats.percent}%
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={meta.searchPlaceholder}
            aria-label={meta.searchPlaceholder}
            className="h-11 rounded-full pl-9"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {LEVELS.map((item) => (
            <FilterChip
              key={item.value}
              active={level === item.value}
              tone={item.value === "semua" ? undefined : DIFFICULTY_TONE[item.value].chip}
              onClick={() => setLevel(item.value)}
            >
              {item.label}
            </FilterChip>
          ))}
        </div>
        {isStudent ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {STATUSES.map((item) => (
              <FilterChip
                key={item.value}
                active={status === item.value}
                onClick={() => setStatus(item.value)}
              >
                {item.label}
              </FilterChip>
            ))}
          </div>
        ) : null}
      </section>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-sm text-foreground">Materi tidak dapat dimuat.</p>
            <Button onClick={() => void refetch()}>Coba lagi</Button>
          </CardContent>
        </Card>
      ) : lessons.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {isBookmarkView
              ? "Belum ada materi yang Anda simpan."
              : "Belum ada materi pada filter ini."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson) => {
            const lessonMeta = categoryMeta(lesson.category);
            const progress = lesson.progress;
            const done = progress?.status === "completed";
            return (
              <li key={lesson.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(lesson.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(lesson.id);
                    }
                  }}
                  className={cn(
                    "cursor-pointer space-y-3 rounded-2xl border border-border bg-card p-4 ring-1 ring-inset transition-colors hover:border-primary/50",
                    lessonMeta.tone.ring,
                  )}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                    <CategoryTile meta={lessonMeta} size="sm" />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {lesson.title}
                      </p>
                      {lesson.description ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {lesson.description}
                        </p>
                      ) : null}
                    </div>
                    {isStudent ? (
                      <BookmarkButton
                        active={bookmarks.has(lesson.id)}
                        disabled={toggleBookmark.isPending}
                        label={lesson.title}
                        onToggle={() => handleBookmark(lesson.id, !bookmarks.has(lesson.id))}
                      />
                    ) : null}
                  </div>

                  {isStudent && progress && !done ? (
                    <ToneBar value={progress.progress_percent} bar={lessonMeta.tone.bar} />
                  ) : null}

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-3">
                    <span
                      className={cn(
                        "w-fit truncate rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        DIFFICULTY_TONE[lesson.difficulty].badge,
                      )}
                    >
                      {EXAM_DIFFICULTY_LABELS[lesson.difficulty]}
                    </span>
                    {isStudent ? (
                      done ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-success">
                          <CheckCircle2 className="size-3.5" aria-hidden /> Selesai
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <Circle className="size-3.5" aria-hidden />
                          {progress ? `${progress.progress_percent}% berjalan` : "Belum selesai"}
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
