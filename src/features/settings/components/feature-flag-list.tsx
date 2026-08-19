import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAppConfig } from "@/hooks/config";
import { listFeatureFlags, setFeatureFlag } from "@/services/config";
import { useTenants } from "@/hooks/tenant";
import type { FeatureFlagRow } from "@/types/config";

/**
 * Pengelolaan feature flag (global & per tenant).
 * Flag hanya mengontrol ketersediaan fitur di UI, bukan hak akses.
 */
export function FeatureFlagList() {
  const { refresh } = useAppConfig();
  const flags = useQuery({ queryKey: ["feature-flags", "all"], queryFn: listFeatureFlags });
  const tenants = useTenants({ page: 1, pageSize: 100 });

  const mutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setFeatureFlag(id, enabled),
    onSuccess: async () => {
      toast.success("Feature flag diperbarui.");
      await Promise.all([flags.refetch(), refresh()]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tenantName = (id: string | null) =>
    tenants.data?.rows.find((tenant) => tenant.id === id)?.name ?? "Tenant";

  const rows = flags.data ?? [];
  const global = rows.filter((row) => row.tenant_id === null);
  const scoped = rows.filter((row) => row.tenant_id !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feature flags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {flags.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada feature flag. Jalankan migration Sprint 15 terlebih dahulu.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {global.map((row) => (
                <FlagRow
                  key={row.id}
                  row={row}
                  pending={mutation.isPending}
                  onToggle={(enabled) => mutation.mutate({ id: row.id, enabled })}
                />
              ))}
            </div>
            {scoped.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Override tenant
                </p>
                {scoped.map((row) => (
                  <FlagRow
                    key={row.id}
                    row={row}
                    badge={tenantName(row.tenant_id)}
                    pending={mutation.isPending}
                    onToggle={(enabled) => mutation.mutate({ id: row.id, enabled })}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FlagRow({
  row,
  badge,
  pending,
  onToggle,
}: {
  row: FeatureFlagRow;
  badge?: string;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{row.name}</span>
          {badge ? (
            <Badge variant="secondary" className="text-[10px]">
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{row.description ?? row.key}</p>
      </div>
      <Switch
        checked={row.enabled}
        disabled={pending}
        aria-label={`Aktifkan ${row.name}`}
        onCheckedChange={onToggle}
      />
    </div>
  );
}
