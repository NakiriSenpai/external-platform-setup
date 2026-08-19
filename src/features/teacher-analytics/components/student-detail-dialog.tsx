import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { lessonCategoryLabel } from "@/features/lesson/lesson.constants";
import { useStudentDetail } from "@/hooks/analytics";
import { useStudentLessonAnalytics } from "@/hooks/lesson";
import type { AnalyticsRange } from "@/types/analytics";

import { RankAvatar } from "@/features/leaderboard/components/rank-avatar";
import { MetricBar, StatCard } from "./analytics-primitives";
import { formatDurasiDetik, formatTanggal } from "../utils";

/** Detail analitik satu siswa. */
export function StudentDetailDialog({
  studentId,
  range,
  onOpenChange,
}: {
  studentId: string | null;
  range: AnalyticsRange;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useStudentDetail(studentId, { range });
  const lessonQuery = useStudentLessonAnalytics(studentId, { range });

  const profile = data?.profile;
  const summary = data?.summary;
  const lessonProgress = lessonQuery.data ?? [];

  return (
    <Dialog open={Boolean(studentId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-left">{profile?.display_name ?? "Detail Siswa"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Gagal memuat detail siswa.</p>
            <Button onClick={() => void refetch()} disabled={isFetching}>
              Coba lagi
            </Button>
          </div>
        ) : !profile || !summary ? null : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <RankAvatar
                row={{ display_name: profile.display_name, avatar_url: profile.avatar_url }}
                className="size-12"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {profile.display_name}
                </p>
                {profile.username ? (
                  <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Total Ujian" value={String(summary.total_attempts)} />
              <StatCard label="Rata-rata" value={String(summary.average_score)} />
              <StatCard label="Kelulusan" value={`${summary.pass_rate}%`} />
              <StatCard
                label="Rata-rata Waktu"
                value={formatDurasiDetik(summary.average_duration_seconds)}
              />
            </div>

            {summary.total_attempts === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Siswa ini belum menyelesaikan ujian pada periode terpilih.
              </p>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Performa per Ujian</h3>
                  {(data?.exam_performance ?? []).map((e) => (
                    <div key={e.exam_id} className="space-y-1">
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {e.exam_title} · {e.attempts} percobaan
                      </p>
                      <MetricBar label="Rata-rata nilai" value={e.average_score} suffix="" />
                    </div>
                  ))}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Riwayat Terakhir</h3>
                  <ul className="space-y-2">
                    {(data?.recent_attempts ?? []).map((a) => (
                      <li
                        key={a.attempt_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{a.exam_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTanggal(a.submitted_at)} · {a.correct_count}/{a.total_questions}{" "}
                            benar
                          </p>
                        </div>
                        <Badge variant={a.passed ? "default" : "secondary"}>{a.score}</Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Progres Materi</h3>
              {lessonQuery.isLoading ? (
                <Skeleton className="h-20 w-full rounded-lg" />
              ) : lessonProgress.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Siswa ini belum membuka materi pada periode terpilih.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lessonProgress.map((row) => (
                    <li key={row.lesson_id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-foreground">{row.lesson_title}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {lessonCategoryLabel(row.category)} · {row.progress_percent}%
                        </span>
                      </div>
                      <Progress value={row.progress_percent} className="h-1.5" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
