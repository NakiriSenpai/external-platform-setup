import { Clock, Info, Lock, MonitorSmartphone, Play, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Modal "Sebelum Memulai Ujian" — aturan ujian saja.
 * TIDAK ada pilihan orientasi di sini: pergantian tampilan dilakukan
 * dari dalam halaman ujian lewat tombol "Ganti Tampilan".
 */
export function ExamRulesDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-3xl p-5 sm:p-7">
        <DialogHeader className="items-center space-y-3 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary-muted text-primary">
            <MonitorSmartphone className="size-7" />
          </span>
          <DialogTitle className="text-center text-xl font-bold">Sebelum Memulai Ujian</DialogTitle>
          <DialogDescription className="text-center text-sm">
            Harap baca aturan ujian berikut dengan seksama.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border rounded-2xl border border-border bg-card/60">
          <RuleSection
            icon={<Clock className="size-6" />}
            title="1. Timer Ujian"
            items={[
              "Ujian memiliki batas waktu sesuai paket yang dipilih.",
              "Timer akan terus berjalan selama ujian berlangsung.",
              "Pastikan Anda mengatur waktu dengan baik.",
            ]}
          />
          <RuleSection
            icon={<Lock className="size-6" />}
            title="2. Mode Secure Aktif"
            items={[
              "Mode Secure aktif selama ujian berlangsung.",
              "Keluar dari aplikasi atau halaman ujian dihitung sebagai pelanggaran.",
              "Menyalin teks dan mengambil screenshot dilarang.",
              "Fokuslah dan kerjakan ujian dengan jujur.",
            ]}
          />
          <RuleSection
            tone="danger"
            icon={<TriangleAlert className="size-6" />}
            title="3. Peringatan Keluar Halaman"
            items={[
              <>
                Setiap keluar dari halaman ujian menambah 1 pelanggaran, maksimal{" "}
                <span className="font-semibold text-destructive">3 kali</span>.
              </>,
              "Pelanggaran ke-3 membuat ujian otomatis dikumpulkan.",
              "Pastikan koneksi internet stabil dan jangan meninggalkan halaman ujian.",
            ]}
          />
          <RuleSection
            icon={<MonitorSmartphone className="size-6" />}
            title="4. Tampilan Landscape"
            items={[
              "Ingin menggunakan tampilan Landscape? Setelah masuk ke halaman ujian, cukup miringkan perangkat secara horizontal.",
              "Tampilan Landscape hanya aktif selama mengerjakan ujian. Halaman aplikasi lainnya tetap Portrait.",
            ]}
          />

        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-primary-muted p-3.5">
          <Info className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-foreground">
            Dengan menekan tombol “Mulai Ujian”, Anda menyetujui semua aturan di atas dan siap untuk
            memulai ujian.
          </p>
        </div>

        <div className="space-y-1.5">
          <Button
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-primary to-primary-hover text-base font-semibold"
            disabled={pending}
            onClick={onConfirm}
          >
            <Play className="mr-2 size-5" /> Mulai Ujian
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full rounded-2xl font-semibold text-primary"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RuleSection({
  icon,
  title,
  items,
  footer,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  items: React.ReactNode[];
  footer?: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex gap-3 p-4">
      <span
        className={
          "grid size-11 shrink-0 place-items-center rounded-xl " +
          (tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary-muted text-primary")
        }
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
        {footer}
      </div>
    </div>
  );
}
