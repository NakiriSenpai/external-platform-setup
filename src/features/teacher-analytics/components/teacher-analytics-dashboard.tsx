import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnalyticsOverview, useExamAnalytics, useStudentAnalytics } from "@/hooks/analytics";
import { RankAvatar } from "@/features/leaderboard/components/rank-avatar";
import type { AnalyticsRange } from "@/types/analytics";

import { MetricBar, StatCard } from "./analytics-primitives";
import { formatDurasiDetik, formatTanggal } from "../utils";
import { ExamDetailDialog } from "./exam-detail-dialog";
import { LessonAnalyticsSection } from "./lesson-analytics-section";
import { StudentDetailDialog } from "./student-detail-dialog";


const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "7", label: "7 hari" },
  { value: "30", label: "30 hari" },
  { value: "90", label: "90 hari" },
  { value: "all", label: "Semua" },
];

function EmptyState() {
  return (
    <Card>
      <CardContent className="space-y-2 p-8 text-center">
        <BarChart3 className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Belum ada data ujian</p>
        <p className="text-sm text-muted-foreground">
          Analytics akan muncul setelah siswa menyelesaikan ujian.
        </p>
      </CardContent>
    </Card>
  );
}

/** Dashboard analitik pengajar (Sprint 12) — hanya membaca hasil ujian tersimpan. */
export function TeacherAnalyticsDashboard() {
  const [range, setRange] = useState<AnalyticsRange>("30");
  const [examFilter, setExamFilter] = useState<string>("all");
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openExamId, setOpenExamId] = useState<string | null>(null);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const examId = examFilter === "all" ? null : examFilter;
  const studentId = studentFilter === "all" ? null : studentFilter;

  const overviewQuery = useAnalyticsOverview({ range, examId, studentId });
  const examsQuery = useExamAnalytics({ range, studentId });
  const studentsQuery = useStudentAnalytics(
    useMemo(() => ({ range, examId, search, page, pageSize: 10 }), [range, examId, search, page]),
  );

  const overview = overviewQuery.data;
  const exams = examsQuery.data ?? [];
  const students = studentsQuery.data?.rows ?? [];
  const hasData = (overview?.total_attempts ?? 0) > 0;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Analitik Pengajar</h1>
        <p className="text-sm text-muted-foreground">Performa siswa di lembaga Anda.</p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select
          value={range}
          onValueChange={(v) => {
            setRange(v as AnalyticsRange);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter periode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={examFilter}
          onValueChange={(v) => {
            setExamFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter ujian">
            <SelectValue placeholder="Semua Ujian" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Ujian</SelectItem>
            {exams.map((e) => (
              <SelectItem key={e.exam_id} value={e.exam_id}>
                {e.exam_title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger aria-label="Filter siswa">
            <SelectValue placeholder="Semua Siswa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Siswa</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.user_id} value={s.user_id}>
                {s.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <p className="text-sm text-muted-foreground">Gagal memuat analitik.</p>
            <Button onClick={() => void overviewQuery.refetch()}>Coba lagi</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatCard label="Total Siswa" value={String(overview?.total_students ?? 0)} />
            <StatCard label="Siswa Aktif" value={String(overview?.active_students ?? 0)} />
            <StatCard label="Ujian Dikerjakan" value={String(overview?.total_attempts ?? 0)} />
            <StatCard label="Rata-rata Nilai" value={String(overview?.average_score ?? 0)} />
            <StatCard label="Kelulusan" value={`${overview?.pass_rate ?? 0}%`} />
            <StatCard
              label="Rata-rata Waktu"
              value={formatDurasiDetik(overview?.average_duration_seconds ?? 0)}
            />
          </div>

          {!hasData ? (
            <EmptyState />
          ) : (
            <Card>
              <CardContent className="space-y-3 p-4">
                <h2 className="text-sm font-semibold text-foreground">Performa Ujian</h2>
                <MetricBar label="Average Score" value={overview?.average_score ?? 0} suffix="" />
                <MetricBar label="Pass Rate" value={overview?.pass_rate ?? 0} />
                <MetricBar
                  label="Completed Exams"
                  value={overview?.total_attempts ?? 0}
                  suffix=""
                  max={Math.max(overview?.total_attempts ?? 1, 1)}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Analitik per Ujian</h2>
        {examsQuery.isLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada ujian yang dikerjakan.</p>
        ) : (
          <ul className="space-y-2">
            {exams.map((e) => (
              <li key={e.exam_id}>
                <button
                  type="button"
                  onClick={() => setOpenExamId(e.exam_id)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
                >
                  <p className="truncate text-sm font-medium text-foreground">{e.exam_title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.attempts} percobaan · {e.students} siswa · rata-rata {e.average_score} ·
                    lulus {e.pass_rate ?? 0}%
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LessonAnalyticsSection range={range} />



      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Performa Siswa</h2>
        </div>
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Cari siswa…"
          aria-label="Cari siswa"
        />
        {studentsQuery.isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : studentsQuery.isError ? (
          <div className="space-y-2 rounded-lg border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">Gagal memuat data siswa.</p>
            <Button size="sm" onClick={() => void studentsQuery.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada siswa yang cocok.</p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <li key={s.user_id}>
                <button
                  type="button"
                  onClick={() => setOpenStudentId(s.user_id)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
                >
                  <RankAvatar row={s} className="size-9" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.attempts} percobaan · rata-rata {s.average_score} · lulus {s.pass_rate}% ·{" "}
                      {formatTanggal(s.last_submitted_at)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{s.average_score}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {(studentsQuery.data?.totalPages ?? 1) > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <span className="text-xs text-muted-foreground">
              Halaman {page} dari {studentsQuery.data?.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (studentsQuery.data?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </Button>
          </div>
        ) : null}
      </section>

      <ExamDetailDialog
        examId={openExamId}
        range={range}
        onOpenChange={(open) => !open && setOpenExamId(null)}
      />
      <StudentDetailDialog
        studentId={openStudentId}
        range={range}
        onOpenChange={(open) => !open && setOpenStudentId(null)}
      />
    </div>
  );
}
