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
import { Textarea } from "@/components/ui/textarea";
import { useCreateLessonSection, useUpdateLessonSection } from "@/hooks/lesson";
import type { LessonSectionRow } from "@/types/lesson";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  section?: LessonSectionRow | null;
};

export function LessonSectionFormDialog({ open, onOpenChange, lessonId, section = null }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSection = useCreateLessonSection();
  const updateSection = useUpdateLessonSection();
  const pending = createSection.isPending || updateSection.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(section?.title ?? "");
    setDescription(section?.description ?? "");
  }, [open, section]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 3) return setError("Judul section minimal 3 karakter.");

    try {
      if (section) {
        await updateSection.mutateAsync({ id: section.id, input: { title: trimmed, description } });
        toast.success("Section diperbarui.");
      } else {
        await createSection.mutateAsync({ lessonId, input: { title: trimmed, description } });
        toast.success("Section ditambahkan.");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{section ? "Ubah Section" : "Tambah Section"}</DialogTitle>
          <DialogDescription>Section mengelompokkan konten dan latihan materi.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="lsection-title">Judul</Label>
            <Input
              id="lsection-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kosakata Dasar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lsection-desc">Deskripsi</Label>
            <Textarea
              id="lsection-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Penjelasan singkat isi section."
            />
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
