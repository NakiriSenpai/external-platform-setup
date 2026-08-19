import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppConfig } from "@/hooks/config";
import { SERVER_ONLY_ENV, validatePublicEnv } from "@/lib/config/env-validation";
import { getServerEnvStatus } from "@/lib/config/server-env.functions";
import { ENVIRONMENT_LABEL, type AppEnvironment } from "@/lib/config/version";

/**
 * Audit kesiapan rilis: versi, environment, dan KETERSEDIAAN konfigurasi.
 * Nilai secret tidak pernah ditampilkan — hanya status ada/tidak ada.
 */
export function ReleaseChecklist() {
  const { version, build, environment } = useAppConfig();
  const publicEnv = validatePublicEnv();
  const server = useQuery({
    queryKey: ["server-env-status"],
    queryFn: () => getServerEnvStatus(),
    staleTime: 300_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kesiapan rilis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">Versi {version}</Badge>
          <Badge variant="secondary">Build {build}</Badge>
          <Badge>{ENVIRONMENT_LABEL[environment as AppEnvironment] ?? environment}</Badge>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Konfigurasi publik
          </p>
          {publicEnv.map((item) => (
            <StatusRow key={item.name} label={item.label} hint={item.name} ok={item.present} />
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Secret sisi server
          </p>
          {server.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : server.isError ? (
            <p className="text-sm text-muted-foreground">Status server tidak dapat dimuat.</p>
          ) : (
            <>
              <StatusRow
                label={SERVER_ONLY_ENV[0]?.label ?? "Service role Supabase"}
                hint="LPK_SUPABASE_SERVICE_ROLE_KEY"
                ok={Boolean(server.data?.serviceRoleKey)}
              />
              <StatusRow
                label="API key Cloudinary"
                hint="CLOUDINARY_API_KEY"
                ok={Boolean(server.data?.cloudinaryApiKey)}
              />
              <StatusRow
                label="API secret Cloudinary"
                hint="CLOUDINARY_API_SECRET"
                ok={Boolean(server.data?.cloudinaryApiSecret)}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, hint, ok }: { label: string; hint: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{hint}</p>
      </div>
      {ok ? (
        <span className="flex items-center gap-1 text-xs text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" /> Tersedia
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="size-4" aria-hidden="true" /> Belum diatur
        </span>
      )}
    </div>
  );
}
