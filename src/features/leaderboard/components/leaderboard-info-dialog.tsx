import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Perhitungan",
    body: [
      "Skor berasal dari attempt pertama yang selesai pada setiap ujian. Attempt berikutnya tidak mengubah skor leaderboard.",
    ],
  },
  {
    title: "Ujian Dikerjakan",
    body: [
      "Jumlah ujian menghitung seluruh attempt yang sudah selesai. Attempt in progress dan cancelled tidak dihitung.",
    ],
  },
  {
    title: "Mode Leaderboard",
    body: [
      "Semua — Total skor dari seluruh ujian.",
      "Per Exam — Menampilkan jumlah attempt selesai dan skor attempt selesai pertama dari ujian yang dipilih.",
    ],
  },
  {
    title: "Peringkat Real-time",
    body: [
      "Peringkat diperbarui secara otomatis ketika siswa menyelesaikan ujian.",
    ],
  },
  {
    title: "Tenant",
    body: [
      "Leaderboard hanya menampilkan siswa dari tenant yang sedang aktif. Data antar tenant tidak digabungkan.",
    ],
  },
  {
    title: "Catatan",
    body: ["Hanya siswa aktif yang ditampilkan dalam leaderboard."],
  },
];

/** Modal penjelasan leaderboard (tombol "i" di header). */
export function LeaderboardInfoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-primary/25 bg-card shadow-[0_0_40px_hsl(var(--primary)/0.15)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Tentang Leaderboard
          </DialogTitle>
          <DialogDescription className="sr-only">
            Penjelasan perhitungan dan aturan papan peringkat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <section key={s.title} className="rounded-xl border border-border bg-background/40 p-3">
              <h3 className="text-sm font-semibold text-primary">{s.title}</h3>
              <div className="mt-1 space-y-1">
                {s.body.map((line) => (
                  <p key={line} className="text-xs leading-relaxed text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <DialogFooter>
          <Button className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
            Mengerti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
