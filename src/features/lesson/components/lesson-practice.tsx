import { useState } from "react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LessonQuestionWithAnswers } from "@/types/lesson";

/**
 * Latihan materi — BUKAN ujian.
 * Tidak membuat exam attempt, tidak masuk riwayat ujian maupun leaderboard.
 */
function PracticeItem({
  question,
  index,
}: {
  question: LessonQuestionWithAnswers;
  index: number;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;

  return (
    <li className="space-y-2.5 rounded-xl border border-border bg-card p-3.5">
      <p className="text-sm font-medium leading-relaxed text-foreground">
        {index + 1}. {question.text}
      </p>

      {question.image_url ? (
        <img
          src={question.image_url}
          alt="Ilustrasi latihan"
          loading="lazy"
          className="max-h-48 w-full rounded-lg object-cover"
        />
      ) : null}

      {question.audio_url ? (
        <audio controls preload="none" src={question.audio_url} className="w-full">
          <track kind="captions" />
        </audio>
      ) : null}

      <ul className="space-y-1.5">
        {question.answers.map((answer) => {
          const chosen = picked === answer.id;
          const reveal = answered && (chosen || answer.is_correct);
          return (
            <li key={answer.id}>
              <button
                type="button"
                disabled={answered}
                onClick={() => setPicked(answer.id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  reveal && answer.is_correct
                    ? "border-primary bg-primary/15 text-foreground"
                    : reveal
                      ? "border-destructive/60 bg-destructive/10 text-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/60",
                )}
              >
                <span className="font-semibold">{answer.label}.</span>
                <span className="min-w-0 flex-1">{answer.text}</span>
                {reveal ? (
                  answer.is_correct ? (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <X className="size-4 shrink-0 text-destructive" aria-hidden />
                  )
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && question.explanation ? (
        <p className="rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed text-muted-foreground">
          Pembahasan: {question.explanation}
        </p>
      ) : null}
    </li>
  );
}

export function LessonPractice({ questions }: { questions: LessonQuestionWithAnswers[] }) {
  if (questions.length === 0) return null;
  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-semibold text-foreground">Latihan</h3>
      <p className="text-xs text-muted-foreground">
        Latihan ini untuk berlatih mandiri dan tidak memengaruhi nilai ujian.
      </p>
      <ul className="space-y-2.5">
        {questions.map((question, index) => (
          <PracticeItem key={question.id} question={question} index={index} />
        ))}
      </ul>
    </section>
  );
}
