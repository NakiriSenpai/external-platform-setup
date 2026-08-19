import { Volume2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { LessonBlockRow } from "@/types/lesson";

/** Ukuran gambar mengikuti konteks kategori — tidak pernah memenuhi layar. */
function imageClass(category: string) {
  if (category === "budaya") return "max-h-72";
  if (category === "kosakata" || category === "conversation") return "max-h-48";
  return "max-h-60";
}

/** Baris dialog "Pembicara: kalimat" untuk kategori Conversation. */
function DialogueLine({ raw, index }: { raw: string; index: number }) {
  const idx = raw.indexOf(":");
  const speaker = idx > 0 ? raw.slice(0, idx).trim() : null;
  const text = idx > 0 ? raw.slice(idx + 1).trim() : raw;
  const alt = index % 2 === 1;

  return (
    <li className={cn("flex", alt ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2.5",
          alt ? "bg-primary/15 text-foreground" : "bg-muted text-foreground",
        )}
      >
        {speaker ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {speaker}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
    </li>
  );
}

/** Kartu kosakata untuk kategori Kosakata. */
function VocabularyItem({ raw }: { raw: string }) {
  const idx = raw.indexOf("=");
  const term = idx > 0 ? raw.slice(0, idx).trim() : raw;
  const meaning = idx > 0 ? raw.slice(idx + 1).trim() : null;
  return (
    <li className="rounded-xl border border-border bg-card px-3.5 py-2.5">
      <p className="text-base font-semibold leading-snug text-foreground">{term}</p>
      {meaning ? <p className="text-sm text-muted-foreground">{meaning}</p> : null}
    </li>
  );
}

/**
 * Renderer block materi untuk siswa.
 * Menggunakan skema block Lesson Studio yang sudah ada — tanpa skema baru.
 */
export function LessonBlockRenderer({
  block,
  category,
}: {
  block: LessonBlockRow;
  category: string;
}) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="text-lg font-semibold leading-snug text-foreground">{block.content}</h2>
      );

    case "paragraph":
      return (
        <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/90">
          {block.content}
        </p>
      );

    case "bullet_list":
      if (category === "conversation") {
        return (
          <ul className="space-y-2">
            {block.items.map((item, i) => (
              <DialogueLine key={`${block.id}-${i}`} raw={item} index={i} />
            ))}
          </ul>
        );
      }
      if (category === "kosakata") {
        return (
          <ul className="space-y-2">
            {block.items.map((item, i) => (
              <VocabularyItem key={`${block.id}-${i}`} raw={item} />
            ))}
          </ul>
        );
      }
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-foreground/90">
          {block.items.map((item, i) => (
            <li key={`${block.id}-${i}`}>{item}</li>
          ))}
        </ul>
      );

    case "image":
      return block.media_url ? (
        <figure className="space-y-1.5">
          <img
            src={block.media_url}
            alt={block.content ?? "Ilustrasi materi"}
            loading="lazy"
            className={cn("w-full rounded-xl object-cover", imageClass(category))}
          />
          {block.content ? (
            <figcaption className="text-xs text-muted-foreground">{block.content}</figcaption>
          ) : null}
        </figure>
      ) : null;

    case "audio":
      return block.media_url ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Volume2 className="size-4" aria-hidden />
            {block.content?.trim() || "Audio materi"}
          </p>
          {/* Audio materi bebas diputar ulang — bukan audio ujian. */}
          <audio controls preload="none" src={block.media_url} className="w-full">
            <track kind="captions" />
          </audio>
        </div>
      ) : null;

    case "callout":
      return (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-[15px] leading-7 text-foreground">
          {block.content}
        </div>
      );

    case "divider":
      return <Separator className="my-1" />;

    case "grammar_highlight":
      return (
        <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-3.5">
          {block.grammar_tag ? (
            <Badge variant="secondary">{block.grammar_tag.name}</Badge>
          ) : null}
          <p className="whitespace-pre-line text-[15px] font-medium leading-7 text-foreground">
            {block.content}
          </p>
        </div>
      );

    default:
      return null;
  }
}
