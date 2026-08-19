import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Primitif dashboard bersama agar Owner/Admin/Guru/Siswa terasa satu aplikasi. */

export function DashboardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

export function StatCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <Card className={cn(emphasis && "border-primary/40 bg-primary/5")}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-1 font-semibold text-foreground", emphasis ? "text-2xl" : "text-xl")}>
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <StatGrid>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
      ))}
    </StatGrid>
  );
}

export type ShortcutItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export function ShortcutGrid({ items }: { items: readonly ShortcutItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="block">
          <Card className="h-full transition-colors hover:border-primary/60">
            <CardContent className="flex min-h-[64px] items-start gap-3 p-4">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
