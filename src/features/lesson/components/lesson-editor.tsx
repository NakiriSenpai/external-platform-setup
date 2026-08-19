import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Library,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { PublishGateButton } from "@/features/content-io/components/publish-gate-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import {
  LESSON_BLOCK_LABELS,
  LESSON_STATUS_LABELS,
  blockPreview,
} from "@/features/lesson/lesson.constants";
import { QuestionFormDialog } from "@/features/exam/components/question-form-dialog";
import { QuestionPickerDialog } from "@/features/question-bank/components/question-picker-dialog";
import {
  useAttachLessonQuestions,
  useCreateLessonQuestion,
  useDeleteLessonBlock,
  useDeleteLessonSection,
  useDetachLessonQuestion,
  useLesson,
  useLessonBlocks,
  useLessonQuestions,
  useLessonSections,
  useReorderLessonBlocks,
  useReorderLessonSections,
  useUpdateLessonQuestion,
} from "@/hooks/lesson";
import type { LessonBlockRow, LessonQuestionWithAnswers, LessonSectionRow } from "@/types/lesson";
import { LessonBlockFormDialog } from "./lesson-block-form-dialog";
import { LessonSectionFormDialog } from "./lesson-section-form-dialog";

type Props = { lessonId: string };

export function LessonEditor({ lessonId }: Props) {
  const lessonQuery = useLesson(lessonId);
  const sectionsQuery = useLessonSections(lessonId);
  const blocksQuery = useLessonBlocks(lessonId);
  const questionsQuery = useLessonQuestions(lessonId);

  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionEdit, setSectionEdit] = useState<LessonSectionRow | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockSectionId, setBlockSectionId] = useState("");
  const [blockEdit, setBlockEdit] = useState<LessonBlockRow | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [questionSectionId, setQuestionSectionId] = useState("");
  const [questionEdit, setQuestionEdit] = useState<LessonQuestionWithAnswers | null>(null);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);

  const deleteSection = useDeleteLessonSection();
  const deleteBlock = useDeleteLessonBlock();
  const detachQuestion = useDetachLessonQuestion();
  const reorderSections = useReorderLessonSections();
  const reorderBlocks = useReorderLessonBlocks();
  const createQuestion = useCreateLessonQuestion();
  const updateQuestion = useUpdateLessonQuestion();
  const attachQuestions = useAttachLessonQuestions();

  const sections = sectionsQuery.data ?? [];
  const blocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data]);
  const questions = questionsQuery.data ?? [];

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

  const handleBlockDrop = async (sectionId: string, targetId: string) => {
    if (!dragBlockId || dragBlockId === targetId) return;
    const current = blocks.filter((b) => b.section_id === sectionId);
    const from = current.findIndex((b) => b.id === dragBlockId);
    const to = current.findIndex((b) => b.id === targetId);
    setDragBlockId(null);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    if (!moved) return;
    current.splice(to, 0, moved);
    try {
      await reorderBlocks.mutateAsync(current.map((b) => b.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengurutkan block.");
    }
  };

  const moveBlock = async (sectionId: string, index: number, direction: -1 | 1) => {
    const current = blocks.filter((b) => b.section_id === sectionId);
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const a = current[index];
    const b = current[target];
    if (!a || !b) return;
    current[index] = b;
    current[target] = a;
    try {
      await reorderBlocks.mutateAsync(current.map((item) => item.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengurutkan block.");
    }
  };

  if (lessonQuery.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (lessonQuery.isError || !lessonQuery.data) {
    return <p className="text-sm text-destructive">Lesson tidak ditemukan.</p>;
  }

  const lesson = lessonQuery.data;

  return (
    <section className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/owner/lesson-studio">
          <ArrowLeft className="mr-1 size-4" /> Kembali ke daftar
        </Link>
      </Button>

      <header className="space-y-2 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{lesson.title}</h1>
            <p className="truncate text-xs text-muted-foreground">/{lesson.slug}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant={lesson.status === "published" ? "default" : "secondary"}>
              {LESSON_STATUS_LABELS[lesson.status]}
            </Badge>
            <PublishGateButton
              kind="lesson"
              entityId={lesson.id}
              isPublished={lesson.status === "published"}
              label="Lesson"
            />
          </div>
        </div>
        {lesson.description ? (
          <p className="text-sm text-muted-foreground">{lesson.description}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <p>Kategori: {CATEGORY_LABELS[lesson.category] ?? lesson.category}</p>
          <p>Kesulitan: {EXAM_DIFFICULTY_LABELS[lesson.difficulty]}</p>
          <p>Jumlah section: {sections.length}</p>
          <p>Jumlah soal latihan: {questions.length}</p>
        </div>
        <Button asChild size="sm" variant="secondary" className="min-h-11">
          <Link to="/owner/lesson-studio/$lessonId/preview" params={{ lessonId }}>
            <Eye className="mr-1 size-4" /> Preview Lesson
          </Link>
        </Button>
      </header>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Section</h2>
        <Button
          size="sm"
          className="min-h-11"
          onClick={() => {
            setSectionEdit(null);
            setSectionOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> Section
        </Button>
      </div>

      {sectionsQuery.isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : sections.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada section. Tambahkan section untuk mulai menyusun materi.
        </p>
      ) : (
        <ul className="space-y-4">
          {sections.map((section, index) => {
            const sectionBlocks = blocks.filter((b) => b.section_id === section.id);
            const sectionQuestions = questions.filter((q) => q.section_id === section.id);
            return (
              <li key={section.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {index + 1}. {section.title}
                    </p>
                    {section.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
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
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setSectionEdit(section);
                      setSectionOpen(true);
                    }}
                  >
                    <Pencil className="mr-1 size-4" /> Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={async () => {
                      if (!window.confirm("Hapus section beserta konten dan latihannya?")) return;
                      try {
                        await deleteSection.mutateAsync(section.id);
                        toast.success("Section dihapus.");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
                      }
                    }}
                  >
                    <Trash2 className="mr-1 size-4" /> Hapus
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() => {
                      setBlockSectionId(section.id);
                      setBlockEdit(null);
                      setBlockOpen(true);
                    }}
                  >
                    <Plus className="mr-1 size-4" /> Block
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setQuestionSectionId(section.id);
                      setQuestionEdit(null);
                      setQuestionOpen(true);
                    }}
                  >
                    <Plus className="mr-1 size-4" /> Soal Baru
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => {
                      setQuestionSectionId(section.id);
                      setPickerOpen(true);
                    }}
                  >
                    <Library className="mr-1 size-4" /> Ambil dari Bank
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium">Konten</p>
                  {sectionBlocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Belum ada block konten.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sectionBlocks.map((block, blockIndex) => (
                        <li
                          key={block.id}
                          draggable
                          onDragStart={() => setDragBlockId(block.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => void handleBlockDrop(section.id, block.id)}
                          className="rounded-lg border bg-card p-3"
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <Badge variant="outline">{LESSON_BLOCK_LABELS[block.type]}</Badge>
                              <p className="mt-1 line-clamp-2 text-sm">
                                {blockPreview(block.type, block.content, block.items)}
                              </p>
                              {block.media_url ? (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {block.media_url}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Naikkan block"
                              onClick={() => void moveBlock(section.id, blockIndex, -1)}
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Turunkan block"
                              onClick={() => void moveBlock(section.id, blockIndex, 1)}
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setBlockSectionId(section.id);
                                setBlockEdit(block);
                                setBlockOpen(true);
                              }}
                            >
                              <Pencil className="mr-1 size-4" /> Ubah
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!window.confirm("Hapus block ini?")) return;
                                try {
                                  await deleteBlock.mutateAsync(block.id);
                                  toast.success("Block dihapus.");
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Gagal menghapus block.",
                                  );
                                }
                              }}
                            >
                              <Trash2 className="mr-1 size-4" /> Hapus
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium">Latihan</p>
                  {sectionQuestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Belum ada soal latihan.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sectionQuestions.map((question, qIndex) => (
                        <li key={question.id} className="rounded-lg border bg-card p-3">
                          <p className="text-sm font-medium">
                            {qIndex + 1}. {question.text}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {question.grammar_tags.length > 0
                              ? `Tag: ${question.grammar_tags.map((t) => t.name).join(", ")} · `
                              : ""}
                            {EXAM_DIFFICULTY_LABELS[question.difficulty]}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setQuestionSectionId(section.id);
                                setQuestionEdit(question);
                                setQuestionOpen(true);
                              }}
                            >
                              <Pencil className="mr-1 size-4" /> Ubah
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    "Lepas soal dari lesson? Soal tetap tersimpan di Question Bank.",
                                  )
                                )
                                  return;
                                try {
                                  await detachQuestion.mutateAsync(question.id);
                                  toast.success("Soal dilepas dari lesson.");
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Gagal melepas soal.",
                                  );
                                }
                              }}
                            >
                              <Trash2 className="mr-1 size-4" /> Lepas
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <LessonSectionFormDialog
        open={sectionOpen}
        onOpenChange={setSectionOpen}
        lessonId={lessonId}
        section={sectionEdit}
      />
      {blockSectionId ? (
        <LessonBlockFormDialog
          open={blockOpen}
          onOpenChange={setBlockOpen}
          sectionId={blockSectionId}
          block={blockEdit}
        />
      ) : null}
      {questionSectionId ? (
        <QuestionPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          sectionId={questionSectionId}
          targetLabel="lesson"
          attaching={attachQuestions.isPending}
          onAttach={(questionIds) =>
            attachQuestions.mutateAsync({
              lessonId,
              sectionId: questionSectionId,
              questionIds,
            })
          }
        />
      ) : null}
      {questionSectionId ? (
        <QuestionFormDialog
          open={questionOpen}
          onOpenChange={setQuestionOpen}
          sectionId={questionSectionId}
          question={questionEdit}
          sourceType="lesson"
          createdFrom={lessonId}
          defaultLessonId={lessonId}
          description="Soal latihan otomatis tersimpan di Question Bank dan terhubung ke lesson ini."
          submitting={createQuestion.isPending || updateQuestion.isPending}
          onSubmitQuestion={async (input, questionId) => {
            if (questionId) {
              await updateQuestion.mutateAsync({ id: questionId, input });
            } else {
              await createQuestion.mutateAsync({
                lessonId,
                sectionId: questionSectionId,
                input,
              });
            }
          }}
        />
      ) : null}
    </section>
  );
}
