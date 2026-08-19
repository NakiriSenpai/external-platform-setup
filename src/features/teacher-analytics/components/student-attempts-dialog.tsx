import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudentAttemptsV2 } from "@/hooks/analytics";
import type { AnalyticsFilterState, AnalyticsStudentRow } from "@/types/analytics/analytics-v2";

import { angka, dateTime, durasi, persen } from "../analytics-utils";
import { AnalyticsEmpty, AnalyticsError, AnalyticsSkeleton, StudentAvatar } from "./analytics-ui";

/** Detail satu siswa: metrik ringkas + seluruh riwayat attempt. */
export function StudentAttemptsDialog({
  student,
  filters,
  onOpenChange,
}: {
  student: AnalyticsStudentRow | null;
  filters: AnalyticsFilterState;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useStudentAttemptsV2(student?.user_id ?? null, filters);
  const attempts = query.data ?? [];

  return (
    <Dialog open={Boolean(student)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-2 text-base">
            <StudentAvatar
              name={student?.display_name ?? "Siswa"}
              avatarUrl={student?.avatar_url}
              className="size-8"
            />
            <span className="truncate">{student?.display_name}</span>
          </DialogTitle>
          <DialogDescription>
            Nilai leaderboard & rata-rata memakai attempt pertama; seluruh attempt tetap tersimpan.
          </DialogDescription>
        </DialogHeader>

        {student ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Rata-rata</p>
              <p className="text-base font-bold tabular-nums">{angka(student.average_score, 1)}</p>
            </div>
            <div className="rounded-xl border p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Kelulusan</p>
              <p className="text-base font-bold tabular-nums">{persen(student.pass_rate)}</p>
            </div>
            <div className="rounded-xl border p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Total Ujian</p>
              <p className="text-base font-bold tabular-nums">{angka(student.attempts)}</p>
            </div>
          </div>
        ) : null}

        {query.isLoading ? (
          <AnalyticsSkeleton rows={3} />
        ) : query.isError ? (
          <AnalyticsError onRetry={() => void query.refetch()} />
        ) : attempts.length === 0 ? (
          <AnalyticsEmpty description="Siswa ini belum mengerjakan ujian pada rentang tanggal terpilih." />
        ) : (
          <ul className="space-y-2">
            {attempts.map((attempt) => (
              <li key={attempt.attempt_id} className="min-w-0 space-y-2 rounded-xl border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {attempt.exam_title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Attempt #{attempt.attempt_number} · {dateTime(attempt.submitted_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {attempt.is_first ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Dinilai
                      </Badge>
                    ) : null}
                    <Badge variant={attempt.passed ? "default" : "destructive"}>
                      {angka(attempt.score, 1)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Benar {angka(attempt.correct_count)}</span>
                  <span>Salah {angka(attempt.wrong_count)}</span>
                  <span>Kosong {angka(attempt.skipped_count)}</span>
                  <span>{durasi(attempt.duration_seconds)}</span>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8 w-full text-xs">
                  <Link to="/ujian/review/$attemptId" params={{ attemptId: attempt.attempt_id }}>
                    <Eye className="size-3.5" /> Lihat Review
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
