import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  CircleSlash,
  Loader2,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAttemptResult, useStartAttempt } from "@/hooks/attempt";
import { useColorTestResult } from "@/hooks/color-test";
import { formatDurasi } from "@/types/attempt";
import { formatTanggal } from "@/utils/format";
import { WorkspaceShell } from "./workspace-shell";

/** Result — ujian sudah selesai: kembali ke app utama (portrait). */
export function ResultWorkspace({ attemptId }: { attemptId: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useAttemptResult(attemptId);
  const startAttempt = useStartAttempt();
  const colorTest = useColorTestResult(attemptId);
  const colorSession = colorTest.data?.session ?? null;

  // Tahap wajib: selama Tes Buta Warna belum selesai, hasil ujian belum dibuka.
  useEffect(() => {
    if (colorTest.isLoading || colorTest.isError) return;
    if (!colorSession || colorSession.status === "in_progress") {
      void navigate({ to: "/ujian/color-test/$attemptId", params: { attemptId } });
    }
  }, [colorTest.isLoading, colorTest.isError, colorSession, attemptId, navigate]);


  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Memuat hasil ujian…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium text-foreground">
            {error instanceof Error ? error.message : "Hasil ujian tidak dapat dimuat."}
          </p>
          <Button onClick={() => void navigate({ to: "/ujian" })}>Kembali ke daftar ujian</Button>
        </CardContent>
      </Card>
    );
  }

  const exitWorkspace = () => {
    void navigate({ to: "/ujian" });
  };

  const tryAgain = () => {
    startAttempt.mutate(data.exam_id, {
      onSuccess: (attempt) =>
        void navigate({ to: "/ujian/$attemptId", params: { attemptId: attempt.id } }),
      onError: (retryError) =>
        toast.error(retryError instanceof Error ? retryError.message : "Gagal memulai ujian baru."),
    });
  };

  const stats = [
    { label: "Benar", value: data.correct_count, icon: CheckCircle2, tone: "text-success" },
    { label: "Salah", value: data.wrong_count, icon: XCircle, tone: "text-destructive" },
    {
      label: "Kosong",
      value: data.skipped_count,
      icon: CircleSlash,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <WorkspaceShell
      header={
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{data.exam_title}</p>
            <p className="text-[11px] text-muted-foreground">Hasil Ujian</p>
          </div>
          <Button
            size="sm"
            onClick={() => void navigate({ to: "/ujian/review/$attemptId", params: { attemptId } })}
          >
            Review
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={startAttempt.isPending}
            onClick={tryAgain}
          >
            {startAttempt.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 size-4" />
            )}
            Coba Lagi
          </Button>
          <Button size="sm" variant="outline" onClick={exitWorkspace}>
            Keluar
          </Button>
        </>
      }
    >
      <div className="w-full">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <div className="grid items-stretch gap-3 md:grid-cols-2">
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-3 p-4 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-surface glow-primary">
                  <Trophy className={data.passed ? "size-6 text-success" : "size-6 text-primary"} />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Skor Anda
                </p>
                <p className="text-5xl font-bold tabular-nums text-foreground">
                  {Number(data.score).toLocaleString("id-ID")}
                  <span className="text-2xl text-muted-foreground"> / 100</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Passing score: {Number(data.passing_score).toLocaleString("id-ID")}
                </p>
                <Badge
                  variant={data.passed ? "default" : "destructive"}
                  className={`mx-auto px-4 py-1 text-sm ${data.passed ? "bg-success text-success-foreground" : ""}`}
                >
                  {data.passed ? "LULUS" : "TIDAK LULUS"}
                </Badge>
                <Separator />
                <div className="mt-auto grid grid-cols-3 gap-2">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-border bg-surface p-2"
                    >
                      <stat.icon className={`mx-auto size-5 ${stat.tone}`} />
                      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardContent className="flex h-full flex-col p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Informasi Ujian
                </p>
                <Separator className="my-3" />
                <dl className="space-y-3 text-sm">
                  <Row label="Jumlah soal" value={String(data.total_questions)} />
                  <Row label="Durasi" value={formatDurasi(data.duration_seconds)} />
                  <Row label="Tanggal" value={formatTanggal(data.submitted_at)} />
                  {data.auto_submitted ? (
                    <Row
                      label="Catatan"
                      value={
                        data.submit_reason === "time_up"
                          ? "Dikumpulkan otomatis (waktu habis)"
                          : "Dikumpulkan otomatis (pelanggaran layar penuh)"
                      }
                    />
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Hasil Tes Buta Warna
              </p>
              <Separator className="my-3" />
              {colorSession ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge
                      variant={colorSession.passed ? "default" : "destructive"}
                      className={colorSession.passed ? "bg-success text-success-foreground" : ""}
                    >
                      {colorSession.passed ? "LULUS" : "TIDAK LULUS"}
                    </Badge>
                  </div>
                  <dl className="mt-3 space-y-3 text-sm">
                    <Row
                      label="Benar"
                      value={`${colorSession.correct_count} / ${colorSession.total_questions}`}
                    />
                    <Row
                      label="Salah"
                      value={`${colorSession.wrong_count} / ${colorSession.total_questions}`}
                    />
                    <Row
                      label="Skip"
                      value={`${colorSession.skipped_count} / ${colorSession.max_skip}`}
                    />
                    <Row
                      label="Waktu"
                      value={formatDurasi(colorSession.duration_seconds ?? 0)}
                    />
                  </dl>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tes buta warna untuk attempt ini belum tersedia.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4 text-center">
              <p className="text-base font-semibold text-foreground">
                {data.passed ? "Selamat! 🎉" : "Jangan menyerah!"}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.passed
                  ? "Kamu berhasil melewati ujian ini. Pertahankan hasilmu dan terus tingkatkan kemampuanmu! 💪"
                  : "Terus belajar dan tingkatkan pemahamanmu. Coba lagi dan raih hasil yang lebih baik! 💪"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
