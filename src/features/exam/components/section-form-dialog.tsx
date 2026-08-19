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
import { useCreateSection, useUpdateSection } from "@/hooks/exam";
import { EXAM_SECTION_LABELS } from "@/features/exam/exam.constants";
import type { ExamSectionRow, ExamSectionType } from "@/types/exam";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  section?: ExamSectionRow | null;
};

export function SectionFormDialog({ open, onOpenChange, examId, section = null }: Props) {
  const [type, setType] = useState<ExamSectionType>("reading");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const pending = createSection.isPending || updateSection.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setType(section?.type ?? "reading");
    setTitle(section?.title ?? "");
    setInstruction(section?.instruction ?? "");
  }, [open, section]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 3) return setError("Judul section minimal 3 karakter.");

    try {
      if (section) {
        await updateSection.mutateAsync({
          id: section.id,
          input: { type, title: trimmed, instruction },
        });
        toast.success("Section diperbarui.");
      } else {
        await createSection.mutateAsync({ examId, input: { type, title: trimmed, instruction } });
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
          <DialogDescription>
            Section membagi ujian menjadi Reading dan Listening.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Tipe Section</Label>
            <Select value={type} onValueChange={(v) => setType(v as ExamSectionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXAM_SECTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="section-title">Judul</Label>
            <Input
              id="section-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bagian Reading"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="section-instruction">Instruksi</Label>
            <Textarea
              id="section-instruction"
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Bacalah teks berikut dengan saksama."
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
