import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  ArrowLeft,
  List,
  Loader2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAttemptReview } from "@/hooks/attempt";
import { listLessonTitles } from "@/services/lesson";
import type { AnswerLabel } from "@/types/exam";
import { OpenLessonDialog } from "../components/open-lesson-dialog";
import { AudioButton, AudioManagerProvider } from "./audio-manager";
import { RichText } from "@/components/common/rich-text";
import { CATEGORY_LABELS } from "@/features/exam/exam.constants";
import { QuestionListDialog, type PaletteGroup, type PaletteItem } from "./question-list-dialog";
import { AnswerShell, QuestionStem } from "./question-stem";
import { useAntiCopy } from "./use-anti-copy";
import { WorkspacePagination } from "./workspace-pagination";
import { WorkspaceBody, WorkspaceShell } from "./workspace-shell";

/** Review memakai Workspace yang sama dengan Exam, ditambah pembahasan. */
export function ReviewWorkspace({ attemptId }: { attemptId: string }) {
  return (
    <AudioManagerProvider attemptId={attemptId} lockAfterPlay={false}>
      <ReviewWorkspaceInner attemptId={attemptId} />
    </AudioManagerProvider>
  );
}

function ReviewWorkspaceInner({ attemptId }: { attemptId: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useAttemptReview(attemptId);
  useAntiCopy();
  const [activeIndex, setActiveIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [lessonDialog, setLessonDialog] = useState<{ id: string; title: string } | null>(null);

  const questions = useMemo(() => data?.snapshot.questions ?? [], [data]);
  const lessonIds = questions.map((q) => q.lesson_id).filter((id): id is string => Boolean(id));
  const { data: lessonTitles } = useQuery({
    queryKey: ["lesson-titles", lessonIds.slice().sort().join(",")],
    queryFn: () => listLessonTitles(lessonIds),
    enabled: lessonIds.length > 0,
    staleTime: 300_000,
  });

  const selectedByQuestion = useMemo(
    () =>
      new Map<string, AnswerLabel | null>(
        (data?.answers ?? []).map((row) => [row.question_id, row.selected_label]),
      ),
    [data],
  );

  const paletteGroups: PaletteGroup[] = useMemo(() => {
    const snapshot = data?.snapshot;
    if (!snapshot) return [];
    const items: PaletteItem[] = questions.map((q, index) => {
      const selected = selectedByQuestion.get(q.question_id) ?? null;
      return {
        questionId: q.question_id,
        index,
        status: !selected ? "unanswered" : selected === q.correct_label ? "correct" : "wrong",
        flagged: false,
      };
    });
    const groups: PaletteGroup[] = [];
    for (const s of snapshot.sections) {
      const list = items.filter((p) => questions[p.index]?.section_id === s.section_id);
      if (list.length > 0) groups.push({ id: s.section_id, title: s.title, items: list });
    }
    const grouped = new Set(groups.flatMap((g) => g.items.map((i) => i.questionId)));
    const rest = items.filter((p) => !grouped.has(p.questionId));
    if (rest.length > 0) groups.push({ id: "lainnya", title: "Lainnya", items: rest });
    return groups;
  }, [data, questions, selectedByQuestion]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Memuat review…
      </div>
    );
  }

  const question = questions[activeIndex];
  if (isError || !data || !question) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium text-foreground">
            {error instanceof Error ? error.message : "Review tidak dapat dimuat."}
          </p>
          <Button onClick={() => void navigate({ to: "/ujian" })}>Kembali ke daftar ujian</Button>
        </CardContent>
      </Card>
    );
  }

  const snapshot = data.snapshot;
  const section = snapshot.sections.find((s) => s.section_id === question.section_id);
  const selected = selectedByQuestion.get(question.question_id) ?? null;
  const correct = question.correct_label;
  const status = !selected ? "kosong" : selected === correct ? "benar" : "salah";
  const lessonTitle = question.lesson_id ? lessonTitles?.[question.lesson_id] : undefined;

  const exitWorkspace = (to: "hasil" | "ujian") => {
    if (to === "hasil") {
      void navigate({ to: "/ujian/hasil/$attemptId", params: { attemptId } });
    } else {
      void navigate({ to: "/ujian" });
    }
  };

  const openLesson = () => {
    if (!lessonDialog) return;
    const lessonId = lessonDialog.id;
    setLessonDialog(null);
    void navigate({ to: "/materi/lesson/$lessonId", params: { lessonId } });
  };

  return (
    <>
      <WorkspaceShell
        header={
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Kembali"
              className="size-9 shrink-0 rounded-xl"
              onClick={() => exitWorkspace("hasil")}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground sm:text-base">
                {snapshot.exam.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {CATEGORY_LABELS[snapshot.exam.category] ?? snapshot.exam.category}
                {section ? ` · ${section.title}` : ""} · {questions.length} soal
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 rounded-full">
              Review Jawaban
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 rounded-xl"
              onClick={() => exitWorkspace("ujian")}
            >
              Keluar
            </Button>
          </>
        }

        footer={
          <WorkspacePagination
            activeIndex={activeIndex}
            total={questions.length}
            onPrev={() => setActiveIndex((i) => Math.max(0, i - 1))}
            onNext={() => setActiveIndex((i) => Math.min(questions.length - 1, i + 1))}
            onOpenList={() => setListOpen(true)}
          />
        }
      >
        <WorkspaceBody
          question={
            <QuestionStem
              questionId={question.question_id}
              number={activeIndex + 1}
              total={questions.length}
              sectionTitle={section?.title}
              sectionInstruction={section?.instruction}
              instruction={question.instruction}
              text={question.text}
              imageUrl={question.image_url}
              audioUrl={question.audio_url}
              right={
                <Badge
                  variant={
                    status === "benar"
                      ? "default"
                      : status === "salah"
                        ? "destructive"
                        : "secondary"
                  }
                  className="gap-1.5"
                >
                  {status === "benar" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : status === "salah" ? (
                    <XCircle className="size-3.5" />
                  ) : (
                    <CircleSlash className="size-3.5" />
                  )}
                  {status === "benar" ? "Benar" : status === "salah" ? "Salah" : "Tidak dijawab"}
                </Badge>
              }
            />
          }
          answers={
            <div>
              <div className="space-y-2">
                {question.answers.map((answer, answerIndex) => {
                  const isCorrect = answer.label === correct;
                  const isChosen = answer.label === selected;
                  return (
                    <AnswerShell
                      key={answer.label}
                      index={answerIndex}
                      tone={isCorrect ? "correct" : isChosen ? "wrong" : undefined}
                    >
                      {answer.text ? (
                        <RichText
                          html={answer.text}
                          as="span"
                          className="block text-sm text-foreground"
                        />
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
                        <AudioButton
                          size="sm"
                          audioKey={`review:${question.question_id}:${answer.label}`}
                          src={answer.audio_url}
                          label={`Putar audio pilihan ${answerIndex + 1}`}
                        />
                      ) : null}
                      <span className="flex flex-wrap gap-2 text-xs">
                        {isChosen ? <Badge variant="outline">Jawaban Anda</Badge> : null}
                        {isCorrect ? <Badge variant="outline">Jawaban Benar</Badge> : null}
                      </span>
                    </AnswerShell>
                  );
                })}
              </div>
            </div>
          }
          explanation={
            <section className="rounded-2xl border border-border bg-card shadow-sm">
              <p className="border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary">
                Pembahasan
              </p>
              <div className="space-y-3 p-4 text-sm">
                {question.explanation?.trim() ? (
                  <RichText html={question.explanation} className="text-foreground" />
                ) : (
                  <p className="text-foreground">Belum ada pembahasan.</p>
                )}
                <div className="grid gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Materi Terkait
                    </p>
                    {question.lesson_id && lessonTitle ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-auto max-w-full whitespace-normal py-1.5 text-left"
                        onClick={() =>
                          setLessonDialog({ id: question.lesson_id as string, title: lessonTitle })
                        }
                      >
                        <BookOpen className="mr-1.5 size-4 shrink-0" />
                        {lessonTitle}
                      </Button>
                    ) : (
                      <p className="text-muted-foreground">Belum dihubungkan.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          }
        />
      </WorkspaceShell>

      <QuestionListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        groups={paletteGroups}
        activeIndex={activeIndex}
        mode="review"
        onJump={setActiveIndex}
      />

      <OpenLessonDialog
        open={Boolean(lessonDialog)}
        lessonTitle={lessonDialog?.title ?? ""}
        onOpenChange={(open) => !open && setLessonDialog(null)}
        onConfirm={openLesson}
      />
    </>
  );
}
