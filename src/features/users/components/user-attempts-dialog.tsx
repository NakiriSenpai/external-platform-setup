import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useDeleteAttempt, useUserAttempts } from "@/hooks/attempt";
import { formatDurasi } from "@/types/attempt";
import type { ProfileRow } from "@/types/database";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Riwayat ujian per user dengan aksi hapus satu attempt (Owner only). */
export function UserAttemptsDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileRow | null;
}) {
  const { data, isLoading } = useUserAttempts(open ? (user?.id ?? null) : null);
  const deleteAttempt = useDeleteAttempt();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = (data ?? []).filter((a) => a.status !== "in_progress");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Riwayat Ujian</DialogTitle>
          <DialogDescription className="truncate">
            {user?.full_name ?? user?.username ?? "User"} · {rows.length} percobaan
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat riwayat…
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            User ini belum memiliki riwayat ujian.
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-auto">
            {rows.map((attempt) => (
              <li
                key={attempt.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">{attempt.exam_title}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {Number(attempt.score ?? 0).toFixed(0)}
                    </span>
                    <Badge variant={attempt.passed ? "default" : "destructive"}>
                      {attempt.passed ? "Lulus" : "Belum Lulus"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {dateFormatter.format(
                        new Date(
                          attempt.submitted_at ?? attempt.finished_at ?? attempt.created_at,
                        ),
                      )}{" "}
                      · {formatDurasi(attempt.duration_seconds ?? 0)}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Hapus riwayat ${attempt.exam_title}`}
                  onClick={() => setDeleteId(attempt.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <AlertDialog
          open={Boolean(deleteId)}
          onOpenChange={(next) => {
            if (!next) setDeleteId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus riwayat ujian ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Satu percobaan beserta jawaban dan hasilnya akan dihapus permanen. Riwayat lain
                milik user ini tidak terpengaruh.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteAttempt.isPending}
                onClick={async (event) => {
                  event.preventDefault();
                  if (!deleteId) return;
                  try {
                    await deleteAttempt.mutateAsync(deleteId);
                    toast.success("Riwayat ujian dihapus.");
                    setDeleteId(null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Gagal menghapus riwayat.");
                  }
                }}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
