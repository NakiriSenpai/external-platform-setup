import { useState } from "react";
import { Bell } from "lucide-react";

import { NotificationCenter } from "@/features/notification/components/notification-center";
import { useAppConfig } from "@/hooks/config";
import { useNotifications } from "@/hooks/notification";
import { useCurrentTenant } from "@/hooks/tenant";

/**
 * Global header: branding tenant aktif (dari `profiles.tenant_id`) + notification bell.
 * Tidak ada branding hardcoded; fallback memakai konfigurasi aplikasi global.
 */
export function AppHeader() {
  const { data: tenant } = useCurrentTenant();
  const { config } = useAppConfig();
  const { data: notifications } = useNotifications();
  const [open, setOpen] = useState(false);

  const name = tenant?.name ?? config.appName;
  const tagline = tenant?.tagline ?? config.tagline;
  const logoUrl = tenant?.logo_url ?? config.logoUrl;
  const unread = (notifications ?? []).filter((item) => !item.readAt).length;

  return (
    <header className="sticky top-0 z-40 bg-background/80 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto w-full max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/80 px-3 py-2.5 shadow-[0_0_28px_-12px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-8 -top-10 size-32 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logo ${name}`}
                loading="lazy"
                className="size-11 shrink-0 rounded-xl border border-primary/30 bg-primary/10 object-cover shadow-[0_0_18px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
              />
            ) : (
              <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-sm font-bold text-primary">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
                {name}
              </p>
              {tagline ? (
                <p className="truncate text-[11px] text-primary/80 sm:text-xs">{tagline}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
              className="relative grid size-10 shrink-0 place-items-center rounded-full border border-primary/30 text-primary transition-colors hover:bg-primary/10"
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <NotificationCenter open={open} onOpenChange={setOpen} />
    </header>
  );
}
