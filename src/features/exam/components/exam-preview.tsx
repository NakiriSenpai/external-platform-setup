import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Clock, Eye, Flag, List, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RichText } from "@/components/common/rich-text";
import { useExam, useExamQuestions, useExamSections } from "@/hooks/exam";
import { AudioButton, AudioManagerProvider } from "@/features/exam-engine/workspace/audio-manager";
import {
  QuestionListDialog,
  type PaletteGroup,
} from "@/features/exam-engine/workspace/question-list-dialog";
import { AnswerShell, QuestionStem } from "@/features/exam-engine/workspace/question-stem";
import {
  WorkspaceBody,
  WorkspaceShell,
} from "@/features/exam-engine/workspace/workspace-shell";
import { cn } from "@/lib/utils";

type Props = { examId: string };

/**
 * Simulasi ujian READ-ONLY untuk admin. Memakai komponen runner asli
 * (WorkspaceShell/Body, QuestionStem, AnswerShell, Daftar Soal) sehingga tampil
 * persis seperti yang dilihat siswa — tanpa attempt, skor, atau riwayat.
 */
export function ExamPreview({ examId }: Props) {
  const navigate = useNavigate();
  const examQuery = useExam(examId);
  const sectionsQuery = useExamSections(examId);
  const questionsQuery = useExamQuestions(examId);

  const questions = useMemo(() => questionsQuery.data ?? [], [questionsQuery.data]);
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [listOpen, setListOpen] = useState(false);

  const paletteGroups = useMemo<PaletteGroup[]>(() => {
    const groups: PaletteGroup[] = [];
    questions.forEach((question, index) => {
      const section = sections.find((s) => s.id === question.section_id);
      const id = section?.id ?? "tanpa-section";
      let group = groups.find((g) => g.id === id);
      if (!group) {
        group = { id, title: section?.title ?? "Soal", items: [] };
        groups.push(group);
      }
      group.items.push({
        questionId: question.id,
        index,
        status: picked[question.id] ? "answered" : "unanswered",
        flagged: Boolean(flags[question.id]),
      });
    });
    return groups;
  }, [questions, sections, picked, flags]);

  const exitPreview = () =>
    void navigate({ to: "/owner/exam-studio/$examId", params: { examId } });

  if (examQuery.isLoading || questionsQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (examQuery.isError || !examQuery.data) {
    return <p className="text-sm text-destructive">Exam tidak ditemukan.</p>;
  }

  const exam = examQuery.data;
  const index = Math.min(activeIndex, Math.max(questions.length - 1, 0));
  const current = questions[index];
  const section = sections.find((s) => s.id === current?.section_id);
  const answeredCount = questions.filter((q) => picked[q.id]).length;

  if (!current) {
    return (
      <section className="space-y-4 p-4">
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada soal untuk disimulasikan.
        </p>
        <Button variant="outline" className="w-full" onClick={exitPreview}>
          Kembali ke Edit Exam
        </Button>
      </section>
    );
  }

  const toggleFlag = () =>
    setFlags((prev) => ({ ...prev, [current.id]: !prev[current.id] }));

  return (
    <AudioManagerProvider attemptId={`preview:${examId}`} lockAfterPlay={false}>
      <WorkspaceShell
        header={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Keluar dari preview"
              onClick={exitPreview}
            >
              <X className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{exam.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Mode preview · tidak tersimpan sebagai attempt siswa
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              <Eye className="mr-1 size-3.5" /> Simulasi
            </Badge>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold tabular-nums">
              <Clock className="size-3.5" /> {exam.duration_minutes}:00
            </span>

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
          <>
            <div className="flex min-w-0 justify-start">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl px-3 text-xs sm:text-sm"
                disabled={index === 0}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="mr-1 size-4" /> Sebelumnya
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-3 text-xs sm:text-sm"
              onClick={() => setListOpen(true)}
            >
              <List className="mr-1.5 size-4" /> Daftar Soal
            </Button>
            <div className="flex justify-end">
              <Button
                type="button"
                className="h-10 rounded-xl px-3 text-xs sm:text-sm"
                disabled={index >= questions.length - 1}
                onClick={() => setActiveIndex((i) => Math.min(questions.length - 1, i + 1))}
              >
                Selanjutnya <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
          </>
        }
      >
        <WorkspaceBody
          question={
            <QuestionStem
              questionId={current.id}
              number={index + 1}
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
                  variant={flags[current.id] ? "default" : "outline"}
                  onClick={toggleFlag}
                >
                  <Flag className="mr-1.5 size-4" />
                  {flags[current.id] ? "Ditandai" : "Tandai"}
                </Button>
              }
            />
          }
          answers={
            <div className="min-w-0">
              <div className="space-y-2">
                {current.answers.map((answer, answerIndex) => (
                  <AnswerShell
                    key={answer.id ?? answer.label}
                    index={answerIndex}
                    selected={picked[current.id] === answer.label}
                    onClick={() =>
                      setPicked((prev) => ({ ...prev, [current.id]: answer.label }))
                    }
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
                      <span
                        className="block"
                        role="presentation"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <AudioButton
                          size="sm"
                          audioKey={`preview:${current.id}:${answer.label}`}
                          src={answer.audio_url}
                          label={`Audio pilihan ${answerIndex + 1}`}
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
                onClick={toggleFlag}
                className={cn(
                  "mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                  flags[current.id]
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
        activeIndex={index}
        mode="exam"
        onJump={setActiveIndex}
      />
    </AudioManagerProvider>
  );
}
