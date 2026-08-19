import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  List,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/auth";
import { useAttemptSession, useSaveAnswer, useSetFlag, useSubmitAttempt } from "@/hooks/attempt";
import { ExamAttemptExpiredError } from "@/services/attempt";

import type { AnswerLabel } from "@/types/exam";
import type { AttemptAnswerRow } from "@/types/attempt";
import { ATTEMPT_STATUS_LABELS } from "@/types/attempt";
import { SubmitExamDialog } from "../components/exam-dialogs";
import { AudioButton, AudioManagerProvider, useAudioManager } from "./audio-manager";
import { CATEGORY_LABELS } from "@/features/exam/exam.constants";
import { RichText } from "@/components/common/rich-text";
import { cn } from "@/lib/utils";
import { QuestionListDialog, type PaletteGroup, type PaletteItem } from "./question-list-dialog";
import { AnswerShell, QuestionStem } from "./question-stem";
import { useExamTimer } from "../hooks/use-exam-timer";
import { useAntiCopy } from "./use-anti-copy";
import { useExamSecurity } from "./use-exam-security";
import { useExamSensorLayout } from "./use-orientation";
import { WorkspacePagination } from "./workspace-pagination";
import { WorkspaceBody, WorkspaceShell } from "./workspace-shell";

type LocalAnswer = { label: AnswerLabel | null; flagged: boolean };

export function ExamWorkspace({ attemptId }: { attemptId: string }) {
  return (
    <AudioManagerProvider attemptId={attemptId} lockAfterPlay>
      <ExamWorkspaceInner attemptId={attemptId} />
    </AudioManagerProvider>
  );
}

function ExamWorkspaceInner({ attemptId }: { attemptId: string }) {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const {
    data,
    isLoading: sessionLoading,
    isError,
    error,
  } = useAttemptSession(attemptId, !authLoading && isAuthenticated);
  const expiredAttempt = error instanceof ExamAttemptExpiredError;
  // Exam Runner tidak pernah dirender sebelum attempt + snapshot tersedia.
  const isLoading = authLoading || (isAuthenticated && !isError && (sessionLoading || !data));

  // Attempt yang sudah lewat waktu: sudah difinalisasi di data layer → buka hasil.
  useEffect(() => {
    if (!expiredAttempt) return;
    toast.info("Waktu ujian telah habis.");
    void navigate({ to: "/ujian/color-test/$attemptId", params: { attemptId } });
  }, [expiredAttempt, attemptId, navigate]);

  const saveAnswer = useSaveAnswer();
  const setFlagMutation = useSetFlag();
  const submit = useSubmitAttempt();
  const { busy: audioBusy } = useAudioManager();
  const layout = useExamSensorLayout();
  useAntiCopy();

  const [activeIndex, setActiveIndex] = useState(0);
  const [local, setLocal] = useState<Record<string, LocalAnswer>>({});
  const [listOpen, setListOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const attempt = data?.attempt;
  const snapshot = data?.snapshot;
  const isRunning = attempt?.status === "in_progress";

  useEffect(() => {
    if (!data) return;
    const restored: Record<string, LocalAnswer> = {};
    for (const row of data.answers as AttemptAnswerRow[]) {
      restored[row.question_id] = { label: row.selected_label, flagged: row.is_flagged };
    }
    setLocal(restored);
  }, [data]);

  // Sprint 21: Fullscreen API tidak lagi dipakai (memicu system education toast di Android/TWA).
  // Exam Workspace memenuhi viewport aplikasi lewat layout (fixed inset-0), bukan fullscreen.

  const finish = useCallback(
    async (reason: "manual" | "time_up") => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setConfirmSubmit(false);
      try {
        await submit.mutateAsync({ attemptId, reason });
        toast.success(
          reason === "time_up"
            ? "Waktu habis. Ujian dikumpulkan otomatis."
            : "Ujian berhasil dikumpulkan.",
        );
        // Tahap wajib setelah submit: Tes Buta Warna (bukan langsung Hasil Ujian).
        void navigate({ to: "/ujian/color-test/$attemptId", params: { attemptId } });
      } catch (submitError) {
        submittingRef.current = false;
        setSubmitting(false);
        toast.error(
          submitError instanceof Error ? submitError.message : "Gagal mengumpulkan ujian.",
        );
      }
    },
    [attemptId, navigate, submit],
  );

  const {
    label: timerLabel,
    remaining,
    isReady: timerReady,
  } = useExamTimer(attempt?.expires_at, Boolean(isRunning) && !submitting, attempt?.started_at);

  useEffect(() => {
    if (isRunning && timerReady && remaining <= 0) void finish("time_up");
  }, [isRunning, timerReady, remaining, finish]);

  // Secure Mode: satu-satunya mekanisme keluar dari ujian (tidak ada exit dialog lama).
  const security = useExamSecurity({
    enabled: Boolean(isRunning) && !submitting,
    attemptId,
    onLimitReached: () => void finish("manual"),
  });
  const registerViolation = security.registerViolation;

  // Android back / browser back / navigasi ke route lain → 1 violation, user tetap di ujian.
  useBlocker({
    shouldBlockFn: () => {
      if (!isRunning || submittingRef.current) return false;
      registerViolation();
      return true;
    },
    enableBeforeUnload: false,
  });

  const questions = useMemo(() => snapshot?.questions ?? [], [snapshot]);
  const current = questions[activeIndex];
  const section = snapshot?.sections.find((s) => s.section_id === current?.section_id);

  const paletteGroups: PaletteGroup[] = useMemo(() => {
    if (!snapshot) return [];
    const items: PaletteItem[] = questions.map((q, index) => ({
      questionId: q.question_id,
      index,
      status: local[q.question_id]?.label ? "answered" : "unanswered",
      flagged: Boolean(local[q.question_id]?.flagged),
    }));
    const groups: PaletteGroup[] = [];
    for (const s of snapshot.sections) {
      const list = items.filter((p) => questions[p.index]?.section_id === s.section_id);
      if (list.length > 0) groups.push({ id: s.section_id, title: s.title, items: list });
    }
    const grouped = new Set(groups.flatMap((g) => g.items.map((i) => i.questionId)));
    const rest = items.filter((p) => !grouped.has(p.questionId));
    if (rest.length > 0) groups.push({ id: "lainnya", title: "Lainnya", items: rest });
    return groups;
  }, [snapshot, questions, local]);

  const openQuestionList = () => setListOpen(true);

  const answeredCount = Object.values(local).filter((a) => a.label).length;
  const locked = audioBusy;

  const choose = (label: AnswerLabel) => {
    if (!current || locked || !isRunning) return;
    setLocal((prev) => ({
      ...prev,
      [current.question_id]: { label, flagged: prev[current.question_id]?.flagged ?? false },
    }));
    saveAnswer.mutate(
      { attemptId, questionId: current.question_id, questionIndex: activeIndex, label },
      { onError: () => toast.error("Jawaban gagal disimpan. Periksa koneksi Anda.") },
    );
  };

  const toggleFlag = () => {
    if (!current || locked || !isRunning) return;
    const next = !local[current.question_id]?.flagged;
    setLocal((prev) => ({
      ...prev,
      [current.question_id]: { label: prev[current.question_id]?.label ?? null, flagged: next },
    }));
    setFlagMutation.mutate({
      attemptId,
      questionId: current.question_id,
      questionIndex: activeIndex,
      flagged: next,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Memulihkan ujian…
      </div>
    );
  }

  if (!authLoading && !isAuthenticated) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium text-foreground">Sesi Anda berakhir. Silakan masuk kembali.</p>
          <Button onClick={() => void navigate({ to: "/login" })}>Masuk</Button>
        </CardContent>
      </Card>
    );
  }

  if (isError || !attempt || !snapshot || !current) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium text-foreground">
            {error instanceof Error ? error.message : "Ujian tidak dapat dimuat."}
          </p>
          <Button onClick={() => void navigate({ to: "/ujian" })}>Kembali ke daftar ujian</Button>
        </CardContent>
      </Card>
    );
  }

  if (!isRunning) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">{snapshot.exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            Attempt ini sudah selesai ({ATTEMPT_STATUS_LABELS[attempt.status]}).
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={() =>
                void navigate({ to: "/ujian/hasil/$attemptId", params: { attemptId } })
              }
            >
              Lihat hasil
            </Button>
            <Button variant="outline" onClick={() => void navigate({ to: "/ujian" })}>
              Kembali ke daftar ujian
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <WorkspaceShell
        contentBlurred={security.paused}
        overlay={
          security.paused ? (
            <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/60 p-6 backdrop-blur-md">
              <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
                <span
                  className={cn(
                    "mx-auto flex size-14 items-center justify-center rounded-2xl",
                    security.limitReached
                      ? "bg-destructive/15 text-destructive"
                      : "bg-warning/15 text-warning",
                  )}
                >
                  <ShieldAlert className="size-7" />
                </span>
                {security.limitReached ? (
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-bold text-foreground">
                      Batas Pelanggaran Tercapai
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Anda telah meninggalkan mode ujian sebanyak {security.max} kali. Ujian akan
                      dikumpulkan secara otomatis.
                    </p>
                    <p className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-foreground">
                      <Loader2 className="size-4 animate-spin" /> Mengumpulkan ujian…
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-bold text-foreground">
                        Mode Ujian Terdeteksi Keluar
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Anda telah meninggalkan halaman ujian.
                      </p>
                      <p className="text-sm font-semibold text-warning">
                        Peringatan {security.violations} dari {security.max}
                      </p>
                    </div>
                    <Button
                      className="h-11 w-full rounded-xl font-semibold"
                      onClick={security.resume}
                    >
                      Kembali ke Ujian
                    </Button>
                  </>
                )}
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
              onClick={() => void navigate({ to: "/ujian" })}
            >
              <ArrowLeft className="size-4.5" />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-foreground">
                {snapshot.exam.title}
              </p>
              <p className="truncate text-[10px] leading-tight text-muted-foreground">
                {CATEGORY_LABELS[snapshot.exam.category] ?? snapshot.exam.category}
                {section ? ` · ${section.title}` : ""}
              </p>
            </div>

            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight",
                security.violations > 0
                  ? "bg-warning/15 text-warning"
                  : "bg-success/15 text-success",
              )}
            >
              <ShieldCheck className="size-3.5 shrink-0" />
              <span className="flex flex-col">
                <span>Mode Secure</span>
                <span className="tabular-nums opacity-90">
                  Aktif · {security.violations}/{security.max}
                </span>
              </span>
            </span>

            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-bold tabular-nums",
                remaining <= 60
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary-muted text-primary",
              )}
            >
              <Clock className="size-3.5" />
              {timerLabel}
            </span>

            <Button
              size="sm"
              className="h-8 shrink-0 rounded-lg px-3 text-xs"
              variant="destructive"
              disabled={locked}
              onClick={() => setConfirmSubmit(true)}
            >
              Submit
            </Button>

            <div className="flex w-full min-w-0 items-center gap-2">
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-primary-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {answeredCount}/{questions.length} terjawab
              </span>
            </div>
          </>
        }
        footer={
          <WorkspacePagination
            activeIndex={activeIndex}
            total={questions.length}
            disabled={locked}
            onPrev={() => setActiveIndex((i) => Math.max(0, i - 1))}
            onNext={() => setActiveIndex((i) => Math.min(questions.length - 1, i + 1))}
            onOpenList={openQuestionList}
            onSubmit={() => setConfirmSubmit(true)}
            submitPending={submitting}
          />
        }

      >
        <WorkspaceBody
          layout={layout}
          question={
            <QuestionStem
              questionId={current.question_id}
              number={activeIndex + 1}
              total={questions.length}
              sectionTitle={section?.title}
              sectionInstruction={section?.instruction}
              instruction={current.instruction}
              text={current.text}
              imageUrl={current.image_url}
              audioUrl={current.audio_url}
              right={
                <Button
                  type="button"
                  size="sm"
                  variant={local[current.question_id]?.flagged ? "default" : "outline"}
                  disabled={locked}
                  onClick={toggleFlag}
                >
                  <Flag className="mr-1.5 size-4" />
                  {local[current.question_id]?.flagged ? "Ditandai" : "Tandai"}
                </Button>
              }
            />
          }
          answers={
            <div>
              <div className="space-y-2">
                {current.answers.map((answer, answerIndex) => (
                  <AnswerShell
                    key={answer.label}
                    index={answerIndex}
                    selected={local[current.question_id]?.label === answer.label}
                    disabled={locked}
                    onClick={() => choose(answer.label)}
                  >
                    {answer.text ? (
                      <RichText html={answer.text} as="span" className="block text-sm text-foreground" />
                    ) : null}
                    {answer.image_url ? (
                      <img
                        src={answer.image_url}
                        alt={`Pilihan ${answerIndex + 1}`}
                        loading="lazy"
                        draggable={false}
                        className="max-h-20 w-auto max-w-[min(100%,10rem)] rounded-lg border border-border object-contain sm:max-h-24"
                      />
                    ) : null}
                    {answer.audio_url ? (
                      <span
                        className="block"
                        role="presentation"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <AudioButton
                          size="sm"
                          audioKey={`${current.question_id}:${answer.label}`}
                          src={answer.audio_url}
                          label={`Putar audio pilihan ${answerIndex + 1}`}
                        />
                      </span>
                    ) : null}
                    {!answer.text && !answer.image_url && !answer.audio_url ? (
                      <span className="block text-sm text-muted-foreground">
                        Pilihan {answerIndex + 1}
                      </span>
                    ) : null}
                  </AnswerShell>
                ))}
              </div>

              <button
                type="button"
                disabled={locked}
                onClick={toggleFlag}
                className={cn(
                  "mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                  local[current.question_id]?.flagged
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Flag className="size-4" />
                Saya tidak yakin dengan jawaban ini
              </button>
            </div>

          }
        />
      </WorkspaceShell>

      <QuestionListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        groups={paletteGroups}
        activeIndex={activeIndex}
        mode="exam"
        onJump={setActiveIndex}
      />

      <SubmitExamDialog
        open={confirmSubmit}
        unanswered={questions.length - answeredCount}
        onOpenChange={setConfirmSubmit}
        onConfirm={() => void finish("manual")}
        pending={submitting}
      />
    </>
  );
}
