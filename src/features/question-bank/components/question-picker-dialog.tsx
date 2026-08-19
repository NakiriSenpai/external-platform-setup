import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import { useAttachQuestions } from "@/hooks/exam";
import { useBankQuestions, useGrammarTags } from "@/hooks/question-bank";
import { SOURCE_LABELS, type QuestionBankFilters } from "@/types/question-bank";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exam tujuan. Kosong bila dipakai dari Lesson Studio. */
  examId?: string;
  sectionId: string;
  /** Kata benda tujuan pada pesan sukses ("exam" / "lesson"). */
  targetLabel?: string;
  /** Override penambahan referensi (Lesson Studio). Mengembalikan jumlah soal baru. */
  onAttach?: (questionIds: string[]) => Promise<number | unknown>;
  /** Status pending dari mutation eksternal. */
  attaching?: boolean;
};

/** Dialog memilih soal dari Question Bank. Soal TIDAK diduplikasi, hanya direferensikan. */
export function QuestionPickerDialog({
  open,
  onOpenChange,
  examId,
  sectionId,
  targetLabel = "exam",
  onAttach,
  attaching = false,
}: Props) {
  const [filters, setFilters] = useState<QuestionBankFilters>({
    search: "",
    source: "semua",
    grammar: "semua",
    page: 1,
    pageSize: 10,
  });
  const [selected, setSelected] = useState<string[]>([]);

  const grammarQuery = useGrammarTags();
  const bankQuery = useBankQuestions(filters);
  const attach = useAttachQuestions();

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const rows = bankQuery.data?.rows ?? [];
  const page = bankQuery.data?.page ?? 1;
  const totalPages = bankQuery.data?.totalPages ?? 1;

  const handleAdd = async () => {
    if (selected.length === 0) return;
    try {
      const added = onAttach
        ? await onAttach(selected)
        : examId
          ? await attach.mutateAsync({ examId, sectionId, questionIds: selected })
          : null;
      if (added === null) throw new Error("Target penambahan soal tidak tersedia.");
      toast.success(
        typeof added === "number" && added === 0
          ? `Soal sudah ada di ${targetLabel} ini.`
          : `Soal ditambahkan ke ${targetLabel}.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan soal.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ambil dari Question Bank</DialogTitle>
          <DialogDescription>
            Soal yang dipilih hanya direferensikan oleh {targetLabel}, tidak diduplikasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="pick-search">Cari soal</Label>
            <Input
              id="pick-search"
              value={filters.search ?? ""}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
              placeholder="Cari teks soal"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value={filters.source ?? "semua"}
              onValueChange={(v) =>
                setFilters((p) => ({
                  ...p,
                  source: v as NonNullable<QuestionBankFilters["source"]>,
                  page: 1,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua source</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.grammar ?? "semua"}
              onValueChange={(v) => setFilters((p) => ({ ...p, grammar: v, page: 1 }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua grammar</SelectItem>
                {(grammarQuery.data ?? []).map((tag) => (
                  <SelectItem key={tag.id} value={tag.slug}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bankQuery.isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Tidak ada soal yang cocok.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((question) => (
                <li key={question.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.includes(question.id)}
                      onCheckedChange={() => toggle(question.id)}
                      aria-label="Pilih soal"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium">{question.text}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{SOURCE_LABELS[question.source_type]}</Badge>
                        <Badge variant="outline">
                          {CATEGORY_LABELS[question.category] ?? question.category}
                        </Badge>
                        <Badge variant="outline">
                          {EXAM_DIFFICULTY_LABELS[question.difficulty]}
                        </Badge>
                        {question.grammar_tags.map((tag) => (
                          <Badge key={tag.id} variant="outline">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Dipakai {question.used_count} kali
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
              >
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={() => void handleAdd()}
            disabled={selected.length === 0 || attach.isPending || attaching}
          >
            {attach.isPending || attaching ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Tambah ke {targetLabel === "lesson" ? "Lesson" : "Exam"} ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
