import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { lessonCategoryLabel } from "@/features/lesson/lesson.constants";
import { useLessonAnalytics, useLessonAnalyticsOverview } from "@/hooks/lesson";
import type { AnalyticsRange } from "@/types/analytics";

import { StatCard } from "./analytics-primitives";

/**
 * Analitik materi (Sprint 16).
 * Definisi metric: completion rate = selesai / mulai (bukan selesai / total siswa).
 */
export function LessonAnalyticsSection({ range }: { range: AnalyticsRange }) {
  const overviewQuery = useLessonAnalyticsOverview({ range });
  const lessonsQuery = useLessonAnalytics({ range });

  const overview = overviewQuery.data;
  const rows = lessonsQuery.data ?? [];

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Analitik Materi</h2>
        <p className="text-xs text-muted-foreground">
          Completion rate dihitung dari siswa yang menyelesaikan dibagi siswa yang memulai materi.
        </p>
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">Gagal memuat analitik materi.</p>
            <Button size="sm" onClick={() => void overviewQuery.refetch()}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Materi Terbit" value={String(overview?.total_lessons ?? 0)} />
          <StatCard label="Siswa Aktif" value={String(overview?.active_learners ?? 0)} />
          <StatCard label="Materi Dimulai" value={String(overview?.started ?? 0)} />
          <StatCard label="Sedang Dipelajari" value={String(overview?.in_progress ?? 0)} />
          <StatCard label="Diselesaikan" value={String(overview?.completed ?? 0)} />
          <StatCard
            label="Completion Rate"
            value={`${overview?.completion_rate ?? 0}%`}
            hint={`Rata-rata progres ${overview?.average_progress ?? 0}%`}
          />
        </div>
      )}

      {lessonsQuery.isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <BookOpen className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">Belum ada aktivitas materi</p>
            <p className="text-sm text-muted-foreground">
              Data muncul setelah siswa membuka materi yang sudah dipublikasikan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.lesson_id}
              className="space-y-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.lesson_title}</p>
                <p className="text-xs text-muted-foreground">
                  {lessonCategoryLabel(row.category)} · {row.started} mulai · {row.completed}{" "}
                  selesai · completion {row.completion_rate}%
                </p>
              </div>
              <Progress value={row.average_progress} className="h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
