import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Eye, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
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
import {
  CATEGORY_LABELS,
  EXAM_CATEGORIES,
  EXAM_DIFFICULTY_LABELS,
} from "@/features/exam/exam.constants";
import { LESSON_STATUS_LABELS } from "@/features/lesson/lesson.constants";
import { useDeleteLesson, useLessons } from "@/hooks/lesson";
import type { ExamDifficulty } from "@/types/exam";
import type { LessonDetailRow, LessonStatus } from "@/types/lesson";
import { ImportBundleDialog } from "@/features/content-io/components/import-bundle-dialog";
import { recordContentIoAudit } from "@/services/content/bundle/audit.service";
import { buildLessonBundle, downloadBundle } from "@/services/content/bundle/bundle-export.service";
import { LessonFormDialog } from "./lesson-form-dialog";

const PAGE_SIZE = 10;

const statusVariant: Record<LessonStatus, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LessonList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"semua" | LessonStatus>("semua");
  const [category, setCategory] = useState<string>("semua");
  const [difficulty, setDifficulty] = useState<"semua" | ExamDifficulty>("semua");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<LessonDetailRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = async (lesson: LessonDetailRow) => {
    setExportingId(lesson.id);
    try {
      const bundle = await buildLessonBundle(lesson.id, true);
      downloadBundle(bundle, `lesson-${lesson.slug}`);
      toast.success("Bundle lesson berhasil diunduh.");
      void recordContentIoAudit({
        action: "export_lesson",
        entity: lesson.slug,
        count: 1,
        result: "success",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengekspor lesson.");
    } finally {
      setExportingId(null);
    }
  };

  const params = useMemo(
    () => ({ search, status, category, difficulty, page, pageSize: PAGE_SIZE }),
    [search, status, category, difficulty, page],
  );
  const { data, isLoading, isError } = useLessons(params);
  const deleteLesson = useDeleteLesson();

  const handleDelete = async (lesson: LessonDetailRow) => {
    if (!window.confirm(`Hapus lesson "${lesson.title}" beserta section dan kontennya?`)) return;
    try {
      await deleteLesson.mutateAsync(lesson.id);
      toast.success("Lesson dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus lesson.");
    }
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Lesson Studio</h1>
        <p className="text-sm text-muted-foreground">
          CMS materi pembelajaran. Soal latihan tetap merujuk ke Question Bank.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          onClick={() => {
            setSelected(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> Tambah Lesson
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 size-4" /> Import
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari judul atau slug lesson"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
              {EXAM_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {CATEGORY_LABELS[item] ?? item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as "semua" | LessonStatus);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua status</SelectItem>
              {Object.entries(LESSON_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={difficulty}
            onValueChange={(v) => {
              setDifficulty(v as "semua" | ExamDifficulty);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kesulitan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua kesulitan</SelectItem>
              {Object.entries(EXAM_DIFFICULTY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Gagal memuat daftar lesson.</p>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada lesson. Tekan “Tambah Lesson” untuk membuat yang pertama.
        </p>
      ) : (
        <ul className="space-y-3">
          {data?.rows.map((lesson) => (
            <li key={lesson.id} className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                {lesson.thumbnail_url ? (
                  <img
                    src={lesson.thumbnail_url}
                    alt={`Thumbnail ${lesson.title}`}
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    Materi
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{lesson.title}</p>
                  <p className="truncate text-xs text-muted-foreground">/{lesson.slug}</p>
                </div>
                <Badge variant={statusVariant[lesson.status]}>
                  {LESSON_STATUS_LABELS[lesson.status]}
                </Badge>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Kategori</dt>
                  <dd>{CATEGORY_LABELS[lesson.category] ?? lesson.category}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Kesulitan</dt>
                  <dd>{EXAM_DIFFICULTY_LABELS[lesson.difficulty]}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Section</dt>
                  <dd>{lesson.section_count}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Soal latihan</dt>
                  <dd>{lesson.question_count}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-medium text-foreground">Terakhir diubah</dt>
                  <dd>{formatDate(lesson.updated_at)}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="min-h-11">
                  <Link to="/owner/lesson-studio/$lessonId" params={{ lessonId: lesson.id }}>
                    Kelola Materi
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary" className="min-h-11">
                  <Link
                    to="/owner/lesson-studio/$lessonId/preview"
                    params={{ lessonId: lesson.id }}
                  >
                    <Eye className="mr-1 size-4" /> Preview
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setSelected(lesson);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="mr-1 size-4" /> Ubah
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  disabled={exportingId === lesson.id}
                  onClick={() => void handleExport(lesson)}
                >
                  <Download className="mr-1 size-4" />
                  {exportingId === lesson.id ? "Menyiapkan…" : "Export"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void handleDelete(lesson)}
                >
                  <Trash2 className="mr-1 size-4" /> Hapus
                </Button>
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

      <LessonFormDialog open={formOpen} onOpenChange={setFormOpen} lesson={selected} />
      <ImportBundleDialog open={importOpen} onOpenChange={setImportOpen} bundleType="lesson" />
    </section>
  );
}
