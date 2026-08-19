import { BarChart3, CheckCircle2, HelpCircle, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Dialog informasi sistem ujian (tombol (i) pada header katalog). */
export function ExamInfoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const points = [
    "Setiap set ujian memiliki batas waktu.",
    "Nilai kelulusan mengikuti passing score masing-masing ujian.",
    "Percobaan ulang tetap tercatat sebagai attempt.",
    "Statistik progres set ujian hanya menghitung set yang benar-benar diselesaikan.",
    "Nilai rata-rata menggunakan nilai attempt pertama dari setiap set ujian.",
    'Gunakan tombol "Mulai Ujian" untuk memulai attempt baru.',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" /> Informasi Ujian
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Halaman ini berisi kumpulan set ujian latihan EPS-TOPIK.
        </p>
        <ul className="space-y-2 text-sm">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 text-muted-foreground">{point}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Mengerti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ExamStatsSummary = {
  totalAttempts: number;
  completedSets: number;
  passedSets: number;
  averageScore: number | null;
  totalSets: number;
  /** Nilai attempt pertama per set ujian, urut kronologis. */
  scoreTrend: { label: string; score: number }[];
  /** Progres penyelesaian per kategori (hanya kategori yang punya set ujian). */
  categoryProgress: { label: string; completed: number; total: number; percent: number }[];
};

const trendConfig = {
  score: { label: "Nilai", color: "var(--primary)" },
} satisfies ChartConfig;

const statusConfig = {
  value: { label: "Set" },
  lulus: { label: "Lulus", color: "var(--chart-2)" },
  belumLulus: { label: "Belum lulus", color: "var(--chart-5)" },
  belumSelesai: { label: "Belum selesai", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** Mini dashboard statistik ujian user (read-only, dari data attempt existing). */
export function ExamStatsDialog({
  open,
  onOpenChange,
  stats,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: ExamStatsSummary;
}) {
  const summary: { label: string; value: string }[] = [
    { label: "Total Attempt", value: String(stats.totalAttempts) },
    { label: "Set Selesai", value: String(stats.completedSets) },
    { label: "Set Lulus", value: String(stats.passedSets) },
    {
      label: "Rata-rata",
      value:
        stats.averageScore === null
          ? "—"
          : stats.averageScore.toLocaleString("id-ID", { maximumFractionDigits: 1 }),
    },
  ];

  const notPassed = Math.max(0, stats.completedSets - stats.passedSets);
  const notCompleted = Math.max(0, stats.totalSets - stats.completedSets);
  const statusData = [
    { key: "lulus", name: "Lulus", value: stats.passedSets, fill: "var(--chart-2)" },
    {
      key: "belumLulus",
      name: "Belum lulus",
      value: notPassed,
      fill: "var(--chart-5)",
    },
    {
      key: "belumSelesai",
      name: "Belum selesai",
      value: notCompleted,
      fill: "var(--chart-4)",
    },
  ].filter((item) => item.value > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" /> Statistik Ujian
          </DialogTitle>
          <DialogDescription>Ringkasan perjalanan ujian kamu</DialogDescription>
        </DialogHeader>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {summary.map((row) => (
            <div
              key={row.label}
              className="min-w-0 rounded-xl border border-border bg-muted/30 p-3"
            >
              <p className="truncate text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{row.value}</p>
            </div>
          ))}
        </div>

        {/* GRAPH 1 — perkembangan nilai */}
        <section className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">Perkembangan Nilai</h3>
          {stats.scoreTrend.length < 2 ? (
            <p className="text-xs text-muted-foreground">
              Selesaikan minimal 2 set ujian untuk melihat grafik perkembangan nilai.
            </p>
          ) : (
            <ChartContainer config={trendConfig} className="h-[180px] w-full">
              <AreaChart data={stats.scoreTrend} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="examScoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  fontSize={11}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#examScoreFill)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </section>

        {/* GRAPH 2 — status set ujian */}
        <section className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">Status Set Ujian</h3>
          {statusData.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada set ujian yang tersedia.</p>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
              <ChartContainer config={statusConfig} className="h-[150px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={38}
                    strokeWidth={2}
                  >
                    {statusData.map((item) => (
                      <Cell key={item.key} fill={item.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ul className="min-w-0 space-y-2 text-xs">
                {statusData.map((item) => (
                  <li key={item.key} className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: item.fill }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {item.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* PROGRES KATEGORI */}
        {stats.categoryProgress.length > 0 ? (
          <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3">
            <h3 className="text-sm font-semibold text-foreground">Progres per Kategori</h3>
            {stats.categoryProgress.map((row) => (
              <div key={row.label} className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">{row.label}</span>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {row.completed}/{row.total} • {row.percent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            <X className="mr-2 size-4" /> Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
