import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Download,
  Image as ImageIcon,
  Music,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  useArchiveBankQuestion,
  useBankQuestions,
  useDeleteBankQuestion,
  useQuestionReferences,
} from "@/hooks/question-bank";
import { ORIGIN_LABELS, SOURCE_LABELS, type QuestionBankFilters } from "@/types/question-bank";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTanggal } from "@/utils/format";
import { ImportBundleDialog } from "@/features/content-io/components/import-bundle-dialog";
import { recordContentIoAudit } from "@/services/content/bundle/audit.service";
import {
  buildQuestionBundle,
  downloadBundle,
} from "@/services/content/bundle/bundle-export.service";

const PAGE_SIZE = 10;

export function QuestionBankList() {
  const [filters, setFilters] = useState<QuestionBankFilters>({
    search: "",
    source: "semua",
    media: "semua",
    archived: "aktif",
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const bankQuery = useBankQuestions(filters);
  const archiveQuestion = useArchiveBankQuestion();
  const deleteQuestion = useDeleteBankQuestion();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; text: string } | null>(null);
  const referencesQuery = useQuestionReferences(deleteTarget?.id ?? null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const patch = (value: Partial<QuestionBankFilters>) =>
    setFilters((prev) => ({ ...prev, page: 1, ...value }));

  const rows = bankQuery.data?.rows ?? [];
  const page = bankQuery.data?.page ?? 1;
  const totalPages = bankQuery.data?.totalPages ?? 1;
  const total = bankQuery.data?.total ?? 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const bundle = await buildQuestionBundle({ mode: "filtered", filters });
      downloadBundle(bundle, `question-bank-${new Date().toISOString().slice(0, 10)}`);
      toast.success(`${bundle.data.length} soal berhasil diekspor.`);
      void recordContentIoAudit({
        action: "export_question_bundle",
        entity: "question_bank",
        count: bundle.data.length,
        result: "success",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengekspor soal.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Question Bank</h1>
        <p className="text-sm text-muted-foreground">
          Kumpulan seluruh soal yang pernah dibuat dari Exam Studio dan Lesson Studio. Soal baru
          hanya dapat dibuat dari Studio, bukan dari halaman ini.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 size-4" /> Import
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={exporting || total === 0}
          onClick={() => void handleExport()}
        >
          <Download className="mr-1 size-4" />
          {exporting ? "Menyiapkan…" : "Export sesuai filter"}
        </Button>
      </div>


      <div className="space-y-3 rounded-xl border p-4">
        <div className="space-y-2">
          <Label htmlFor="qb-search">Cari soal</Label>
          <Input
            id="qb-search"
            value={filters.search ?? ""}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Cari soal, pembahasan, atau lesson"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label>Source</Label>
            <Select
              value={filters.source ?? "semua"}
              onValueChange={(v) =>
                patch({ source: v as NonNullable<QuestionBankFilters["source"]> })
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
          </div>

          <div className="space-y-1">
            <Label>Media</Label>
            <Select
              value={filters.media ?? "semua"}
              onValueChange={(v) =>
                patch({ media: v as NonNullable<QuestionBankFilters["media"]> })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua media</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="none">Tanpa media</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={filters.archived ?? "aktif"}
              onValueChange={(v) =>
                patch({ archived: v as NonNullable<QuestionBankFilters["archived"]> })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="arsip">Arsip</SelectItem>
                <SelectItem value="semua">Semua</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {bankQuery.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : bankQuery.isError ? (
        <p className="text-sm text-destructive">Gagal memuat Question Bank.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada soal. Buat soal dari Exam Studio atau Lesson Studio.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((question, index) => (
            <li key={question.id} className="space-y-2 rounded-xl border p-4">
              <div className="flex items-start gap-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  {(page - 1) * PAGE_SIZE + index + 1}.
                </span>
                <p className="min-w-0 flex-1 text-sm font-medium">{question.text}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{SOURCE_LABELS[question.source_type]}</Badge>
                <Badge variant="secondary">v{question.version}</Badge>
                <Badge variant="outline">Origin: {ORIGIN_LABELS[question.origin]}</Badge>
                {question.is_archived ? <Badge variant="destructive">Arsip</Badge> : null}
                {question.image_url ? (
                  <Badge variant="outline">
                    <ImageIcon className="mr-1 size-3" /> Image
                  </Badge>
                ) : null}
                {question.audio_url ? (
                  <Badge variant="outline">
                    <Music className="mr-1 size-3" /> Audio
                  </Badge>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <p>Lesson: {question.lesson?.title ?? "-"}</p>
                <p>Dibuat: {formatTanggal(question.created_at)}</p>
                <p>
                  Terakhir dipakai:{" "}
                  {question.last_used_at ? formatTanggal(question.last_used_at) : "Belum pernah"}
                </p>
                <p>Jumlah dipakai: {question.used_count}</p>
              </div>

              <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await archiveQuestion.mutateAsync({
                      id: question.id,
                      isArchived: !question.is_archived,
                    });
                    toast.success(
                      question.is_archived ? "Soal diaktifkan kembali." : "Soal diarsipkan.",
                    );
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Gagal memperbarui soal.");
                  }
                }}
              >
                {question.is_archived ? (
                  <>
                    <ArchiveRestore className="mr-1 size-4" /> Aktifkan
                  </>
                ) : (
                  <>
                    <Archive className="mr-1 size-4" /> Arsipkan
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteTarget({ id: question.id, text: question.text })}
              >
                <Trash2 className="mr-1 size-4" /> Hapus
              </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Halaman {page} dari {totalPages} · {bankQuery.data?.total ?? 0} soal
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
          >
            Sebelumnya
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus soal dari Question Bank?</AlertDialogTitle>
            <AlertDialogDescription>
              {referencesQuery.data && referencesQuery.data.exams + referencesQuery.data.lessons > 0
                ? `Soal ini dipakai oleh ${referencesQuery.data.exams} exam dan ${referencesQuery.data.lessons} lesson. Soal akan dihapus dari Question Bank, namun tetap utuh di exam/lesson dan riwayat pengerjaan yang sudah ada.`
                : "Soal ini belum dipakai exam atau lesson mana pun, sehingga akan dihapus permanen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteQuestion.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!deleteTarget) return;
                try {
                  const mode = await deleteQuestion.mutateAsync(deleteTarget.id);
                  toast.success(
                    mode === "hard"
                      ? "Soal dihapus permanen."
                      : "Soal dihapus dari Question Bank. Exam yang sudah ada tetap utuh.",
                  );
                  setDeleteTarget(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Gagal menghapus soal.");
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportBundleDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        bundleType="question_bank"
        onImported={() => void bankQuery.refetch()}
      />
    </section>
  );
}
