import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  ChevronsRight,
  Clock,
  Delete,
  FileText,
  Loader2,
  ShieldAlert,
  SkipForward,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/auth";
import {
  useAnswerColorTest,
  useCancelAttemptFromColorTest,
  useColorTestSession,
  useFinishColorTest,
  useSkipColorTest,
} from "@/hooks/color-test";
import { useExamTimer } from "@/features/exam-engine/hooks/use-exam-timer";
import { WorkspaceShell } from "@/features/exam-engine/workspace/workspace-shell";
import { useColorTestForeground } from "../hooks/use-color-test-foreground";
import { cn } from "@/lib/utils";
import type { ColorTestPayload } from "@/types/color-test";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Tes Buta Warna — tahap wajib setelah submit ujian.
 * Randomisasi, penilaian, batas skip, dan finalisasi waktu dilakukan di server.
 */
export function ColorTestWorkspace({ attemptId }: { attemptId: string }) {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { data, isLoading, isError, error } = useColorTestSession(
    attemptId,
    !authLoading && isAuthenticated,
  );

  const answerMutation = useAnswerColorTest(attemptId);
  const skipMutation = useSkipColorTest(attemptId);
  const finishMutation = useFinishColorTest(attemptId);
  const cancelMutation = useCancelAttemptFromColorTest();

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const finishedRef = useRef(false);
  const leavingRef = useRef(false);

  const session = data?.session;
  const questions = useMemo(() => data?.questions ?? [], [data]);
  const running = session?.status === "in_progress";
  const done = Boolean(session) && !running;

  // Proteksi foreground (blur + overlay) khusus halaman ini.
  const { paused, resume } = useColorTestForeground(Boolean(running));

  const current = questions[index];
  const answeredCount = questions.filter((q) => q.answered).length;
  const skipLeft = Math.max(0, (session?.max_skip ?? 3) - (session?.skipped_count ?? 0));
  const maxWrong = Math.max(0, (session?.total_questions ?? 12) - (session?.min_correct ?? 7));

  const {
    label: timerLabel,
    remaining,
    isReady,
  } = useExamTimer(session?.expires_at, Boolean(running), session?.started_at);

  // Pindah otomatis ke soal pertama yang belum dijawab.
  useEffect(() => {
    if (!running || questions.length === 0) return;
    if (current && !current.answered) return;
    const next = questions.findIndex((q) => !q.answered);
    if (next >= 0 && next !== index) setIndex(next);
  }, [running, questions, current, index]);

  useEffect(() => {
    setInput("");
  }, [index]);

  const finalize = useCallback(
    async (reason: "manual" | "time_up") => {
      if (!session || finishedRef.current) return;
      finishedRef.current = true;
      try {
        await finishMutation.mutateAsync({ sessionId: session.id, reason });
      } catch (err) {
        finishedRef.current = false;
        toast.error(err instanceof Error ? err.message : "Gagal menyelesaikan tes.");
      }
    },
    [finishMutation, session],
  );

  /**
   * Keluar paksa: Color Test dibatalkan DAN attempt ujian induk dibatalkan
   * di server (transactional). Attempt tidak pernah dianggap selesai.
   */
  const cancelAttempt = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    finishedRef.current = true;
    try {
      await cancelMutation.mutateAsync(attemptId);
      toast.info("Ujian dibatalkan karena Anda keluar dari tes buta warna.");
      void navigate({ to: "/ujian" });
    } catch (err) {
      leavingRef.current = false;
      finishedRef.current = false;
      toast.error(err instanceof Error ? err.message : "Gagal membatalkan ujian.");
    }
  }, [attemptId, cancelMutation, navigate]);

  // Waktu habis: soal yang belum dijawab dinilai SALAH oleh server.
  useEffect(() => {
    if (running && isReady && remaining <= 0) void finalize("time_up");
  }, [running, isReady, remaining, finalize]);

  useEffect(() => {
    if (done) finishedRef.current = true;
  }, [done]);

  // Back Android/browser: konfirmasi dulu; keluar = attempt DIBATALKAN.
  useBlocker({
    shouldBlockFn: () => {
      if (!running || leavingRef.current) return false;
      setConfirmExit(true);
      return true;
    },
    enableBeforeUnload: false,
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Menyiapkan tes buta warna…
      </div>
    );
  }

  if (isError || !session) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium text-foreground">
            {error instanceof Error ? error.message : "Tes buta warna tidak dapat dimuat."}
          </p>
          <Button onClick={() => void navigate({ to: "/ujian" })}>Kembali ke daftar ujian</Button>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return <ColorTestFinished payload={data as ColorTestPayload} attemptId={attemptId} />;
  }

  const busy =
    answerMutation.isPending ||
    skipMutation.isPending ||
    finishMutation.isPending ||
    cancelMutation.isPending;

  const submitAnswer = () => {
    if (!current || !input || busy) return;
    answerMutation.mutate(
      { sessionId: session.id, questionId: current.question_id, answer: input },
      {
        onSuccess: () => setInput(""),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Gagal menyimpan jawaban."),
      },
    );
  };

  const skip = () => {
    if (!current || busy) return;
    skipMutation.mutate(
      { sessionId: session.id, questionId: current.question_id },
      {
        onSuccess: () => setInput(""),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal melewati soal."),
      },
    );
  };

  return (
    <>
      <WorkspaceShell
        contentBlurred={paused}
        overlay={
          paused ? (
            <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-md">
              <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning">
                  <ShieldAlert className="size-6" />
                </span>
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-foreground">Tes masih berlangsung</h2>
                  <p className="text-sm text-muted-foreground">
                    Anda meninggalkan halaman tes. Kembali ke tes untuk melanjutkan.
                  </p>
                </div>
                <Button className="h-11 w-full rounded-xl font-semibold" onClick={resume}>
                  Lanjutkan Tes
                </Button>
              </div>
            </div>
          ) : null
        }
        header={
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Kembali"
              className="size-8 shrink-0 rounded-lg"
              onClick={() => setConfirmExit(true)}
            >
              <ArrowLeft className="size-4.5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-foreground">
                Tes Buta Warna
              </p>
            </div>

            {/* Statistik ringkas + progress (satu-satunya tempat aturan ditampilkan) */}
            <div className="w-full min-w-0 space-y-1.5">
              <div className="grid grid-cols-5 gap-1 rounded-xl border border-border bg-card px-1.5 py-1.5">
                <Stat icon={FileText} label="Soal" value={`${index + 1}/${questions.length}`} />
                <Stat
                  icon={Clock}
                  label="Waktu"
                  value={timerLabel}
                  tone={remaining <= 30 ? "text-destructive" : "text-primary"}
                />
                <Stat
                  icon={CheckCircle2}
                  label="Min. Lulus"
                  value={`${session.min_correct} Benar`}
                  tone="text-success"
                />
                <Stat
                  icon={XCircle}
                  label="Maks. Salah"
                  value={`${maxWrong} Salah`}
                  tone="text-destructive"
                />
                <Stat
                  icon={ChevronsRight}
                  label="Maks. Skip"
                  value={`${session.max_skip} Kali`}
                  tone="text-warning"
                />
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-primary-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </>
        }
        footer={
          <div className="col-span-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !current}
              className="h-11 flex-col gap-0 rounded-xl py-1"
              onClick={skip}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                <SkipForward className="size-4" /> Lewati
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                Sisa {skipLeft} kali
              </span>
            </Button>
            <Button
              type="button"
              disabled={busy || !current || input.length === 0}
              className="h-11 rounded-xl text-[13px] font-semibold"
              onClick={submitAnswer}
            >
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Soal Berikutnya <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        }
      >
        <div className="mx-auto w-full max-w-md">
          {current ? (
            <Card className="rounded-2xl">
              <CardContent className="space-y-2.5 p-3">
                <p className="text-[13px] font-semibold text-foreground">
                  Angka berapa yang Anda lihat?
                </p>

                <img
                  src={current.image_url}
                  alt={`Soal tes buta warna ${index + 1}`}
                  draggable={false}
                  className="mx-auto aspect-square w-full max-w-[min(58vw,13rem)] rounded-full object-contain sm:max-w-[15rem]"
                />

                <div className="flex h-12 items-center justify-center rounded-xl bg-primary-muted text-2xl font-bold tabular-nums text-foreground">
                  {input || <span className="text-muted-foreground">—</span>}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {KEYS.map((key) => (
                    <KeypadButton
                      key={key}
                      disabled={busy || input.length >= 2}
                      onClick={() => setInput((prev) => (prev + key).slice(0, 2))}
                    >
                      {key}
                    </KeypadButton>
                  ))}
                  <KeypadButton
                    className="col-span-2"
                    disabled={busy || input.length >= 2}
                    onClick={() => setInput((prev) => (prev + "0").slice(0, 2))}
                  >
                    0
                  </KeypadButton>
                  <KeypadButton
                    variant="muted"
                    disabled={busy || input.length === 0}
                    onClick={() => setInput((prev) => prev.slice(0, -1))}
                    aria-label="Hapus satu digit"
                  >
                    <Delete className="mx-auto size-5 text-primary" />
                  </KeypadButton>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 text-center text-sm text-muted-foreground">
                Menilai jawaban Anda…
              </CardContent>
            </Card>
          )}
        </div>
      </WorkspaceShell>

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari Tes Buta Warna?</AlertDialogTitle>
            <AlertDialogDescription>
              Jika Anda keluar sekarang, ujian ini akan dibatalkan dan tidak dapat dilanjutkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tetap Mengerjakan</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                setConfirmExit(false);
                void cancelAttempt();
              }}
            >
              Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 space-y-0.5 text-center">
      <p className="truncate text-[9px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "flex items-center justify-center gap-1 text-[11px] font-bold tabular-nums text-foreground",
          tone,
        )}
      >
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}

function KeypadButton({
  children,
  className,
  variant = "outline",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "muted" }) {
  return (
    <button
      type="button"
      className={cn(
        "h-12 rounded-xl border text-lg font-semibold text-foreground transition-colors disabled:opacity-40",
        variant === "muted"
          ? "border-transparent bg-primary-muted"
          : "border-border bg-card hover:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Layar hasil singkat sebelum masuk ke Hasil Ujian. */
function ColorTestFinished({
  payload,
  attemptId,
}: {
  payload: ColorTestPayload;
  attemptId: string;
}) {
  const navigate = useNavigate();
  const s = payload.session;
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center p-4">
      <Card className="w-full rounded-2xl">
        <CardContent className="space-y-4 p-6 text-center">
          <div
            className={cn(
              "mx-auto grid size-14 place-items-center rounded-2xl",
              s.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {s.passed ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-foreground">Tes Buta Warna Selesai</h1>
            <p className={cn("text-sm font-semibold", s.passed ? "text-success" : "text-destructive")}>
              {s.passed ? "LULUS" : "TIDAK LULUS"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Box label="Benar" value={`${s.correct_count}/${s.total_questions}`} />
            <Box label="Salah" value={`${s.wrong_count}`} />
            <Box label="Skip" value={`${s.skipped_count}/${s.max_skip}`} />
          </div>
          <Button
            className="w-full"
            onClick={() => void navigate({ to: "/ujian/hasil/$attemptId", params: { attemptId } })}
          >
            Lihat Hasil Ujian
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <p className="text-base font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
