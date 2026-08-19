import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAvailableExams, useMyAttempts } from "@/hooks/attempt";
import { formatDurasi } from "@/types/attempt";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Riwayat Ujian: seluruh attempt milik siswa untuk satu exam (BUG 8). */
export function ExamHistory({ examId }: { examId: string }) {
  const navigate = useNavigate();
  const { data: attempts, isLoading } = useMyAttempts();
  const { data: exams } = useAvailableExams();

  const exam = (exams ?? []).find((e) => e.id === examId);
  const rows = (attempts ?? [])
    .filter((a) => a.exam_id === examId && a.status !== "in_progress")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Memuat riwayat ujian…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">Riwayat Ujian</h1>
          <p className="truncate text-sm text-muted-foreground">
            {exam?.title ?? "Ujian"} · {rows.length} percobaan
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/ujian" })}>
          <ArrowLeft className="mr-1.5 size-4" /> Daftar ujian
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Belum ada riwayat untuk ujian ini.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((attempt) => (
            <Card key={attempt.id}>
              <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold tabular-nums text-foreground">
                      {Number(attempt.score ?? 0).toFixed(0)}
                    </span>
                    <Badge variant={attempt.passed ? "default" : "destructive"} className="gap-1.5">
                      {attempt.passed ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <XCircle className="size-3.5" />
                      )}
                      {attempt.passed ? "Lulus" : "Belum Lulus"}
                    </Badge>
                    <Badge variant="outline">
                      {attempt.auto_submitted ? "Auto Submit" : "Manual"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dateFormatter.format(
                      new Date(attempt.submitted_at ?? attempt.finished_at ?? attempt.created_at),
                    )}{" "}
                    · Durasi {formatDurasi(attempt.duration_seconds ?? 0)}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    void navigate({
                      to: "/ujian/hasil/$attemptId",
                      params: { attemptId: attempt.id },
                    })
                  }
                >
                  Detail
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
