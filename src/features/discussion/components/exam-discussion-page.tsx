import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useExamDiscussion } from "@/hooks/discussion/use-discussion";
import { cn } from "@/lib/utils";
import { DiscussionPanel } from "./discussion-panel";

/**
 * Halaman diskusi satu Exam (tujuan notifikasi). Hanya menampilkan diskusi —
 * tidak menampilkan kunci jawaban. Hak akses divalidasi oleh database.
 */
export function ExamDiscussionPage({
  examId,
  focusQuestionId,
  tenantId,
}: {
  examId: string;
  focusQuestionId?: string;
  tenantId?: string;
}) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useExamDiscussion({ examId, tenantId });
  const [picked, setPicked] = useState<string | null>(null);

  const questions = useMemo(() => {
    const map = new Map<string, { id: string; number: number | null; count: number }>();
    for (const c of data ?? []) {
      const entry = map.get(c.question_id) ?? { id: c.question_id, number: c.question_number, count: 0 };
      entry.count += 1;
      map.set(c.question_id, entry);
    }
    return [...map.values()].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));
  }, [data]);

  const active = picked ?? focusQuestionId ?? questions[0]?.id ?? null;
  const activeNumber = questions.find((q) => q.id === active)?.number;

  return (
    <div className="space-y-4 pb-6">
      <header className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Kembali"
          onClick={() => void navigate({ to: "/ujian" })}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Diskusi Ujian</h1>
      </header>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat diskusi…
        </p>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Diskusi tidak dapat dibuka."}
          </CardContent>
        </Card>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Belum ada diskusi pada ujian ini.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {questions.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setPicked(q.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs",
                  q.id === active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                Soal {q.number ?? "?"} · {q.count}
              </button>
            ))}
          </div>
          {active ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Soal {activeNumber ?? "?"}</p>
              <DiscussionPanel
                key={active}
                examId={examId}
                questionId={active}
                tenantId={tenantId}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
