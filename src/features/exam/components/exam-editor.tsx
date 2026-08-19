import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Library,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PublishGateButton } from "@/features/content-io/components/publish-gate-button";
import {
  useDeleteQuestion,
  useDeleteSection,
  useExam,
  useExamQuestions,
  useExamSections,
  useReorderQuestions,
  useReorderSections,
} from "@/hooks/exam";
import {
  EXAM_SECTION_LABELS,
  EXAM_STATUS_LABELS,
  formatPoints,
  pointsPerQuestion,
} from "@/features/exam/exam.constants";
import type { ExamQuestionWithAnswers, ExamSectionRow } from "@/types/exam";
import { ExamDetailCard } from "./exam-detail-card";
import { QuestionForm } from "./question-form";
import { QuestionPreviewDialog } from "./question-preview-dialog";
import { SectionFormDialog } from "./section-form-dialog";
import { QuestionPickerDialog } from "@/features/question-bank/components/question-picker-dialog";

type Props = { examId: string };

type Composer = { sectionId: string; question: ExamQuestionWithAnswers | null } | null;

/** Halaman Edit Exam — alur vertikal: header → detail → section → soal. */
export function ExamEditor({ examId }: Props) {
  const examQuery = useExam(examId);
  const sectionsQuery = useExamSections(examId);
  const questionsQuery = useExamQuestions(examId);

  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionEdit, setSectionEdit] = useState<ExamSectionRow | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [composer, setComposer] = useState<Composer>(null);
  const [preview, setPreview] = useState<ExamQuestionWithAnswers | null>(null);
  const [pickerSectionId, setPickerSectionId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const deleteSection = useDeleteSection();
  const deleteQuestion = useDeleteQuestion();
  const reorderSections = useReorderSections();
  const reorderQuestions = useReorderQuestions();

  const sections = sectionsQuery.data ?? [];
  const questions = useMemo(() => questionsQuery.data ?? [], [questionsQuery.data]);
  const perQuestion = pointsPerQuestion(questions.length);

  const moveSection = async (index: number, direction: -1 | 1) => {
    const next = [...sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    try {
      await reorderSections.mutateAsync(next.map((s) => s.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengurutkan section.");
    }
  };

  const moveQuestion = async (question: ExamQuestionWithAnswers, direction: -1 | 1) => {
    const current = [...questions];
    const from = current.findIndex((q) => q.id === question.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= current.length) return;
    const [moved] = current.splice(from, 1);
    if (!moved) return;
    current.splice(to, 0, moved);
    try {
      await reorderQuestions.mutateAsync(current.map((q) => q.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengurutkan soal.");
    }
  };

  if (examQuery.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (examQuery.isError || !examQuery.data) {
    return <p className="text-sm text-destructive">Exam tidak ditemukan.</p>;
  }

  const exam = examQuery.data;

  return (
    <section className="space-y-4 pb-8">
      <header className="space-y-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Kembali ke daftar">
            <Link to="/owner/exam-studio">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Edit Exam</h1>
            <p className="truncate text-xs text-muted-foreground">{exam.title}</p>
          </div>
          <Badge variant={exam.status === "published" ? "default" : "secondary"}>
            {EXAM_STATUS_LABELS[exam.status]}
          </Badge>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full min-h-11">
          <Link to="/owner/exam-studio/$examId/preview" params={{ examId }}>
            <PlayCircle className="mr-1 size-4" /> Preview Ujian
          </Link>
        </Button>
      </header>

      <ExamDetailCard exam={exam} />

      <div className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <p className="text-sm font-semibold">Status &amp; Publikasi</p>
        <div className="grid gap-2 [&>button]:min-h-11 [&>button]:w-full sm:grid-cols-2">
          <PublishGateButton
            kind="exam"
            entityId={exam.id}
            isPublished={exam.status === "published"}
            label="Exam"
          />
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {questions.length} soal · {formatPoints(perQuestion)} poin/soal
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Section</h2>
        <Button
          size="sm"
          onClick={() => {
            setSectionEdit(null);
            setSectionOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> Tambah Section
        </Button>
      </div>

      {sectionsQuery.isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada section. Tambahkan section Reading atau Listening terlebih dahulu.
        </p>
      ) : (
        <ul className="space-y-3">
          {sections.map((section, index) => {
            const sectionQuestions = questions.filter((q) => q.section_id === section.id);
            const isCollapsed = collapsed[section.id] ?? false;
            return (
              <li
                key={section.id}
                className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{EXAM_SECTION_LABELS[section.type]}</Badge>
                      <p className="truncate text-sm font-semibold">{section.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sectionQuestions.length} soal
                      {section.instruction ? ` · ${section.instruction}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Naikkan section"
                      onClick={() => void moveSection(index, -1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Turunkan section"
                      onClick={() => void moveSection(index, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Ubah section"
                      onClick={() => {
                        setSectionEdit(section);
                        setSectionOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Hapus section"
                      onClick={async () => {
                        if (!window.confirm("Hapus section beserta seluruh soalnya?")) return;
                        try {
                          await deleteSection.mutateAsync(section.id);
                          toast.success("Section dihapus.");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCollapsed((prev) => ({ ...prev, [section.id]: !isCollapsed }))
                    }
                  >
                    {isCollapsed ? "Tampilkan Soal" : "Sembunyikan Soal"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPickerSectionId(section.id);
                      setPickerOpen(true);
                    }}
                  >
                    <Library className="mr-1 size-4" /> Ambil dari Bank
                  </Button>
                </div>

                {isCollapsed ? null : (
                  <div className="space-y-2">
                    {sectionQuestions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Belum ada soal pada section ini.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {sectionQuestions.map((question) => {
                          const number = questions.findIndex((q) => q.id === question.id) + 1;
                          const editing =
                            composer?.question?.id === question.id &&
                            composer.sectionId === section.id;
                          return (
                            <li
                              key={question.id}
                              className="rounded-xl border border-border bg-background p-2.5"
                            >
                              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">
                                  {number}
                                </span>
                                <button
                                  type="button"
                                  className="min-w-0 truncate text-left text-sm"
                                  onClick={() =>
                                    setComposer(
                                      editing ? null : { sectionId: section.id, question },
                                    )
                                  }
                                >
                                  {question.text}
                                </button>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Pratinjau soal"
                                    onClick={() => setPreview(question)}
                                  >
                                    <Eye className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Ubah soal"
                                    onClick={() =>
                                      setComposer(
                                        editing ? null : { sectionId: section.id, question },
                                      )
                                    }
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Naikkan soal"
                                    onClick={() => void moveQuestion(question, -1)}
                                  >
                                    <ChevronUp className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Turunkan soal"
                                    onClick={() => void moveQuestion(question, 1)}
                                  >
                                    <ChevronDown className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Hapus soal"
                                    onClick={async () => {
                                      if (
                                        !window.confirm(
                                          "Lepas soal ini dari exam? Soal tetap tersimpan di Question Bank.",
                                        )
                                      )
                                        return;
                                      try {
                                        await deleteQuestion.mutateAsync(question.id);
                                        if (editing) setComposer(null);
                                        toast.success("Soal dilepas dari exam.");
                                      } catch (err) {
                                        toast.error(
                                          err instanceof Error
                                            ? err.message
                                            : "Gagal menghapus soal.",
                                        );
                                      }
                                    }}
                                  >
                                    <Trash2 className="size-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              {editing ? (
                                <div className="mt-3 border-t border-border pt-3">
                                  <QuestionForm
                                    examId={examId}
                                    sectionId={section.id}
                                    question={question}
                                    resetKey={question.id}
                                    onDone={() => setComposer(null)}
                                    onCancel={() => setComposer(null)}
                                  />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {composer?.sectionId === section.id && !composer.question ? (
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="mb-3 text-sm font-semibold">Soal Baru</p>
                        <QuestionForm
                          examId={examId}
                          sectionId={section.id}
                          resetKey={`new-${section.id}`}
                          onDone={() => setComposer(null)}
                          onCancel={() => setComposer(null)}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-dashed text-primary"
                        onClick={() => setComposer({ sectionId: section.id, question: null })}
                      >
                        <Plus className="mr-1 size-4" /> Tambah Soal
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <SectionFormDialog
        open={sectionOpen}
        onOpenChange={setSectionOpen}
        examId={examId}
        section={sectionEdit}
      />
      {pickerSectionId ? (
        <QuestionPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          examId={examId}
          sectionId={pickerSectionId}
        />
      ) : null}
      <QuestionPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        question={preview}
      />
    </section>
  );
}
