import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, ClipboardList, TrendingUp, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useExamPerformance, useOverviewV2, useTrendV2 } from "@/hooks/analytics";
import type { AnalyticsFilterState } from "@/types/analytics/analytics-v2";

import { angka, durasi, longDate, persen, shortDate } from "../analytics-utils";
import {
  AnalyticsEmpty,
  AnalyticsError,
  AnalyticsSkeleton,
  MetricRow,
  SectionCard,
  StatTile,
  StatTileGrid,
} from "./analytics-ui";

type Metric = "average_score" | "pass_rate" | "attempts";

const METRICS: { value: Metric; label: string }[] = [
  { value: "average_score", label: "Rata-rata Nilai" },
  { value: "pass_rate", label: "Kelulusan" },
  { value: "attempts", label: "Jumlah Ujian" },
];

/** Tab Ringkasan: kartu metrik, tren harian, dan performa per set ujian. */
export function TabRingkasan({ filters }: { filters: AnalyticsFilterState }) {
  const [metric, setMetric] = useState<Metric>("average_score");
  const overview = useOverviewV2(filters);
  const trend = useTrendV2(filters);
  const exams = useExamPerformance(filters);

  const data = overview.data;
  const points = trend.data ?? [];

  return (
    <div className="space-y-3">
      {overview.isLoading ? (
        <AnalyticsSkeleton rows={2} />
      ) : overview.isError ? (
        <AnalyticsError onRetry={() => void overview.refetch()} />
      ) : (
        <>
          <StatTileGrid>
            <StatTile
              tone="primary"
              icon={TrendingUp}
              label="Rata-rata Nilai"
              value={angka(data?.average_score ?? 0, 1)}
              hint="Attempt pertama"
            />
            <StatTile
              tone="success"
              icon={CheckCircle2}
              label="Tingkat Kelulusan"
              value={persen(data?.pass_rate ?? 0)}
              hint="Attempt pertama"
            />
            <StatTile
              icon={ClipboardList}
              label="Total Ujian"
              value={angka(data?.total_attempts ?? 0)}
              hint="Semua attempt selesai"
            />
            <StatTile
              icon={Users}
              label="Siswa Aktif"
              value={`${angka(data?.active_students ?? 0)}/${angka(data?.total_students ?? 0)}`}
              hint="Mengerjakan pada periode ini"
            />
          </StatTileGrid>

          <StatTileGrid>
            <StatTile label="Set Ujian" value={angka(data?.exam_count ?? 0)} />
            <StatTile
              label="Rata-rata Durasi"
              value={durasi(data?.average_duration_seconds ?? 0)}
            />
            <StatTile
              tone="success"
              label="Jawaban Benar"
              value={angka(data?.correct_count ?? 0)}
            />
            <StatTile
              tone="danger"
              label="Salah / Kosong"
              value={`${angka(data?.wrong_count ?? 0)} / ${angka(data?.skipped_count ?? 0)}`}
            />
          </StatTileGrid>
        </>
      )}

      <SectionCard
        title="Perkembangan Harian"
        description={`${longDate(filters.from)} – ${longDate(filters.to)}`}
        bodyClassName="p-3"
        action={
          <div className="flex gap-1">
            {METRICS.map((m) => (
              <Button
                key={m.value}
                size="sm"
                variant={metric === m.value ? "default" : "outline"}
                className="h-7 rounded-full px-2.5 text-[11px]"
                onClick={() => setMetric(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        }
      >
        {trend.isLoading ? (
          <AnalyticsSkeleton rows={3} />
        ) : trend.isError ? (
          <AnalyticsError onRetry={() => void trend.refetch()} />
        ) : points.length === 0 ? (
          <AnalyticsEmpty />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="analytics-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => shortDate(String(v))}
                  formatter={(value: number) => [
                    metric === "attempts" ? angka(value) : angka(value, 1),
                    METRICS.find((m) => m.value === metric)?.label ?? "",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#analytics-trend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Performa per Set Ujian" description="Nilai & kelulusan dari attempt pertama">
        {exams.isLoading ? (
          <AnalyticsSkeleton rows={3} />
        ) : exams.isError ? (
          <AnalyticsError onRetry={() => void exams.refetch()} />
        ) : (exams.data ?? []).length === 0 ? (
          <AnalyticsEmpty />
        ) : (
          <ul className="space-y-3">
            {(exams.data ?? []).map((exam) => (
              <li key={exam.exam_id} className="min-w-0 space-y-2 rounded-xl border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {exam.exam_title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {angka(exam.attempts)} ujian · {angka(exam.students)} siswa · terakhir{" "}
                      {longDate(exam.last_submitted_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-muted px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
                    {angka(exam.average_score, 1)}
                  </span>
                </div>
                <MetricRow
                  label="Kelulusan"
                  value={exam.pass_rate}
                  display={persen(exam.pass_rate)}
                  tone={exam.pass_rate >= 60 ? "success" : "danger"}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
