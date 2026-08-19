import { Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { useAppConfig } from "@/hooks/config";
import { useAuth } from "@/hooks/auth";

/**
 * Maintenance mode berbasis server (tabel app_settings), bukan flag lokal.
 * Owner tetap dapat mengakses aplikasi untuk administrasi.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { config } = useAppConfig();
  const { role } = useAuth();

  if (!config.maintenance.enabled || role === "owner") return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Wrench className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">Sedang dalam pemeliharaan</h1>
        <p className="text-sm text-muted-foreground">{config.maintenance.message}</p>
        {config.supportEmail ? (
          <p className="text-xs text-muted-foreground">
            Butuh bantuan?{" "}
            <a className="text-primary underline" href={`mailto:${config.supportEmail}`}>
              {config.supportEmail}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
