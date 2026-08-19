import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useExamDetailAnalytics } from "@/hooks/analytics";
import type { AnalyticsRange } from "@/types/analytics";

import { MetricBar, StatCard } from "./analytics-primitives";
import { formatDurasiDetik } from "../utils";

/** Detail analitik satu ujian: ringkasan, performa soal, soal sulit, grammar. */
export function ExamDetailDialog({
  examId,
  range,
  onOpenChange,
}: {
  examId: string | null;
  range: AnalyticsRange;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useExamDetailAnalytics(examId, {
    range,
  });

  const summary = data?.summary;
  const questions = data?.questions ?? [];
  const grammar = data?.grammar ?? [];
  const weakest = [...questions].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

  return (
    <Dialog open={Boolean(examId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-left">{summary?.exam_title ?? "Detail Ujian"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Gagal memuat detail ujian.</p>
            <Button onClick={() => void refetch()} disabled={isFetching}>
              Coba lagi
            </Button>
          </div>
        ) : !summary || summary.attempts === 0 ? (
          <div className="space-y-1 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Belum ada data ujian</p>
            <p className="text-sm text-muted-foreground">
              Analytics akan muncul setelah siswa menyelesaikan ujian.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Percobaan" value={String(summary.attempts)} />
              <StatCard label="Siswa" value={String(summary.students)} />
              <StatCard label="Rata-rata" value={String(summary.average_score)} />
              <StatCard label="Kelulusan" value={`${summary.pass_rate}%`} />
            </div>
            <p className="text-xs text-muted-foreground">
              Rata-rata waktu: {formatDurasiDetik(summary.average_duration_seconds)}
            </p>

            {weakest.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Materi/Soal yang perlu diperhatikan
                </h3>
                <ol className="space-y-2">
                  {weakest.map((q) => (
                    <li key={q.question_id} className="rounded-lg border border-border p-3">
                      <p className="line-clamp-2 text-sm text-foreground">
                        Soal {q.question_index + 1} — {q.question_text}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {q.accuracy}% benar dari {q.attempts} jawaban
                        {q.lesson_title ? ` · Materi: ${q.lesson_title}` : ""}
                      </p>
                      {q.grammar_tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {q.grammar_tags.map((t) => (
                            <Badge key={t.id} variant="secondary">
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Performa Soal</h3>
              {questions.map((q) => (
                <div key={q.question_id} className="space-y-1">
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    Soal {q.question_index + 1} — {q.question_text}
                  </p>
                  <MetricBar
                    label={`Benar (${q.correct_count}/${q.attempts})`}
                    value={q.accuracy}
                  />
                </div>
              ))}
            </section>

            {grammar.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Grammar Performance</h3>
                {grammar.map((g) => (
                  <MetricBar key={g.tag_id} label={g.tag_name} value={g.accuracy} />
                ))}
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
