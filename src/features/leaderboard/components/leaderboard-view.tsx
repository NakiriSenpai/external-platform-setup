import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Info,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeaderboard, useLeaderboardExams, useLeaderboardPodium } from "@/hooks/leaderboard";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/types/analytics";

import { LeaderboardInfoDialog } from "./leaderboard-info-dialog";
import { LeaderboardPodium, RoleBadge } from "./leaderboard-podium";
import { RankAvatar } from "./rank-avatar";
import { formatScore } from "../utils";

const PAGE_SIZE = 7;

/** Kolom eksplisit: Siswa fleksibel, angka compact tapi aman untuk angka besar. */
const GRID_COLS =
  "grid grid-cols-[3.25rem_minmax(0,1fr)_max-content_max-content] gap-x-2 sm:grid-cols-[4rem_minmax(0,1fr)_max-content_max-content] sm:gap-x-4";

const NUM_CELL =
  "min-w-[3rem] whitespace-nowrap text-right text-sm font-semibold tabular-nums [font-variant-numeric:tabular-nums] text-primary sm:min-w-[4rem]";

function RankRow({ row }: { row: LeaderboardRow }) {
  return (
    <li
      className={cn(
        GRID_COLS,
        "min-h-[3.75rem] items-center border-b border-border/60 px-3 py-2 transition-colors last:border-b-0 hover:bg-primary/5",
        row.is_current_user ? "bg-primary/10" : "",
      )}
    >
      <span className="text-sm font-bold tabular-nums text-foreground">{row.rank}</span>

      <div className="flex min-w-0 items-center gap-2.5">
        <RankAvatar row={row} className="size-9 shrink-0 ring-1 ring-border sm:size-11" />
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-2 break-words text-sm font-semibold leading-tight text-foreground"
            title={row.display_name}
          >
            {row.display_name}
          </p>
          <div className="mt-1">
            <RoleBadge role={row.role} />
          </div>
        </div>
      </div>

      <span className={NUM_CELL} title={formatScore(row.exams_taken)}>
        {formatScore(row.exams_taken)}
      </span>
      <span className={NUM_CELL} title={formatScore(row.total_score)}>
        {formatScore(row.total_score)}
      </span>
    </li>
  );
}


/** Papan peringkat siswa dalam satu tenant — skor attempt pertama per ujian. */
export function LeaderboardView() {
  const router = useRouter();
  const [examId, setExamId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [infoOpen, setInfoOpen] = useState(false);

  const listParams = useMemo(
    () => ({ examId, page, pageSize: PAGE_SIZE, skip: 3 }),
    [examId, page],
  );

  const { data, isLoading, isError, refetch, isFetching } = useLeaderboard(listParams);
  const podium = useLeaderboardPodium(examId);
  const { data: exams } = useLeaderboardExams();

  const podiumRows = podium.data ?? [];
  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !podium.isLoading && podiumRows.length === 0;

  function selectMode(next: string | null) {
    setExamId(next);
    setPage(1);
  }

  return (
    <div className="space-y-3">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <button
          type="button"
          aria-label="Kembali"
          onClick={() => router.history.back()}
          className="mt-1 shrink-0 text-foreground"
        >
          <ArrowLeft className="size-6" />
        </button>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            Leaderboard
            <Trophy className="size-5 shrink-0 text-primary" />
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            Lihat peringkat terbaik para siswa
          </p>
        </div>
        <button
          type="button"
          aria-label="Tentang Leaderboard"
          onClick={() => setInfoOpen(true)}
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Info className="size-5" />
        </button>
      </header>

      <LeaderboardInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />

      {/* Mode: Semua / Per Exam */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2">
        <button
          type="button"
          onClick={() => selectMode(null)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
            examId === null
              ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
              : "text-muted-foreground",
          )}
        >
          <Globe className="size-4 shrink-0" />
          Semua
        </button>

        <Select value={examId ?? ""} onValueChange={(v) => selectMode(v)}>
          <SelectTrigger
            aria-label="Pilih ujian"
            className={cn(
              "h-auto justify-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2.5 text-sm font-semibold shadow-none",
              examId ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}
          >
            <FileText className="size-4 shrink-0" />
            <span className="truncate">
              <SelectValue placeholder="Per Exam" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {(exams ?? []).length === 0 ? (
              <SelectItem value="__none" disabled>
                Belum ada ujian
              </SelectItem>
            ) : null}
            {(exams ?? []).map((e) => (
              <SelectItem key={e.exam_id} value={e.exam_id}>
                {e.exam_title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Penjelasan logic */}
      <div className="flex gap-3 rounded-2xl border border-border bg-card p-3.5">
        <Users className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p>
            Peringkat berdasarkan jumlah ujian yang telah dikerjakan dan total skor dari attempt
            terbaru yang sudah selesai pada setiap ujian.
          </p>
          <p>Setiap ujian hanya dihitung satu kali berdasarkan attempt terakhir yang selesai.</p>
        </div>
      </div>

      {podium.isLoading || isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-60 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : isError || podium.isError ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Gagal memuat papan peringkat.</p>
          <Button
            onClick={() => {
              void refetch();
              void podium.refetch();
            }}
            disabled={isFetching}
          >
            Coba lagi
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-primary/40 bg-primary/10 shadow-[0_0_28px_hsl(var(--primary)/0.25)]">
            <Trophy className="size-7 text-primary" />
          </span>
          <p className="text-sm font-semibold text-foreground">
            {examId ? "Belum ada peserta" : "Belum ada peringkat"}
          </p>
          <p className="text-sm text-muted-foreground">
            {examId
              ? "Belum ada siswa yang menyelesaikan ujian ini."
              : "Belum ada siswa yang menyelesaikan ujian."}
          </p>
        </div>
      ) : (
        <>
          <LeaderboardPodium rows={podiumRows} />

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div
              className={cn(
                GRID_COLS,
                "items-end border-b border-border px-3 py-2.5 text-[9px] leading-tight text-muted-foreground sm:text-[11px]",
              )}
            >
              <span className="whitespace-nowrap">Peringkat</span>
              <span className="min-w-0 truncate">Siswa</span>
              <span className="min-w-[3rem] whitespace-nowrap text-right sm:min-w-[4rem]">
                Ujian
              </span>
              <span className="min-w-[3rem] whitespace-nowrap text-right sm:min-w-[4rem]">
                Total Skor
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Tidak ada peringkat lain di halaman ini.
              </p>
            ) : (
              <ul>
                {rows.map((row) => (
                  <RankRow key={row.user_id} row={row} />
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 rounded-xl"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Button>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 rounded-xl border-primary/50 text-primary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
          <TrendingUp className="size-5 text-primary" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-primary">Peringkat diperbarui real-time.</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Setiap kali ada siswa menyelesaikan ujian, peringkat akan
            langsung menyesuaikan secara otomatis.
          </p>
        </div>
      </div>
    </div>
  );
}
