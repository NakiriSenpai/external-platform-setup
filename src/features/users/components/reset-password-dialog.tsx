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
import { useResetPassword } from "@/hooks/users";
import type { ProfileRow } from "@/types/database";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileRow | null;
};

export function ResetPasswordDialog({ open, onOpenChange, user }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = useResetPassword();

  useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError(null);
    try {
      await reset.mutateAsync({ userId: user.id, password });
      toast.success("Password sementara berhasil diperbarui.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengatur ulang password.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !reset.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Tetapkan password sementara untuk {user?.full_name ?? user?.email ?? "user ini"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Password Sementara</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="min-h-11"
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
              disabled={reset.isPending}
            >
              Batal
            </Button>
            <Button type="submit" className="min-h-11" disabled={reset.isPending}>
              {reset.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
