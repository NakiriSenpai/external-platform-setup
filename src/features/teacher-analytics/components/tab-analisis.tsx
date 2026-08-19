import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lightbulb } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuestionStats } from "@/hooks/analytics";
import { cn } from "@/lib/utils";
import type { AnalyticsExamRow, AnalyticsFilterState } from "@/types/analytics/analytics-v2";

import { angka, buildInsights, persen } from "../analytics-utils";
import {
  AnalyticsEmpty,
  AnalyticsError,
  AnalyticsSkeleton,
  SectionCard,
  StatTile,
  StatTileGrid,
} from "./analytics-ui";

const LABELS = ["A", "B", "C", "D"];

/** Tab Analisis: pola jawaban per nomor soal, distribusi opsi, dan insight. */
export function TabAnalisis({
  filters,
  exams,
  onExamChange,
}: {
  filters: AnalyticsFilterState;
  exams: AnalyticsExamRow[];
  onExamChange: (examId: string) => void;
}) {
  const examId = filters.examId ?? exams[0]?.exam_id ?? null;
  const query = useQuestionStats(examId, filters);
  const stats = query.data;
  const exam = exams.find((e) => e.exam_id === examId);

  const chartData = useMemo(
    () =>
      (stats?.questions ?? []).map((q) => ({
        name: String(q.question_index + 1),
        accuracy: q.accuracy,
      })),
    [stats],
  );

  const insights = useMemo(() => buildInsights(stats, exam), [stats, exam]);

  if (exams.length === 0) {
    return (
      <SectionCard title="Analisis Soal">
        <AnalyticsEmpty description="Belum ada set ujian dengan hasil pada rentang ini." />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title="Analisis Soal"
        description="Pilih satu set ujian untuk melihat pola jawaban"
        bodyClassName="p-3"
      >
        <Select value={examId ?? ""} onValueChange={onExamChange}>
          <SelectTrigger className="h-9 text-xs" aria-label="Pilih set ujian">
            <SelectValue placeholder="Pilih set ujian" />
          </SelectTrigger>
          <SelectContent>
            {exams.map((e) => (
              <SelectItem key={e.exam_id} value={e.exam_id}>
                {e.exam_title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SectionCard>

      {query.isLoading ? (
        <AnalyticsSkeleton rows={5} />
      ) : query.isError ? (
        <AnalyticsError onRetry={() => void query.refetch()} />
      ) : (stats?.questions.length ?? 0) === 0 ? (
        <SectionCard>
          <AnalyticsEmpty description="Belum ada jawaban tersimpan untuk set ujian ini." />
        </SectionCard>
      ) : (
        <>
          <StatTileGrid>
            <StatTile tone="primary" label="Attempt Dianalisis" value={angka(stats?.attempts ?? 0)} />
            <StatTile label="Jumlah Soal" value={angka(stats?.questions.length ?? 0)} />
            <StatTile
              tone="danger"
              label="Soal < 60% Benar"
              value={angka((stats?.questions ?? []).filter((q) => q.accuracy < 60).length)}
            />
            <StatTile
              tone="success"
              label="Rata-rata Akurasi"
              value={persen(
                (stats?.questions ?? []).reduce((sum, q) => sum + q.accuracy, 0) /
                  Math.max(1, stats?.questions.length ?? 1),
              )}
            />
          </StatTileGrid>

          <SectionCard title="Persentase Benar per Nomor Soal" bodyClassName="p-3">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    minTickGap={2}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [persen(v), "Benar"]}
                    labelFormatter={(v) => `Soal ${v}`}
                  />
                  <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.accuracy >= 75
                            ? "var(--success)"
                            : entry.accuracy >= 50
                              ? "var(--warning)"
                              : "var(--destructive)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {insights.length > 0 ? (
            <SectionCard title="Insight Pintar" description="Dihitung dari jawaban nyata siswa">
              <ul className="space-y-2">
                {insights.map((insight) => (
                  <li
                    key={insight.id}
                    className={cn(
                      "min-w-0 rounded-xl border-l-4 bg-muted/40 p-3",
                      insight.tone === "positive" && "border-l-success",
                      insight.tone === "warning" && "border-l-warning",
                      insight.tone === "critical" && "border-l-destructive",
                      insight.tone === "neutral" && "border-l-primary",
                    )}
                  >
                    <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="min-w-0">{insight.title}</span>
                    </p>
                    <p className="pl-5 text-xs text-muted-foreground">{insight.description}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <SectionCard title="Distribusi Jawaban" description="Kunci jawaban ditandai" bodyClassName="p-3">
            <ul className="space-y-2">
              {(stats?.questions ?? []).map((q) => {
                const total = Math.max(1, q.attempts);
                return (
                  <li key={q.question_id} className="min-w-0 space-y-2 rounded-xl border p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <p className="min-w-0 truncate text-xs font-medium text-foreground">
                        {q.question_index + 1}. {q.question_text.replace(/<[^>]*>/g, "") || "Soal"}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                          q.accuracy >= 75
                            ? "bg-success/15 text-success"
                            : q.accuracy >= 50
                              ? "bg-warning/20 text-warning-foreground"
                              : "bg-destructive/12 text-destructive",
                        )}
                      >
                        {persen(q.accuracy)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {LABELS.map((label) => {
                        const count = Number(q.distribution[label] ?? 0);
                        const isKey = q.correct_label === label;
                        return (
                          <div
                            key={label}
                            className={cn(
                              "rounded-lg border p-1.5 text-center",
                              isKey && "border-success bg-success/10",
                            )}
                          >
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                            <p className="text-xs font-semibold tabular-nums">{angka(count)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {persen(Math.round((count / total) * 100))}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Kosong {angka(q.skipped_count)} · Salah {angka(q.wrong_count)} · dari{" "}
                      {angka(q.attempts)} jawaban
                    </p>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}
