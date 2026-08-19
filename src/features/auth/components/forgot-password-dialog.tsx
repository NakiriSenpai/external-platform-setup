import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";

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
import { requestPasswordReset } from "@/services/auth";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
};

/** Reset password memakai Supabase Auth yang sudah dipakai project (tanpa sistem baru). */
export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? "");
      setStatus("idle");
      setError(null);
    }
  }, [open, defaultEmail]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Masukkan email akun Anda.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      await requestPasswordReset(email);
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Gagal mengirim tautan reset.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => status !== "sending" && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lupa Password</DialogTitle>
          <DialogDescription>
            Kami akan mengirim tautan pengaturan ulang password ke email akun Anda. Bila tidak
            menerima email, hubungi pengelola lembaga Anda.
          </DialogDescription>
        </DialogHeader>

        {status === "sent" ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-xl bg-primary-muted p-3 text-sm">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Tautan reset password telah dikirim ke {email}.
            </p>
            <DialogFooter>
              <Button type="button" className="min-h-11 w-full" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email akun</Label>
              <Input
                id="reset-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nama@lembaga.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 rounded-xl"
                required
              />
            </div>

            {error ? (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => onOpenChange(false)}
                disabled={status === "sending"}
              >
                Batal
              </Button>
              <Button type="submit" className="min-h-11" disabled={status === "sending"}>
                {status === "sending" ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Kirim tautan
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
