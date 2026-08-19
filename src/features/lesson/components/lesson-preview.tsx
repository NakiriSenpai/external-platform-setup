import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import { LESSON_STATUS_LABELS } from "@/features/lesson/lesson.constants";
import { useLesson, useLessonBlocks, useLessonQuestions, useLessonSections } from "@/hooks/lesson";
import type { LessonBlockRow } from "@/types/lesson";

function BlockView({ block }: { block: LessonBlockRow }) {
  switch (block.type) {
    case "heading":
      return <h3 className="text-base font-semibold">{block.content}</h3>;
    case "paragraph":
      return <p className="text-sm leading-relaxed">{block.content}</p>;
    case "bullet_list":
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {block.items.map((item, i) => (
            <li key={`${block.id}-${i}`}>{item}</li>
          ))}
        </ul>
      );
    case "image":
      return block.media_url ? (
        <img
          src={block.media_url}
          alt={block.content ?? "Gambar materi"}
          loading="lazy"
          className="w-full rounded-lg object-cover"
        />
      ) : null;
    case "audio":
      return block.media_url ? (
        <audio controls src={block.media_url} className="w-full">
          <track kind="captions" />
        </audio>
      ) : null;
    case "callout":
      return (
        <div className="rounded-lg border-l-4 border-primary bg-muted/60 p-3 text-sm">
          {block.content}
        </div>
      );
    case "divider":
      return <Separator />;
    case "grammar_highlight":
      return (
        <div className="rounded-lg border border-dashed p-3">
          {block.grammar_tag ? (
            <Badge variant="secondary" className="mb-2">
              {block.grammar_tag.name}
            </Badge>
          ) : null}
          <p className="text-sm leading-relaxed">{block.content}</p>
        </div>
      );
    default:
      return null;
  }
}

export function LessonPreview({
  lessonId,
  variant = "studio",
}: {
  lessonId: string;
  /** "siswa" dipakai halaman Materi: tanpa tombol editor & tanpa badge status. */
  variant?: "studio" | "siswa";
}) {
  const lessonQuery = useLesson(lessonId);
  const sectionsQuery = useLessonSections(lessonId);
  const blocksQuery = useLessonBlocks(lessonId);
  const questionsQuery = useLessonQuestions(lessonId);

  if (lessonQuery.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (lessonQuery.isError || !lessonQuery.data) {
    return <p className="text-sm text-destructive">Lesson tidak ditemukan.</p>;
  }

  const lesson = lessonQuery.data;
  const sections = sectionsQuery.data ?? [];
  const blocks = blocksQuery.data ?? [];
  const questions = questionsQuery.data ?? [];

  return (
    <article className="space-y-5">
      {variant === "studio" ? (
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/owner/lesson-studio/$lessonId" params={{ lessonId }}>
            <ArrowLeft className="mr-1 size-4" /> Kembali ke editor
          </Link>
        </Button>
      ) : null}

      <header className="space-y-2">
        {lesson.thumbnail_url ? (
          <img
            src={lesson.thumbnail_url}
            alt={`Sampul ${lesson.title}`}
            className="w-full rounded-xl object-cover"
          />
        ) : null}
        <h1 className="text-xl font-semibold">{lesson.title}</h1>
        {lesson.description ? (
          <p className="text-sm text-muted-foreground">{lesson.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{CATEGORY_LABELS[lesson.category] ?? lesson.category}</Badge>
          <Badge variant="outline">{EXAM_DIFFICULTY_LABELS[lesson.difficulty]}</Badge>
          {variant === "studio" ? (
            <Badge variant="outline">{LESSON_STATUS_LABELS[lesson.status]}</Badge>
          ) : null}
        </div>
      </header>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Lesson belum memiliki konten.
        </p>
      ) : (
        sections.map((section, index) => {
          const sectionBlocks = blocks.filter((b) => b.section_id === section.id);
          const sectionQuestions = questions.filter((q) => q.section_id === section.id);
          return (
            <section key={section.id} className="space-y-3 rounded-xl border p-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {index + 1}. {section.title}
                </h2>
                {section.description ? (
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                ) : null}
              </div>
              <div className="space-y-3">
                {sectionBlocks.map((block) => (
                  <BlockView key={block.id} block={block} />
                ))}
              </div>

              {sectionQuestions.length > 0 ? (
                <div className="space-y-3 rounded-lg bg-muted/40 p-3">
                  <p className="text-sm font-semibold">Latihan</p>
                  {sectionQuestions.map((question, qIndex) => (
                    <div key={question.id} className="space-y-2">
                      <p className="text-sm font-medium">
                        {qIndex + 1}. {question.text}
                      </p>
                      {question.image_url ? (
                        <img
                          src={question.image_url}
                          alt="Gambar soal"
                          loading="lazy"
                          className="w-full rounded-lg object-cover"
                        />
                      ) : null}
                      {question.audio_url ? (
                        <audio controls src={question.audio_url} className="w-full">
                          <track kind="captions" />
                        </audio>
                      ) : null}
                      <ul className="space-y-1 text-sm">
                        {question.answers.map((answer, answerIndex) => (
                          <li
                            key={answer.id}
                            className={
                              answer.is_correct
                                ? "rounded-md bg-primary/10 px-2 py-1 font-medium"
                                : "px-2 py-1"
                            }
                          >
                            {answerIndex + 1}. {answer.text}
                          </li>
                        ))}
                      </ul>
                      {question.explanation ? (
                        <p className="text-xs text-muted-foreground">
                          Pembahasan: {question.explanation}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </article>
  );
}
