import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteExam, useExams } from "@/hooks/exam";
import { useExamCategories } from "@/hooks/exam/use-exam-category";
import { EXAM_DIFFICULTY_LABELS, EXAM_STATUS_LABELS } from "@/features/exam/exam.constants";
import type { ExamRow, ExamStatus } from "@/types/exam";
import { ImportBundleDialog } from "@/features/content-io/components/import-bundle-dialog";
import { recordContentIoAudit } from "@/services/content/bundle/audit.service";
import { buildExamBundle, downloadBundle } from "@/services/content/bundle/bundle-export.service";
import { listExamOrderIds, moveExamToPosition, swapExamOrder } from "@/services/exam";
import { duplicateExam } from "@/features/exam/exam-duplicate";
import { ExamFormDialog } from "./exam-form-dialog";
import { ExamPublishToggle } from "./exam-publish-toggle";
import heroIllustration from "@/assets/exam-studio-hero.png";

const PAGE_SIZE = 10;

const statusVariant: Record<ExamStatus, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
};

/** Daftar Exam Studio: hero banner, aksi cepat, filter, dan kartu ringkas. */
export function ExamList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"semua" | ExamStatus>("semua");
  const [category, setCategory] = useState<string>("semua");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<ExamRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const params = useMemo(
    () => ({ search, status, category, page, pageSize: PAGE_SIZE }),
    [search, status, category, page],
  );
  const { data, isLoading, isError } = useExams(params);
  const { data: categoryRows } = useExamCategories();
  const categoryOptions = useMemo(() => categoryRows ?? [], [categoryRows]);
  const categoryLabel = (slug: string) =>
    categoryOptions.find((item) => item.slug === slug)?.label ?? slug;
  const deleteExam = useDeleteExam();

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);

  // Urutan berasal dari database (sort_order). UI hanya berubah setelah server konfirmasi.
  const orderedRows = rows;

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (moving || target < 0 || target >= orderedRows.length) return;
    const a = orderedRows[index]?.id;
    const b = orderedRows[target]?.id;
    if (!a || !b) return;
    setMoving(true);
    try {
      await swapExamOrder(a, b);
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["available-exams"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan urutan exam.");
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
    } finally {
      setMoving(false);
    }
  };

  const total = data?.total ?? 0;
  const moveTo = async (exam: ExamRow, currentPos: number) => {
    if (moving) return;
    const raw = window.prompt(
      `Pindahkan "${exam.title}" (posisi ${currentPos}) ke posisi berapa? (1–${total})`,
      "1",
    );
    if (raw === null) return;
    const target = Number(raw);
    if (!Number.isInteger(target) || target < 1 || target > total) {
      toast.error(`Masukkan angka 1 sampai ${total}.`);
      return;
    }
    if (target === currentPos) return;
    setMoving(true);
    try {
      const ids = await listExamOrderIds({ search, status, category });
      await moveExamToPosition(ids, exam.id, target);
      toast.success(`Dipindahkan ke posisi ${target}.`);
      setPage(Math.ceil(target / PAGE_SIZE));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan urutan exam.");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["available-exams"] });
      setMoving(false);
    }
  };

  const handleExport = async (exam: ExamRow) => {
    setExportingId(exam.id);
    try {
      const bundle = await buildExamBundle(exam.id, true);
      downloadBundle(bundle, `exam-${exam.slug}`);
      toast.success("Bundle exam berhasil diunduh.");
      void recordContentIoAudit({
        action: "export_exam",
        entity: exam.slug,
        count: 1,
        result: "success",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengekspor exam.");
    } finally {
      setExportingId(null);
    }
  };

  const handleDuplicate = async (exam: ExamRow) => {
    setDuplicatingId(exam.id);
    try {
      await duplicateExam(exam);
      toast.success("Exam diduplikasi sebagai draft.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menduplikasi exam.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (exam: ExamRow) => {
    if (!window.confirm(`Hapus exam "${exam.title}" beserta seluruh soalnya?`)) return;
    try {
      await deleteExam.mutateAsync(exam.id);
      toast.success("Exam dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus exam.");
    }
  };

  return (
    <section className="space-y-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Exam Studio</h1>
        <p className="text-sm text-muted-foreground">
          Kelola bank ujian, section, dan soal dalam satu tempat.
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl bg-primary p-4 text-primary-foreground">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">Susun Ujian Berkualitas</p>
          <p className="text-xs opacity-90">
            Nilai total selalu 100 dan poin per soal dihitung otomatis.
          </p>
        </div>
        <img
          src={heroIllustration}
          alt="Ilustrasi penyusunan ujian"
          width={768}
          height={768}
          className="size-24 shrink-0 object-contain"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            setSelected(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> Tambah Exam
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 size-4" /> Import Exam
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari judul atau slug exam"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as "semua" | ExamStatus);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua status</SelectItem>
              {Object.entries(EXAM_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua kategori</SelectItem>
              {categoryOptions.map((item) => (
                <SelectItem key={item.slug} value={item.slug}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Gagal memuat daftar exam.</p>
      ) : orderedRows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada exam. Tekan “Tambah Exam” untuk membuat yang pertama.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {orderedRows.map((exam, index) => (
            <li
              key={exam.id}
              className="space-y-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold">
                    <span className="mr-1.5 text-muted-foreground">
                      #{(page - 1) * PAGE_SIZE + index + 1}
                    </span>
                    {exam.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">/{exam.slug}</p>
                </div>
                <Badge variant={statusVariant[exam.status]} className="shrink-0">
                  {EXAM_STATUS_LABELS[exam.status]}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1">
                  {categoryLabel(exam.category)}
                </span>
                <span className="rounded-md bg-muted px-2 py-1">
                  {EXAM_DIFFICULTY_LABELS[exam.difficulty]}
                </span>
                <span className="rounded-md bg-muted px-2 py-1">{exam.duration_minutes} menit</span>
                <span className="rounded-md bg-muted px-2 py-1">Lulus {exam.passing_score}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <ExamPublishToggle examId={exam.id} isPublished={exam.status === "published"} />
                <div className="ml-auto flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" aria-label="Kelola soal" asChild>
                    <Link to="/owner/exam-studio/$examId" params={{ examId: exam.id }}>
                      <Pencil className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Duplikat exam"
                    disabled={duplicatingId === exam.id}
                    onClick={() => void handleDuplicate(exam)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Export exam"
                    disabled={exportingId === exam.id}
                    onClick={() => void handleExport(exam)}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Naikkan urutan"
                    disabled={moving || index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Turunkan urutan"
                    disabled={moving || index === orderedRows.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    aria-label="Pindah ke posisi"
                    disabled={moving || total < 2}
                    onClick={() => void moveTo(exam, (page - 1) * PAGE_SIZE + index + 1)}
                  >
                    Posisi
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Hapus exam"
                    onClick={() => void handleDelete(exam)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground">
            Halaman {data.page} dari {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </div>
      ) : null}

      <ExamFormDialog open={formOpen} onOpenChange={setFormOpen} exam={selected} />
      <ImportBundleDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        bundleType="exam"
        onImported={async () => {
          setPage(1);
          const keys = ["exams", "exam", "exam-sections", "exam-questions", "question-bank"];
          await Promise.all(
            keys.map((key) => queryClient.invalidateQueries({ queryKey: [key], refetchType: "all" })),
          );
          await queryClient.refetchQueries({ queryKey: ["exams"], type: "active" });
        }}
      />
    </section>
  );
}
