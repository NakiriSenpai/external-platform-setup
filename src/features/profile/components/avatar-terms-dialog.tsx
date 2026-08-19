import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RULES = [
  "Gunakan foto yang jelas dan mudah dikenali.",
  "Foto harus menampilkan wajah pemilik akun dengan wajar.",
  "Jangan menggunakan foto yang mengandung konten pornografi atau seksual.",
  "Jangan menggunakan konten kekerasan/gore.",
  "Jangan menggunakan simbol atau materi yang melanggar hukum.",
  "Jangan menggunakan foto orang lain tanpa izin.",
  "Jangan menggunakan foto yang sengaja menyesatkan identitas akun.",
  "Gunakan gambar dengan kualitas yang cukup baik agar tetap jelas setelah dikompresi.",
  "Sistem akan otomatis melakukan crop, resize, dan compression sebelum foto disimpan.",
  "Foto profil dapat ditinjau/dihapus jika melanggar ketentuan komunitas.",
];

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function AvatarTermsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle>Ketentuan Foto Profil</DialogTitle>
          <DialogDescription>
            Aturan singkat yang berlaku untuk foto profil di aplikasi ini.
          </DialogDescription>
        </DialogHeader>

        <ol className="max-h-[50vh] list-decimal space-y-2 overflow-y-auto pl-5 text-sm text-muted-foreground">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>

        <p className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
          Ukuran file akan dikompresi secara otomatis untuk menjaga performa aplikasi.
        </p>

        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          Mengerti
        </Button>
      </DialogContent>
    </Dialog>
  );
}
