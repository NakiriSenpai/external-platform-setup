import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { MediaPicker } from "@/features/media";
import { Textarea } from "@/components/ui/textarea";
import { useCreateExam, useUpdateExam } from "@/hooks/exam";
import { useExamCategories } from "@/hooks/exam/use-exam-category";
import {
  EXAM_DIFFICULTY_LABELS,
  EXAM_STATUS_LABELS,
  EXAM_TOTAL_SCORE,
  toSlug,
} from "@/features/exam/exam.constants";
import type { ExamDifficulty, ExamRow, ExamStatus } from "@/types/exam";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam?: ExamRow | null;
};

const initialForm = {
  title: "",
  slug: "",
  category: "umum",
  description: "",
  difficulty: "sedang" as ExamDifficulty,
  passingScore: "70",
  duration: "60",
  status: "draft" as ExamStatus,
  shuffleQuestions: false,
  shuffleAnswers: false,
  iconUrl: "",
};

export function ExamFormDialog({ open, onOpenChange, exam = null }: Props) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const { data: categoryRows } = useExamCategories();
  const categoryOptions = useMemo(() => categoryRows ?? [], [categoryRows]);
  const isEdit = Boolean(exam);
  const pending = createExam.isPending || updateExam.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      exam
        ? {
            title: exam.title,
            slug: exam.slug,
            category: exam.category,
            description: exam.description ?? "",
            difficulty: exam.difficulty,
            passingScore: String(exam.passing_score),
            duration: String(exam.duration_minutes),
            status: exam.status,
            shuffleQuestions: exam.shuffle_questions,
            shuffleAnswers: exam.shuffle_answers,
            iconUrl: exam.icon_url ?? "",
          }
        : initialForm,
    );
  }, [open, exam]);

  // Kategori berasal dari database; pilih opsi pertama bila nilai lama tidak tersedia.
  useEffect(() => {
    if (!open || exam || categoryOptions.length === 0) return;
    setForm((prev) =>
      categoryOptions.some((item) => item.slug === prev.category)
        ? prev
        : { ...prev, category: categoryOptions[0]!.slug },
    );
  }, [open, exam, categoryOptions]);



  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const title = form.title.trim();
    const slug = toSlug(form.slug || form.title);
    if (title.length < 3) return setError("Judul minimal 3 karakter.");
    if (slug.length < 3) return setError("Slug minimal 3 karakter.");

    const passingScore = Number(form.passingScore);
    const duration = Number(form.duration);
    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
      return setError("Passing score harus antara 0 dan 100.");
    }
    if (!Number.isFinite(duration) || duration < 1 || duration > 600) {
      return setError("Durasi harus antara 1 dan 600 menit.");
    }

    const payload = {
      title,
      slug,
      category: form.category,
      description: form.description.trim(),
      difficulty: form.difficulty,
      passing_score: Math.round(passingScore),
      duration_minutes: Math.round(duration),
      status: form.status,
      shuffle_questions: form.shuffleQuestions,
      shuffle_answers: form.shuffleAnswers,
      icon_url: form.iconUrl || null,
    };

    try {
      if (exam) {
        await updateExam.mutateAsync({ id: exam.id, input: payload });
        toast.success("Exam diperbarui.");
      } else {
        await createExam.mutateAsync(payload);
        toast.success("Exam dibuat.");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Exam" : "Tambah Exam"}</DialogTitle>
          <DialogDescription>
            Nilai total selalu {EXAM_TOTAL_SCORE} dan poin per soal dihitung otomatis.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="exam-title">Judul</Label>
            <Input
              id="exam-title"
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!isEdit) set("slug", toSlug(e.target.value));
              }}
              placeholder="Ujian Grammar N5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-slug">Slug</Label>
            <Input
              id="exam-slug"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="ujian-grammar-n5"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada kategori. Tambahkan dari bagian “Kategori Ujian” di Exam Studio.
                </p>
              ) : null}

            </div>

            <div className="space-y-2">
              <Label>Tingkat Kesulitan</Label>
              <Select
                value={form.difficulty}
                onValueChange={(v) => set("difficulty", v as ExamDifficulty)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXAM_DIFFICULTY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon Exam</Label>
            <p className="text-xs text-muted-foreground">
              Icon tampil pada katalog ujian. Kosongkan untuk memakai icon bawaan kategori.
            </p>
            {form.iconUrl ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <img
                  src={form.iconUrl}
                  alt="Pratinjau icon exam"
                  className="size-12 rounded-lg object-cover"
                  loading="lazy"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => set("iconUrl", "")}
                >
                  Ganti icon
                </Button>
              </div>
            ) : (
              <MediaPicker
                allowed={["image"]}
                folder="exam/icons"
                onChange={(asset) => set("iconUrl", asset?.url ?? "")}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-desc">Deskripsi</Label>
            <Textarea
              id="exam-desc"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Penjelasan singkat mengenai ujian ini."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exam-pass">Passing Score</Label>
              <Input
                id="exam-pass"
                inputMode="numeric"
                value={form.passingScore}
                onChange={(e) => set("passingScore", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-duration">Durasi (menit)</Label>
              <Input
                id="exam-duration"
                inputMode="numeric"
                value={form.duration}
                onChange={(e) => set("duration", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as ExamStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXAM_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="shuffle-q" className="text-sm font-normal">
              Acak urutan soal
            </Label>
            <Switch
              id="shuffle-q"
              checked={form.shuffleQuestions}
              onCheckedChange={(v) => set("shuffleQuestions", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="shuffle-a" className="text-sm font-normal">
              Acak urutan jawaban
            </Label>
            <Switch
              id="shuffle-a"
              checked={form.shuffleAnswers}
              onCheckedChange={(v) => set("shuffleAnswers", v)}
            />
          </div>

          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Nilai total ujian: <span className="font-medium text-foreground">100</span> (otomatis,
            tidak dapat diubah manual).
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isEdit ? "Simpan" : "Buat Exam"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
