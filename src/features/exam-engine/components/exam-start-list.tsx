import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock, FileText, History, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import { useAvailableExams, useMyAttempts, useStartAttempt } from "@/hooks/attempt";
import type { ExamRow } from "@/types/exam";
import { ContinueExamDialog } from "./exam-dialogs";
import { ExamRulesDialog } from "./exam-rules-dialog";

/**
 * Daftar ujian published.
 * Sprint 11A: fullscreen & landscape TIDAK diminta di sini — Workspace yang
 * memintanya setelah mounted, sehingga user tidak pernah tertinggal di halaman ini.
 */
export function ExamStartList() {
  const navigate = useNavigate();
  const { data: exams, isLoading } = useAvailableExams();
  const { data: attempts } = useMyAttempts();
  const start = useStartAttempt();

  const [startTarget, setStartTarget] = useState<ExamRow | null>(null);
  const [continueTarget, setContinueTarget] = useState<string | null>(null);

  // Attempt aktif = in_progress DAN belum lewat expires_at.
  // (Finalisasi sebenarnya dilakukan di data layer memakai waktu server.)
  const activeByExam = new Map(
    (attempts ?? [])
      .filter(
        (a) =>
          a.status === "in_progress" &&
          Boolean(a.expires_at) &&
          new Date(a.expires_at).getTime() > Date.now(),
      )
      .map((a) => [a.exam_id, a]),
  );

  const finishedExamIds = new Set(
    (attempts ?? [])
      .filter((a) => a.status !== "in_progress" && a.status !== "cancelled")
      .map((a) => a.exam_id),
  );

  const handleStart = (examId: string) => {
    start.mutate(examId, {
      onSuccess: (attempt) => {
        setStartTarget(null);
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
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Ujian</h1>
        <p className="text-sm text-muted-foreground">
          Pilih ujian untuk dikerjakan. Ujian berjalan dalam mode layar penuh dan waktunya tetap
          berjalan meski halaman dimuat ulang.
        </p>
      </header>

      {(exams ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Belum ada ujian yang dipublikasikan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(exams ?? []).map((exam) => {
            const active = activeByExam.get(exam.id);
            return (
              <Card key={exam.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">{exam.title}</h2>
                    {exam.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {exam.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{exam.category}</Badge>
                    <Badge variant="outline">{EXAM_DIFFICULTY_LABELS[exam.difficulty]}</Badge>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="size-3" /> {exam.duration_minutes} menit
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <FileText className="size-3" /> Lulus {exam.passing_score}
                    </Badge>
                  </div>
                  <Button
                    className="h-11 w-full"
                    disabled={start.isPending}
                    onClick={() => (active ? setContinueTarget(active.id) : setStartTarget(exam))}
                  >
                    <PlayCircle className="mr-2 size-4" />
                    {active ? "Lanjutkan Ujian" : "Mulai Ujian"}
                  </Button>
                  {finishedExamIds.has(exam.id) ? (
                    <Button
                      variant="outline"
                      className="h-11 w-full"
                      onClick={() =>
                        void navigate({
                          to: "/ujian/riwayat/$examId",
                          params: { examId: exam.id },
                        })
                      }
                    >
                      <History className="mr-2 size-4" /> Riwayat Ujian
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
