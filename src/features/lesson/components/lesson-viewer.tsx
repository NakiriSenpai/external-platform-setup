import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import { lessonCategoryLabel } from "@/features/lesson/lesson.constants";
import { useLessonProgressSaver } from "@/features/lesson/hooks/use-lesson-progress-saver";
import { useAuth } from "@/hooks/auth";
import {
  useCompleteLesson,
  useLesson,
  useLessonBlocks,
  useLessonProgress,
  useLessonQuestions,
  useLessonSections,
  useStartLesson,
} from "@/hooks/lesson";

import { CategoryTile, ToneBar } from "@/features/materi/components/materi-primitives";
import { categoryMeta } from "@/features/materi/materi.constants";
import { cn } from "@/lib/utils";

import { LessonBlockRenderer } from "./lesson-block-renderer";
import { LessonPractice } from "./lesson-practice";

/**
 * Lesson Viewer (Sprint 17).
 *
 * Materi dibaca per bagian (section) mengikuti struktur Lesson Studio.
 * SEMUA role memiliki personal progress; penyimpanan dilakukan di latar
 * belakang (debounce + retry terbatas) sehingga navigasi tidak pernah macet.
 */
export function LessonViewer({ lessonId, onBack }: { lessonId: string; onBack: () => void }) {
  const { isAuthenticated, profile } = useAuth();
  const canLearn = isAuthenticated && Boolean(profile);

  const lessonQuery = useLesson(lessonId);
  const sectionsQuery = useLessonSections(lessonId);
  const blocksQuery = useLessonBlocks(lessonId);
  const questionsQuery = useLessonQuestions(lessonId);
  const progressQuery = useLessonProgress(lessonId);

  const startLesson = useStartLesson();
  const completeLesson = useCompleteLesson();
  const startLessonMutate = startLesson.mutate;
  const resetStartLesson = startLesson.reset;
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [resumed, setResumed] = useState(false);
  const startedRef = useRef<string | null>(null);
  const markedRef = useRef<Set<string>>(new Set());
  const topRef = useRef<HTMLDivElement>(null);

  const saver = useLessonProgressSaver(lessonId, {
    enabled: canLearn && startLesson.isSuccess,
    onSaved: () => {
      void queryClient.invalidateQueries({ queryKey: ["lesson-progress", lessonId] });
      void queryClient.invalidateQueries({ queryKey: ["lessons-with-progress"] });
      void queryClient.invalidateQueries({ queryKey: ["student-lesson-progress"] });
      void queryClient.invalidateQueries({ queryKey: ["student-category-progress"] });
    },
  });

  const lesson = lessonQuery.data;
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const blocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data]);
  const questions = questionsQuery.data ?? [];
  const progress = progressQuery.data ?? null;

  const category = lesson?.category ?? "umum";
  const currentSection = sections[step];
  const sectionBlocks = useMemo(
    () => (currentSection ? blocks.filter((b) => b.section_id === currentSection.id) : []),
    [blocks, currentSection],
  );
  const sectionQuestions = currentSection
    ? questions.filter((q) => q.section_id === currentSection.id)
    : [];

  const isLast = sections.length > 0 && step >= sections.length - 1;
  const completed = progress?.status === "completed";

  // Route parameter dapat berubah tanpa unmount. Reset seluruh state lokal agar
  // posisi, dedupe, dan start mutation lesson sebelumnya tidak bocor ke lesson baru.
  useEffect(() => {
    setStep(0);
    setResumed(false);
    startedRef.current = null;
    markedRef.current.clear();
    resetStartLesson();
  }, [lessonId, resetStartLesson]);

  // Resume: posisi terakhir diambil dari database, bukan localStorage.
  useEffect(() => {
    if (resumed || !canLearn || sections.length === 0 || blocks.length === 0) return;
    if (progressQuery.isLoading) return;
    const blockId = progress?.current_block_id;
    if (blockId) {
      const block = blocks.find((b) => b.id === blockId);
      const index = block ? sections.findIndex((s) => s.id === block.section_id) : -1;
      if (index >= 0) setStep(index);
    }
    setResumed(true);
  }, [resumed, canLearn, sections, blocks, progress, progressQuery.isLoading]);

  // Membuka materi = membuat/menyegarkan progress (idempotent, sekali saja).
  useEffect(() => {
    if (!canLearn || !lesson || startedRef.current === lessonId) return;
    startedRef.current = lessonId;
    startLessonMutate(lessonId);
  }, [canLearn, lesson, lessonId, startLessonMutate]);

  // Berpindah bagian = mengantrikan block bagian tersebut (tanpa memblokir UI).
  useEffect(() => {
    if (!canLearn || !resumed || !currentSection || sectionBlocks.length === 0) return;
    if (markedRef.current.has(currentSection.id)) return;
    markedRef.current.add(currentSection.id);
    saver.queue(
      sectionBlocks.filter((b) => b.type !== "divider").map((b) => b.id),
      sectionBlocks[0]?.id ?? null,
    );
  }, [canLearn, resumed, currentSection, sectionBlocks, saver]);

  const goTo = (next: number) => {
    // Navigasi tidak pernah menunggu penyimpanan progres.
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleFinish = () => {
    if (!canLearn || completed) return onBack();

    completeLesson.mutate(lessonId, {
      onSuccess: () => {
        toast.success("Materi selesai dipelajari.", { id: "lesson-complete" });
        onBack();
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Gagal menyelesaikan materi.", {
          id: "lesson-complete",
        }),
    });
  };

  if (lessonQuery.isLoading || sectionsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (lessonQuery.isError || !lesson || lesson.status !== "published") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-foreground">Materi tidak ditemukan.</p>
        <Button variant="outline" onClick={onBack}>
          Kembali ke Materi
        </Button>
      </div>
    );
  }

  const percent = canLearn
    ? (progress?.progress_percent ?? 0)
    : sections.length > 0
      ? Math.round(((step + 1) / sections.length) * 100)
      : 0;

  const meta = categoryMeta(lesson.category);

  return (
    <article ref={topRef} className="space-y-5 pb-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 justify-self-start" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" aria-hidden /> Kembali ke Materi
        </Button>
        {completed ? (
          <Badge className="shrink-0">
            <CheckCircle2 className="mr-1 size-3.5" aria-hidden /> Selesai
          </Badge>
        ) : null}
      </div>

      <header
        className={cn(
          "space-y-3 rounded-3xl border border-border p-4 ring-1 ring-inset",
          meta.tone.soft,
          meta.tone.ring,
        )}
      >
        {lesson.thumbnail_url ? (
          <img
            src={lesson.thumbnail_url}
            alt={`Sampul ${lesson.title}`}
            loading="lazy"
            className="max-h-56 w-full rounded-2xl object-cover"
          />
        ) : null}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <CategoryTile meta={meta} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-xs font-semibold uppercase tracking-wide",
                meta.tone.text,
              )}
            >
              {lessonCategoryLabel(lesson.category)}
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground">{lesson.title}</h1>
          </div>
        </div>
        {lesson.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{lesson.description}</p>
        ) : null}
        <Badge variant="outline">{EXAM_DIFFICULTY_LABELS[lesson.difficulty]}</Badge>
      </header>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Materi ini belum memiliki konten.
        </p>
      ) : (
        <>
          <section className="space-y-4 border-t border-border pt-5">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Bagian {step + 1} dari {sections.length}
              </p>
              <h2 className="text-lg font-semibold leading-snug text-foreground">
                {currentSection?.title}
              </h2>
              {currentSection?.description ? (
                <p className="text-sm text-muted-foreground">{currentSection.description}</p>
              ) : null}
            </div>

            {blocksQuery.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : (
              <div className="space-y-4">
                {sectionBlocks.map((block) => (
                  <LessonBlockRenderer key={block.id} block={block} category={category} />
                ))}
              </div>
            )}

            <LessonPractice questions={sectionQuestions} />
          </section>

          <footer className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progres materi</span>
                <span>{percent}% selesai</span>
              </div>
              <ToneBar value={percent} bar={meta.tone.bar} />
              {canLearn &&
              (startLesson.isPending || startLesson.isError || saver.status !== "idle") ? (
                <p
                  aria-live="polite"
                  className={cn(
                    "text-xs",
                    startLesson.isError || saver.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {startLesson.isPending || saver.status === "saving"
                    ? "Menyimpan progres..."
                    : null}
                  {!startLesson.isPending && !startLesson.isError && saver.status === "saved"
                    ? "Progres tersimpan"
                    : null}
                  {startLesson.isError ? (
                    <>
                      Progress gagal dibuat.{" "}
                      <button
                        type="button"
                        onClick={() => startLessonMutate(lessonId)}
                        className="underline underline-offset-2"
                      >
                        Coba lagi
                      </button>
                    </>
                  ) : saver.status === "error" ? (
                    <>
                      Progres gagal disimpan.{" "}
                      <button
                        type="button"
                        onClick={saver.retry}
                        className="underline underline-offset-2"
                      >
                        Coba lagi
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={step === 0}
                onClick={() => goTo(step - 1)}
              >
                <ArrowLeft className="mr-1 size-4" aria-hidden /> Sebelumnya
              </Button>
              {isLast ? (
                <Button
                  className="min-h-11"
                  disabled={completeLesson.isPending}
                  onClick={handleFinish}
                >
                  {completeLesson.isPending ? (
                    <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                  ) : (
                    <BookOpenCheck className="mr-1 size-4" aria-hidden />
                  )}
                  {completed ? "Kembali ke Materi" : "Selesaikan Materi"}
                </Button>
              ) : (
                <Button className="min-h-11" onClick={() => goTo(step + 1)}>
                  Berikutnya <ArrowRight className="ml-1 size-4" aria-hidden />
                </Button>
              )}
            </div>

            {completed ? (
              <p className="text-center text-xs text-muted-foreground">
                Anda sudah menyelesaikan materi ini. Silakan pelajari lagi kapan saja.
              </p>
            ) : null}
          </footer>
        </>
      )}
    </article>
  );
}
