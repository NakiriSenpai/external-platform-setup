import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExam, useExamQuestions, useExamSections } from "@/hooks/exam";
import { EXAM_SECTION_LABELS } from "@/features/exam/exam.constants";
import { cn } from "@/lib/utils";

type Props = { examId: string };

/**
 * Simulasi ujian READ-ONLY untuk admin: memakai data exam yang sedang diedit,
 * tanpa membuat attempt, tanpa menyentuh status/skor/riwayat siswa.
 */
export function ExamPreview({ examId }: Props) {
  const examQuery = useExam(examId);
  const sectionsQuery = useExamSections(examId);
  const questionsQuery = useExamQuestions(examId);

  const questions = useMemo(() => questionsQuery.data ?? [], [questionsQuery.data]);
  const sections = sectionsQuery.data ?? [];
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});

  if (examQuery.isLoading || questionsQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (examQuery.isError || !examQuery.data) {
    return <p className="text-sm text-destructive">Exam tidak ditemukan.</p>;
  }

  const exam = examQuery.data;
  const question = questions[Math.min(index, Math.max(questions.length - 1, 0))];
  const section = sections.find((s) => s.id === question?.section_id);

  return (
    <section className="min-w-0 space-y-4 pb-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Kembali ke Edit Exam">
          <Link to="/owner/exam-studio/$examId" params={{ examId }}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">Preview Ujian</h1>
          <p className="truncate text-xs text-muted-foreground">{exam.title}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          <Eye className="mr-1 size-3.5" /> Simulasi
        </Badge>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> {exam.duration_minutes} menit
        </span>
        <span>· {questions.length} soal</span>
        <span className="ml-auto">Tidak tersimpan sebagai attempt siswa</span>
      </div>

      {!question ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada soal untuk disimulasikan.
        </p>
      ) : (
        <article className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {section ? (
              <Badge variant="outline">{EXAM_SECTION_LABELS[section.type]}</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Soal {index + 1} dari {questions.length}
            </span>
          </div>

          {section?.instruction ? (
            <p className="break-words text-xs text-muted-foreground">{section.instruction}</p>
          ) : null}

          <p className="break-words text-sm font-medium">{question.text}</p>

          {question.image_url ? (
            <img
              src={question.image_url}
              alt="Gambar soal"
              loading="lazy"
              className="max-h-64 w-full max-w-full rounded-xl border border-border object-contain"
            />
          ) : null}
          {question.audio_url ? (
            <audio controls src={question.audio_url} className="w-full max-w-full">
              <track kind="captions" />
            </audio>
          ) : null}

          <ul className="space-y-2">
            {question.answers.map((answer) => {
              const active = picked[question.id] === answer.label;
              return (
                <li key={answer.id ?? answer.label}>
                  <button
                    type="button"
                    onClick={() => setPicked((prev) => ({ ...prev, [question.id]: answer.label }))}
                    className={cn(
                      "w-full min-w-0 rounded-xl border border-border p-3 text-left text-sm transition-colors",
                      active && "border-primary bg-primary/10",
                    )}
                  >
                    <span className="mr-2 font-semibold">{answer.label}.</span>
                    <span className="break-words">{answer.text}</span>
                    {answer.image_url ? (
                      <img
                        src={answer.image_url}
                        alt={`Gambar jawaban ${answer.label}`}
                        loading="lazy"
                        className="mt-2 max-h-44 w-full max-w-full rounded-lg border border-border object-contain"
                      />
                    ) : null}
                    {answer.audio_url ? (
                      <audio controls src={answer.audio_url} className="mt-2 w-full max-w-full">
                        <track kind="captions" />
                      </audio>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={index <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="mr-1 size-4" /> Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={index >= questions.length - 1}
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Berikutnya <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </section>
  );
}
