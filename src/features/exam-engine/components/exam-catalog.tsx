import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Headphones,
  HelpCircle,
  Lightbulb,
  Loader2,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS, EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import { useAvailableExams, useMyResults, useMyAttempts, useStartAttempt } from "@/hooks/attempt";
import { useExamCategories } from "@/hooks/exam/use-exam-category";
import { cn } from "@/lib/utils";
import type { ExamRow } from "@/types/exam";
import motivationArt from "@/assets/exam-motivation.png";
import progressArt from "@/assets/exam-progress.png";
import { ContinueExamDialog } from "./exam-dialogs";
import { ExamRulesDialog } from "./exam-rules-dialog";
import { ExamInfoDialog, ExamStatsDialog } from "./exam-catalog-dialogs";

const PAGE_SIZE = 10;

const DIFFICULTY_STYLE: Record<string, string> = {
  mudah: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  sedang: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  sulit: "border-rose-500/40 bg-rose-500/10 text-rose-400",
};

function fallbackLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

function ExamIcon({ exam }: { exam: ExamRow }) {
  const category = exam.category.toLowerCase();
  const listening = category.includes("listening") || category.includes("dengar");
  if (exam.icon_url) {
    return (
      <img
        src={exam.icon_url}
        alt=""
        loading="lazy"
        className="size-14 shrink-0 rounded-2xl border border-border object-cover"
      />
    );
  }
  const Icon = listening ? Headphones : BookOpen;
  return (
    <div
      className={cn(
        "grid size-14 shrink-0 place-items-center rounded-2xl border",
        listening
          ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
          : "border-primary/40 bg-primary/10 text-primary",
      )}
    >
      <Icon className="size-7" />
    </div>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3">
      <div className={cn("grid size-10 place-items-center rounded-full border", tone)}>{icon}</div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/**
 * Katalog / daftar ujian (Sprint 19 redesign).
 * Hanya lapisan presentasi + statistik read-only; Exam Engine tidak diubah.
 */
export function ExamCatalog() {
  const navigate = useNavigate();
  const { data: exams, isLoading } = useAvailableExams();
  const { data: attempts } = useMyAttempts();
  const { data: results } = useMyResults();
  const start = useStartAttempt();

  const [startTarget, setStartTarget] = useState<ExamRow | null>(null);
  const [continueTarget, setContinueTarget] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [category, setCategory] = useState("semua");
  const [page, setPage] = useState(1);

  const examList = useMemo(() => exams ?? [], [exams]);
  const { data: categoryRows } = useExamCategories();
  const categoryLabel = useCallback(
    (slug: string) =>
      (categoryRows ?? []).find((item) => item.slug === slug)?.label ?? fallbackLabel(slug),
    [categoryRows],
  );

  const activeByExam = useMemo(
    () =>
      new Map(
        (attempts ?? [])
          .filter(
            (a) =>
              a.status === "in_progress" &&
              Boolean(a.expires_at) &&
              new Date(a.expires_at).getTime() > Date.now(),
          )
          .map((a) => [a.exam_id, a]),
      ),
    [attempts],
  );

  const stats = useMemo(() => {
    const rows = results ?? [];
    const examById = new Map(examList.map((exam) => [exam.id, exam]));
    const firstByExam = new Map<string, number>();
    const passedSets = new Set<string>();
    const scoreTrend: { label: string; score: number }[] = [];
    for (const row of rows) {
      if (!firstByExam.has(row.exam_id)) {
        firstByExam.set(row.exam_id, row.score);
        scoreTrend.push({
          label: `#${scoreTrend.length + 1}`,
          score: Math.round(row.score),
        });
      }
      if (row.passed) passedSets.add(row.exam_id);
    }
    const firstScores = [...firstByExam.values()];
    const average =
      firstScores.length === 0
        ? null
        : Math.round((firstScores.reduce((a, b) => a + b, 0) / firstScores.length) * 10) / 10;

    const perCategory = new Map<string, { completed: number; total: number }>();
    for (const exam of examList) {
      const entry = perCategory.get(exam.category) ?? { completed: 0, total: 0 };
      entry.total += 1;
      perCategory.set(exam.category, entry);
    }
    for (const examId of firstByExam.keys()) {
      const exam = examById.get(examId);
      if (!exam) continue;
      const entry = perCategory.get(exam.category);
      if (entry) entry.completed += 1;
    }

    return {
      totalAttempts: rows.length,
      completedSets: firstByExam.size,
      passedSets: passedSets.size,
      averageScore: average,
      totalSets: examList.length,
      scoreTrend,
      categoryProgress: [...perCategory.entries()]
        .map(([slug, entry]) => ({
          label: categoryLabel(slug),
          completed: entry.completed,
          total: entry.total,
          percent: entry.total === 0 ? 0 : Math.round((entry.completed / entry.total) * 100),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }, [results, examList, categoryLabel]);

  const totalSets = examList.length;
  const progressPercent = totalSets === 0 ? 0 : Math.round((stats.completedSets / totalSets) * 100);

  const categories = useMemo(() => {
    const used = new Set(examList.map((exam) => exam.category));
    const fromDb = (categoryRows ?? []).filter((row) => used.has(row.slug));
    const known = new Set(fromDb.map((row) => row.slug));
    const extras = [...used]
      .filter((slug) => !known.has(slug))
      .map((slug) => ({
        slug,
        label: fallbackLabel(slug),
      }));
    return [...fromDb.map((row) => ({ slug: row.slug, label: row.label })), ...extras].sort(
      (a, b) => a.label.localeCompare(b.label),
    );
  }, [examList, categoryRows]);

  const filtered = useMemo(
    () => (category === "semua" ? examList : examList.filter((e) => e.category === category)),
    [examList, category],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleStart = (examId: string) => {
    // Ujian selalu dimulai langsung di halaman ujian (SPA, satu TWA Activity).
    start.mutate(examId, {
      onSuccess: (attempt) => {
        setStartTarget(null);
        // Attempt BARU: langsung masuk workspace, tanpa perantara "Lanjutkan Ujian".
        setContinueTarget(null);
        void navigate({ to: "/ujian/$attemptId", params: { attemptId: attempt.id } });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memulai ujian."),
    });
  };


  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Memuat daftar ujian…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* HEADER */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
          <ClipboardList className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ujian</h1>
          <p className="text-sm text-muted-foreground">
            Latihan CBT EPS-TOPIK dengan timer dan question palette.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Informasi ujian"
            className="size-10 rounded-full"
            onClick={() => setInfoOpen(true)}
          >
            <HelpCircle className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Statistik ujian"
            className="size-10 rounded-full"
            onClick={() => setStatsOpen(true)}
          >
            <BarChart3 className="size-5" />
          </Button>
        </div>
      </header>

      {/* HERO PROGRESS */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <img
            src={progressArt}
            alt=""
            width={512}
            height={512}
            loading="lazy"
            className="size-20 shrink-0 object-contain drop-shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_35%,transparent)] sm:size-24"
          />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">Semua ujian</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tabular-nums text-primary">
              {stats.completedSets}
              <span className="text-lg font-medium text-muted-foreground">/ {totalSets}</span>
              <span className="text-lg text-muted-foreground">•</span>
              <span>{progressPercent}%</span>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* STATISTIC CARDS */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          icon={<ClipboardList className="size-5" />}
          tone="border-primary/40 bg-primary/10 text-primary"
          label="Total ujian"
          value={String(stats.totalAttempts)}
        />
        <StatCard
          icon={<Target className="size-5" />}
          tone="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          label="Lulus"
          value={String(stats.passedSets)}
        />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          tone="border-amber-500/40 bg-amber-500/10 text-amber-400"
          label="Rata-rata"
          value={
            stats.averageScore === null
              ? "—"
              : stats.averageScore.toLocaleString("id-ID", { maximumFractionDigits: 1 })
          }
        />
      </section>

      {/* CATEGORY FILTER */}
      <Select
        value={category}
        onValueChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
      >
        <SelectTrigger
          aria-label="Pilih kategori ujian"
          className="h-auto w-full rounded-2xl border-primary/40 bg-card px-4 py-3 text-left [&>span]:min-w-0"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ClipboardList className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pilih ujian</p>
              <SelectValue />
            </div>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="semua">Semua Kategori</SelectItem>
          {categories.map((item) => (
            <SelectItem key={item.slug} value={item.slug}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* EXAM LIST */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Belum ada ujian yang dipublikasikan.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((exam) => {
            const active = activeByExam.get(exam.id);
            return (
              <article
                key={exam.id}
                className="rounded-2xl border border-border bg-card p-3 sm:p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ExamIcon exam={exam} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                      {exam.title}
                    </h2>
                    {exam.description ? (
                      <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                        {exam.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                {/* 4 chip metadata — selalu satu baris */}
                <div className="mt-3 grid grid-cols-4 gap-1.5 text-[11px] leading-none">
                  <span className="flex min-w-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-1.5 py-1.5 text-primary">
                    <span className="truncate">{categoryLabel(exam.category)}</span>
                  </span>
                  <span
                    className={cn(
                      "flex min-w-0 items-center justify-center rounded-md border px-1.5 py-1.5",
                      DIFFICULTY_STYLE[exam.difficulty] ??
                        "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{EXAM_DIFFICULTY_LABELS[exam.difficulty]}</span>
                  </span>
                  <span className="flex min-w-0 items-center justify-center gap-1 rounded-md border border-border bg-muted/30 px-1.5 py-1.5 text-muted-foreground">
                    <Clock className="size-3 shrink-0" />
                    <span className="truncate tabular-nums">{exam.duration_minutes}m</span>
                  </span>
                  <span className="flex min-w-0 items-center justify-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-1.5 text-amber-400">
                    <Target className="size-3 shrink-0" />
                    <span className="truncate tabular-nums">{exam.passing_score}%</span>
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Button
                    className="h-11 w-full rounded-xl"
                    disabled={start.isPending}
                    onClick={() => (active ? setContinueTarget(active.id) : setStartTarget(exam))}
                  >
                    {active ? "Lanjutkan Ujian" : "Mulai Ujian"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl border-primary/40 px-3 text-primary"
                    aria-label={`Riwayat ujian ${exam.title}`}
                    onClick={() =>
                      void navigate({
                        to: "/ujian/riwayat/$examId",
                        params: { examId: exam.id },
                      })
                    }
                  >
                    <History className="size-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Riwayat</span>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      <nav
        aria-label="Navigasi halaman ujian"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"
      >
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          disabled={currentPage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="mr-1 size-4" /> Sebelumnya
        </Button>
        <span className="px-1 text-sm font-medium tabular-nums text-foreground">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          className="h-11 rounded-xl border-primary/50 text-primary"
          disabled={currentPage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Selanjutnya <ChevronRight className="ml-1 size-4" />
        </Button>
      </nav>

      {/* MOTIVATIONAL FOOTER CARD */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card px-3 py-3 sm:px-5 sm:py-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 sm:gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_25%,transparent)] sm:size-14">
            <Lightbulb className="size-5 sm:size-7" />
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-snug tracking-tight text-foreground [font-size:clamp(0.85rem,3.4vw,1.25rem)]">
              Kerjakan dengan fokus, raih hasil terbaik!
            </p>
            <p className="mt-1 leading-snug text-muted-foreground [font-size:clamp(0.7rem,2.7vw,0.9rem)]">
              Setiap ujian menggunakan timer dan question palette. Pastikan koneksi stabil dan
              kerjakan dengan jujur.
            </p>
          </div>
          <img
            src={motivationArt}
            alt=""
            width={512}
            height={512}
            loading="lazy"
            className="size-14 max-w-[22vw] shrink-0 object-contain drop-shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_30%,transparent)] sm:size-20"
          />
        </div>
      </section>

      <ExamInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
      <ExamStatsDialog open={statsOpen} onOpenChange={setStatsOpen} stats={stats} />

      <ExamRulesDialog
        open={Boolean(startTarget)}
        pending={start.isPending}
        onOpenChange={(open) => !open && setStartTarget(null)}
        onConfirm={() => startTarget && handleStart(startTarget.id)}
      />

      <ContinueExamDialog
        open={Boolean(continueTarget)}
        onOpenChange={(open) => !open && setContinueTarget(null)}
        onConfirm={() => {
          if (!continueTarget) return;
          void navigate({ to: "/ujian/$attemptId", params: { attemptId: continueTarget } });
        }}
      />

    </div>
  );
}
