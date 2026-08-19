import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { lessonCategoryLabel } from "@/features/lesson/lesson.constants";
import { useLessonsWithProgress, useStudentCategoryProgress } from "@/hooks/lesson";

/** Ringkasan belajar siswa: lanjutkan materi, progres kategori, materi selesai. */
export function StudentLessonProgressPanel() {
  const navigate = useNavigate();
  const lessonsQuery = useLessonsWithProgress();
  const categoryQuery = useStudentCategoryProgress();

  if (lessonsQuery.isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  const lessons = lessonsQuery.data ?? [];
  const inProgress = lessons
    .filter((l) => l.progress?.status === "in_progress")
    .sort((a, b) =>
      (b.progress?.last_activity_at ?? "").localeCompare(a.progress?.last_activity_at ?? ""),
    );
  const completed = lessons.filter((l) => l.progress?.status === "completed");
  const categories = categoryQuery.data ?? [];

  const open = (lessonId: string) =>
    void navigate({ to: "/materi/lesson/$lessonId", params: { lessonId } });

  if (lessons.length === 0) return null;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Lanjutkan Belajar</h2>
        {inProgress.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
              <p>Belum ada materi yang sedang dipelajari.</p>
              <Button size="sm" onClick={() => void navigate({ to: "/materi" })}>
                Jelajahi Materi
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {inProgress.slice(0, 3).map((lesson) => (
              <li key={lesson.id}>
                <Card>
                  <CardContent className="space-y-2.5 p-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {lessonCategoryLabel(lesson.category)}
                      </p>
                      <p className="truncate text-sm font-medium text-foreground">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.progress?.progress_percent ?? 0}% selesai
                      </p>
                    </div>
                    <Progress value={lesson.progress?.progress_percent ?? 0} className="h-1.5" />
                    <Button size="sm" className="min-h-10 w-full" onClick={() => open(lesson.id)}>
                      <PlayCircle className="mr-2 size-4" aria-hidden /> Lanjutkan
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {categories.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Progres Materi</h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              {categories.map((row) => (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{lessonCategoryLabel(row.category)}</span>
                    <span className="text-muted-foreground">{row.average_progress}%</span>
                  </div>
                  <Progress value={row.average_progress} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {completed.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Materi Selesai</h2>
          <ul className="space-y-2">
            {completed.slice(0, 3).map((lesson) => (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() => open(lesson.id)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{lesson.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lessonCategoryLabel(lesson.category)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
