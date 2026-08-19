import { Flag } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaletteStatus = "unanswered" | "answered" | "correct" | "wrong";

export type PaletteItem = {
  questionId: string;
  index: number;
  status: PaletteStatus;
  flagged: boolean;
};

export type PaletteGroup = {
  id: string;
  title: string;
  items: PaletteItem[];
};

const statusClass: Record<PaletteStatus, string> = {
  unanswered: "border-border bg-card text-foreground",
  answered: "border-primary bg-primary text-primary-foreground",
  correct: "border-success bg-success text-success-foreground",
  wrong: "border-destructive bg-destructive text-destructive-foreground",
};

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3.5 rounded-[4px]", className)} /> {text}
    </span>
  );
}

function PaletteLegend({ mode }: { mode: "exam" | "review" }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
      {mode === "exam" ? (
        <>
          <Legend className="bg-primary" text="Terjawab" />
          <Legend className="border border-border bg-card" text="Belum Terjawab" />
        </>
      ) : (
        <>
          <Legend className="bg-success" text="Benar" />
          <Legend className="bg-destructive" text="Salah" />
          <Legend className="border border-border bg-card" text="Tidak Dijawab" />
        </>
      )}
      <span className="flex items-center gap-1.5">
        <Flag className="size-3.5 text-destructive" /> Ditandai
      </span>
    </div>
  );
}

function groupLabel(group: PaletteGroup) {
  const first = group.items[0];
  const last = group.items[group.items.length - 1];
  if (!first || !last) return group.title.toUpperCase();
  return `${group.title.toUpperCase()} (${first.index + 1} - ${last.index + 1})`;
}

/** Grid nomor soal (kotak) dikelompokkan per bagian — semua soal tampil sekaligus. */
export function QuestionListPanel({
  groups,
  activeIndex,
  mode,
  onJump,
}: {
  groups: PaletteGroup[];
  activeIndex: number;
  mode: "exam" | "review";
  onJump: (index: number) => void;
  columns?: "auto" | "compact";
}) {
  return (
    <div className="space-y-5">
      <PaletteLegend mode={mode} />
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.id} className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {groupLabel(group)}
            </p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {group.items.map((item) => (
                <button
                  key={item.questionId}
                  type="button"
                  aria-label={`Soal nomor ${item.index + 1}`}
                  aria-current={item.index === activeIndex}
                  onClick={() => onJump(item.index)}
                  className={cn(
                    "relative flex h-10 min-w-0 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                    statusClass[item.status],
                    item.index === activeIndex && "ring-2 ring-primary ring-offset-0",
                  )}
                >
                  {item.index + 1}
                  {item.flagged ? (
                    <Flag className="absolute -right-1 -top-1 size-3.5 fill-destructive text-destructive" />
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Daftar Soal sebagai popup terpusat pada semua ukuran layar. */
export function QuestionListDialog({
  open,
  onOpenChange,
  groups,
  activeIndex,
  mode,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: PaletteGroup[];
  activeIndex: number;
  mode: "exam" | "review";
  onJump: (index: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-3xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">Daftar Soal</DialogTitle>
          <DialogDescription className="sr-only">
            Pilih nomor soal untuk berpindah.
          </DialogDescription>
        </DialogHeader>

        <QuestionListPanel
          groups={groups}
          activeIndex={activeIndex}
          mode={mode}
          onJump={(index) => {
            onJump(index);
            onOpenChange(false);
          }}
        />

        <Button
          variant="secondary"
          className="h-11 w-full rounded-xl font-semibold text-primary"
          onClick={() => onOpenChange(false)}
        >
          Tutup
        </Button>
      </DialogContent>
    </Dialog>
  );
}
