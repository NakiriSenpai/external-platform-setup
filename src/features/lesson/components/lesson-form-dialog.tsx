import { useEffect, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/features/media/components/media-picker";
import { EXAM_DIFFICULTY_LABELS } from "@/features/exam/exam.constants";
import {
  LESSON_CATEGORIES,
  LESSON_STATUS_LABELS,
  lessonCategoryLabel,
} from "@/features/lesson/lesson.constants";
import { useCreateLesson, useUpdateLesson } from "@/hooks/lesson";
import type { ExamDifficulty } from "@/types/exam";
import type { LessonDetailRow, LessonStatus } from "@/types/lesson";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson?: LessonDetailRow | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function LessonFormDialog({ open, onOpenChange, lesson = null }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("tata-bahasa");
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("sedang");
  const [status, setStatus] = useState<LessonStatus>("draft");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const pending = createLesson.isPending || updateLesson.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(Boolean(lesson));
    setTitle(lesson?.title ?? "");
    setSlug(lesson?.slug ?? "");
    setDescription(lesson?.description ?? "");
    setCategory(lesson?.category ?? "tata-bahasa");
    setDifficulty(lesson?.difficulty ?? "sedang");
    setStatus(lesson?.status ?? "draft");
    setThumbnail(lesson?.thumbnail_url ?? null);
  }, [open, lesson]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (trimmed.length < 3) return setError("Judul lesson minimal 3 karakter.");
    const finalSlug = slugify(slug || trimmed);
    if (!finalSlug) return setError("Slug tidak valid.");

    const input = {
      title: trimmed,
      slug: finalSlug,
      category,
      description,
      thumbnail_url: thumbnail,
      difficulty,
      status,
    };

    try {
      if (lesson) {
        await updateLesson.mutateAsync({ id: lesson.id, input });
        toast.success("Lesson diperbarui.");
      } else {
        await createLesson.mutateAsync(input);
        toast.success("Lesson dibuat.");
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
          <DialogTitle>{lesson ? "Ubah Lesson" : "Tambah Lesson"}</DialogTitle>
          <DialogDescription>
            Lesson adalah materi pembelajaran. Soal latihan tetap tersimpan di Question Bank.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Judul</Label>
            <Input
              id="lesson-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Perkenalan Diri"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-slug">Slug</Label>
            <Input
              id="lesson-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="perkenalan-diri"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-desc">Deskripsi</Label>
            <Textarea
              id="lesson-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan singkat materi."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {lessonCategoryLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kesulitan</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as ExamDifficulty)}>
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
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LESSON_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Thumbnail</Label>
            {thumbnail ? (
              <div className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                <img
                  src={thumbnail}
                  alt="Thumbnail lesson"
                  className="size-12 rounded object-cover"
                  loading="lazy"
                />
                <span className="min-w-0 flex-1 truncate">{thumbnail}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setThumbnail(null)}
                >
                  Hapus
                </Button>
              </div>
            ) : (
              <MediaPicker
                allowed={["image"]}
                folder="lesson"
                label="Unggah thumbnail"
                onChange={(asset) => setThumbnail(asset?.url ?? null)}
              />
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending} className="min-h-11">
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
