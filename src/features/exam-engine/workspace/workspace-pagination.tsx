import { ChevronLeft, ChevronRight, List, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Pagination tunggal untuk Exam Runner dan Review Jawaban.
 * Satu sumber gaya: ukuran, radius, spacing, ikon, dan disabled state identik.
 *
 * Bila `onSubmit` diberikan dan user berada di soal terakhir, tombol
 * "Selanjutnya" berubah menjadi "Submit" (memakai flow submit existing).
 */
export function WorkspacePagination({
  activeIndex,
  total,
  disabled = false,
  onPrev,
  onNext,
  onOpenList,
  onSubmit,
  submitPending,
}: {
  activeIndex: number;
  total: number;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenList: () => void;
  /** Aksi submit ujian (sama dengan tombol Submit di header). */
  onSubmit?: () => void;
  submitPending?: boolean;
}) {
  const isLast = activeIndex >= total - 1;
  const showSubmit = Boolean(onSubmit) && isLast;

  return (
    <>
      <div className="flex min-w-0 justify-start">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl px-3 text-xs sm:text-sm"
          disabled={disabled || activeIndex === 0}
          onClick={onPrev}
        >
          <ChevronLeft className="mr-1 size-4" /> Sebelumnya
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onOpenList}
        className="h-10 rounded-xl px-3 text-xs sm:text-sm"
      >
        <List className="mr-1.5 size-4" /> Daftar Soal
      </Button>
      <div className="flex justify-end">
        {showSubmit ? (
          <Button
            type="button"
            className="h-10 rounded-xl px-3 text-xs sm:text-sm"
            disabled={disabled || submitPending}
            onClick={onSubmit}
          >
            <Send className="mr-1.5 size-4" /> Submit
          </Button>
        ) : (
          <Button
            type="button"
            className="h-10 rounded-xl px-3 text-xs sm:text-sm"
            disabled={disabled || isLast}
            onClick={onNext}
          >
            Selanjutnya <ChevronRight className="ml-1 size-4" />
          </Button>
        )}
      </div>
    </>
  );
}

