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

/** Dialog konfirmasi melanjutkan attempt aktif (BUG 16). */
export function ContinueExamDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anda memiliki ujian yang belum selesai</AlertDialogTitle>
          <AlertDialogDescription>
            Ujian akan dilanjutkan dari posisi terakhir. Jawaban yang sudah tersimpan tetap
            tersedia. Lanjutkan ujian?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batalkan</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Lanjutkan</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Dialog konfirmasi pengumpulan ujian (BUG 7). */
export function SubmitExamDialog({
  open,
  unanswered,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  unanswered: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kumpulkan ujian?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-left text-sm">
              <p>Semua jawaban akan dikumpulkan.</p>
              <p>Waktu ujian tidak dapat dilanjutkan setelah dikumpulkan.</p>
              {unanswered > 0 ? (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 font-medium text-amber-700 dark:text-amber-300">
                  Masih ada {unanswered} soal yang belum dijawab.
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Kembali Mengerjakan</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            Kumpulkan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
