import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/common/rich-text";
import { richTextToPlain } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import type { ExamQuestionWithAnswers } from "@/types/exam";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: ExamQuestionWithAnswers | null;
};

/** Pratinjau soal seperti tampilan siswa (baca saja). */
export function QuestionPreviewDialog({ open, onOpenChange, question }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pratinjau Soal</DialogTitle>
          <DialogDescription>Tampilan soal seperti yang dilihat siswa.</DialogDescription>
        </DialogHeader>

        {question ? (
          <div className="min-w-0 space-y-4">
            {richTextToPlain(question.instruction) ? (
              <RichText
                html={question.instruction}
                className="text-xs font-medium text-muted-foreground"
              />
            ) : null}

            <RichText html={question.text} className="text-sm font-medium" />

            {question.image_url ? (
              <img
                src={question.image_url}
                alt="Gambar soal"
                loading="lazy"
                className="w-full max-w-full rounded-xl border border-border object-contain"
              />
            ) : null}
            {question.audio_url ? (
              <audio controls src={question.audio_url} className="w-full max-w-full">
                <track kind="captions" />
              </audio>
            ) : null}

            <ul className="space-y-2">
              {question.answers.map((answer) => (
                <li
                  key={answer.id ?? answer.label}
                  className={cn(
                    "min-w-0 rounded-xl border border-border p-2.5 text-sm",
                    answer.is_correct && "border-primary bg-primary/10",
                  )}
                >
                  <span className="mr-2 font-semibold">{answer.label}.</span>
                  <RichText html={answer.text} as="span" className="inline" />
                  {answer.image_url ? (
                    <img
                      src={answer.image_url}
                      alt={`Gambar jawaban ${answer.label}`}
                      loading="lazy"
                      className="mt-2 w-full max-w-full rounded-lg border border-border object-contain"
                    />
                  ) : null}
                  {answer.audio_url ? (
                    <audio controls src={answer.audio_url} className="mt-2 w-full max-w-full">
                      <track kind="captions" />
                    </audio>
                  ) : null}
                </li>
              ))}
            </ul>

            {richTextToPlain(question.explanation) ? (
              <div className="min-w-0 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Pembahasan: </span>
                <RichText html={question.explanation} className="mt-1" />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {question.grammar_tags.map((tag) => (
                <Badge key={tag.id} variant="outline" className="text-[11px]">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
