import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppConfig } from "@/hooks/config";
import { firstIssue, maintenanceSchema } from "@/lib/config/validation";
import { updateMaintenance } from "@/services/config";

/** Maintenance mode global. Owner tetap dapat mengakses aplikasi. */
export function MaintenanceCard() {
  const { config, refresh } = useAppConfig();
  const [enabled, setEnabled] = useState(config.maintenance.enabled);
  const [message, setMessage] = useState(config.maintenance.message);

  useEffect(() => {
    setEnabled(config.maintenance.enabled);
    setMessage(config.maintenance.message);
  }, [config.maintenance.enabled, config.maintenance.message]);

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = maintenanceSchema.safeParse({ enabled, message });
      if (!parsed.success) throw new Error(firstIssue(parsed.error));
      return updateMaintenance(parsed.data);
    },
    onSuccess: async () => {
      toast.success("Mode pemeliharaan diperbarui.");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mode pemeliharaan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="maintenance-toggle">Aktifkan pemeliharaan</Label>
            <p className="text-xs text-muted-foreground">
              Semua pengguna selain Pemilik akan melihat halaman pemeliharaan.
            </p>
          </div>
          <Switch id="maintenance-toggle" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maintenance-message">Pesan pemeliharaan</Label>
          <Textarea
            id="maintenance-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={300}
          />
        </div>

        {config.maintenance.startedAt ? (
          <p className="text-xs text-muted-foreground">
            Dimulai:{" "}
            {new Date(config.maintenance.startedAt).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}

        <Button
          className="min-h-11 w-full sm:w-auto"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </CardContent>
    </Card>
  );
}
