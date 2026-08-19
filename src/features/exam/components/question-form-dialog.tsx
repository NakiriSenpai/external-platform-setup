import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuestionForm, type QuestionFormProps } from "./question-form";

type Props = Omit<QuestionFormProps, "onDone" | "onCancel" | "resetKey"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Teks bantuan pada header dialog. */
  description?: string;
};

/**
 * Pembungkus dialog untuk `QuestionForm`. Seluruh logika soal tetap satu
 * sumber sehingga Exam Studio (inline) dan Lesson Studio (dialog) konsisten.
 */
export function QuestionFormDialog({
  open,
  onOpenChange,
  description = "Soal baru otomatis tersimpan ke Question Bank sehingga dapat dipakai ulang.",
  ...formProps
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formProps.question ? "Ubah Soal" : "Tambah Soal"}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open ? (
          <QuestionForm
            {...formProps}
            resetKey={open ? "open" : "closed"}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
