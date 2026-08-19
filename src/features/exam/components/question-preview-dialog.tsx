import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pratinjau Soal</DialogTitle>
          <DialogDescription>Tampilan soal seperti yang dilihat siswa.</DialogDescription>
        </DialogHeader>

        {question ? (
          <div className="space-y-4">
            <p className="text-sm font-medium">{question.text}</p>

            {question.image_url ? (
              <img
                src={question.image_url}
                alt="Gambar soal"
                loading="lazy"
                className="w-full rounded-xl border border-border object-contain"
              />
            ) : null}
            {question.audio_url ? (
              <audio controls src={question.audio_url} className="w-full">
                <track kind="captions" />
              </audio>
            ) : null}

            <ul className="space-y-2">
              {question.answers.map((answer) => (
                <li
                  key={answer.id ?? answer.label}
                  className={cn(
                    "rounded-xl border border-border p-2.5 text-sm",
                    answer.is_correct && "border-primary bg-primary/10",
                  )}
                >
                  <span className="mr-2 font-semibold">{answer.label}.</span>
                  {answer.text}
                  {answer.image_url ? (
                    <img
                      src={answer.image_url}
                      alt={`Gambar jawaban ${answer.label}`}
                      loading="lazy"
                      className="mt-2 w-full rounded-lg border border-border object-contain"
                    />
                  ) : null}
                  {answer.audio_url ? (
                    <audio controls src={answer.audio_url} className="mt-2 w-full">
                      <track kind="captions" />
                    </audio>
                  ) : null}
                </li>
              ))}
            </ul>

            {question.explanation ? (
              <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Pembahasan: </span>
                {question.explanation}
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
