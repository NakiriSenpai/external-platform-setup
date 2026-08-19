import type { ReactNode } from "react";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { initials } from "../analytics-utils";

/** Kartu metrik ringkas dengan aksen ungu opsional. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass = {
    default: "bg-card",
    primary: "bg-primary text-primary-foreground",
    success: "bg-success/12 border-success/30",
    warning: "bg-warning/12 border-warning/30",
    danger: "bg-destructive/10 border-destructive/30",
  }[tone];

  const isSolid = tone === "primary";

  return (
    <Card className={cn("overflow-hidden rounded-2xl border shadow-sm", toneClass, className)}>
      <CardContent className="min-w-0 space-y-1 p-3.5">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <Icon
              className={cn(
                "size-3.5 shrink-0",
                isSolid ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            />
          ) : null}
          <p
            className={cn(
              "truncate text-[11px] font-medium",
              isSolid ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
        </div>
        <p
          className={cn(
            "truncate text-xl font-bold tabular-nums",
            isSolid ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p
            className={cn(
              "truncate text-[11px]",
              isSolid ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatTileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{children}</div>;
}

/** Kartu section dengan judul, deskripsi, dan aksi kanan. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl border shadow-sm", className)}>
      {title || action ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <CardContent className={cn("p-4", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

export function AnalyticsEmpty({
  title = "Belum ada data",
  description = "Data akan muncul setelah siswa menyelesaikan ujian pada rentang ini.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="space-y-2 px-4 py-10 text-center">
      <BarChart3 className="mx-auto size-7 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function AnalyticsError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="space-y-3 px-4 py-8 text-center">
      <AlertTriangle className="mx-auto size-7 text-destructive" />
      <p className="text-sm font-medium text-foreground">Data tidak dapat dimuat</p>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function AnalyticsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function StudentAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9 shrink-0", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className="bg-primary-muted text-[11px] font-semibold text-primary">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Bar metrik horizontal dengan label kiri-kanan. */
export function MetricRow({
  label,
  value,
  display,
  tone = "primary",
}: {
  label: string;
  value: number;
  display: string;
  tone?: "primary" | "success" | "danger" | "warning";
}) {
  const indicator = {
    primary: "[&>[data-slot=progress-indicator]]:bg-primary",
    success: "[&>[data-slot=progress-indicator]]:bg-success",
    danger: "[&>[data-slot=progress-indicator]]:bg-destructive",
    warning: "[&>[data-slot=progress-indicator]]:bg-warning",
  }[tone];

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-foreground">{display}</span>
      </div>
      <Progress value={Math.max(0, Math.min(100, value))} className={cn("h-1.5", indicator)} />
    </div>
  );
}

/** Wrapper tabel: scroll horizontal aman di mobile. */
export function ScrollArea({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-auto">
      <div className="min-w-max">{children}</div>
    </div>
  );
}
