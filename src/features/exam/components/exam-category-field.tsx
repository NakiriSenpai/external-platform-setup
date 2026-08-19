import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useCreateExamCategory, useExamCategories } from "@/hooks/exam/use-exam-category";
import type { ExamCategoryRow } from "@/services/exam/exam-category.service";

type Props = {
  value: string;
  onChange: (slug: string) => void;
  labelClassName?: string;
};

/**
 * Pemilih kategori exam + pembuatan kategori baru.
 * Satu-satunya sumber kategori (tabel exam_categories) untuk Tambah/Edit Exam.
 */
export function ExamCategoryField({ value, onChange, labelClassName }: Props) {
  const { data: categoryRows } = useExamCategories();
  const createCategory = useCreateExamCategory();
  const options = categoryRows ?? [];

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const addCategory = async () => {
    try {
      const created = (await createCategory.mutateAsync({ label: name })) as ExamCategoryRow;
      onChange(created.slug);
      setName("");
      setOpen(false);
      toast.success("Kategori ditambahkan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah kategori.");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className={labelClassName ?? "text-xs font-medium"}>Kategori</Label>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            {options.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Tambah kategori"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada kategori. Tekan “+” untuk membuat kategori pertama.
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Kategori</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-exam-category" className="text-xs font-medium">
              Nama Kategori
            </Label>
            <Input
              id="new-exam-category"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. EPS-TOPIK Reading"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              disabled={createCategory.isPending || name.trim().length < 2}
              onClick={() => void addCategory()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
