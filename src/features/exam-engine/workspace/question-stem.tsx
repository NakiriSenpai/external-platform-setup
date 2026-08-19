import { memo, type ReactNode } from "react";

import { RichText } from "@/components/common/rich-text";
import { richTextToPlain } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { AudioButton } from "./audio-manager";

/** Batang soal (perintah, teks, gambar, audio) — dipakai Exam, Review, dan Preview. */
export const QuestionStem = memo(function QuestionStem({
  questionId,
  number,
  total,
  sectionTitle,
  sectionInstruction,
  instruction,
  text,
  imageUrl,
  audioUrl,
  right,
}: {
  questionId: string;
  number: number;
  total: number;
  sectionTitle?: string | undefined;
  sectionInstruction?: string | null | undefined;
  /** Perintah soal (rich text). */
  instruction?: string | null | undefined;
  text: string;
  imageUrl: string | null;
  audioUrl: string | null;
  right?: ReactNode;
}) {
  const hasSectionInstruction = Boolean(richTextToPlain(sectionInstruction));
  return (
    <div className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 rounded-lg bg-primary-muted px-2.5 py-1 text-[13px] font-semibold text-primary">
          Soal {number}
        </span>
        {right}
      </div>
      {sectionTitle ? (
        <div className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground/80">{sectionTitle}</span>
          {hasSectionInstruction ? (
            <RichText html={sectionInstruction} className="mt-0.5 text-xs" />
          ) : null}
          <span className="sr-only">
            {" "}
            Soal {number} dari {total}
          </span>
        </div>
      ) : null}
      {richTextToPlain(instruction) ? (
        <RichText
          html={instruction}
          className="min-w-0 text-[13px] font-medium leading-relaxed text-muted-foreground"
        />
      ) : null}
      <RichText html={text} className="min-w-0 text-[15px] leading-relaxed text-foreground" />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Gambar soal nomor ${number}`}
          loading="lazy"
          draggable={false}
          className="max-h-44 w-auto max-w-[min(100%,22rem)] rounded-xl border border-border object-contain sm:max-h-56"
        />
      ) : null}

      {audioUrl ? (
        <AudioButton audioKey={`${questionId}:soal`} src={audioUrl} label="Dengarkan audio" />

      ) : null}
    </div>
  );
});

/** Judul panel jawaban (kanan). */
export function AnswerPanelHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {right}
    </div>
  );
}

/** Kerangka satu pilihan jawaban (nomor + konten). */
export function AnswerShell({
  index,
  selected,
  tone,
  onClick,
  disabled,
  children,
}: {
  index: number;
  selected?: boolean;
  tone?: "correct" | "wrong" | undefined;
  onClick?: (() => void) | undefined;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-150",
    tone === "correct"
      ? "border-success bg-success/10"
      : tone === "wrong"
        ? "border-destructive bg-destructive/10"
        : selected
          ? "border-primary bg-primary-muted"
          : "border-border",
    onClick && "hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60",
  );
  const inner = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold tabular-nums",
          tone === "correct"
            ? "bg-success text-success-foreground"
            : tone === "wrong"
              ? "bg-destructive text-destructive-foreground"
              : selected
                ? "bg-primary text-primary-foreground"
                : "bg-primary-muted text-primary",
        )}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">{children}</span>
    </>
  );

  if (!onClick) return <div className={className}>{inner}</div>;
  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {inner}
    </button>
  );
}
