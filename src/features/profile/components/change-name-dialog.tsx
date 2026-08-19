import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/auth";
import { DISPLAY_NAME_MAX, validateDisplayName } from "@/lib/profile/display-name";
import { updateDisplayName } from "@/lib/profile/profile.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
};

export function ChangeNameDialog({ open, onOpenChange, currentName }: Props) {
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setError(null);
    }
  }, [open, currentName]);

  const handleSave = async () => {
    const message = validateDisplayName(value);
    if (message) {
      setError(message);
      return;
    }
    setIsSaving(true);
    try {
      await updateDisplayName({ data: { displayName: value } });
      await refreshProfile();
      // Sinkronkan semua UI lain yang memakai nama (dashboard, header, user menu).
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Nama berhasil diperbarui.");
      onOpenChange(false);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Gagal menyimpan nama.";
      setError(text);
      toast.error(text);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle>Ganti Nama</DialogTitle>
          <DialogDescription>Perbarui nama yang akan ditampilkan di aplikasi.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-display-name">Nama baru</Label>
          <Input
            id="new-display-name"
            value={value}
            maxLength={DISPLAY_NAME_MAX + 10}
            autoComplete="off"
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "new-display-name-error" : undefined}
          />
          {error ? (
            <p id="new-display-name-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              3–20 karakter. Huruf, angka, spasi, _ dan - diperbolehkan.
            </p>
          )}
        </div>

        <div className="mt-2 space-y-3">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Simpan
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            Batal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
