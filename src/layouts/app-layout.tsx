import { useEffect, useState, type ReactNode } from "react";

import { MaintenanceGate } from "@/components/common/maintenance-gate";
import { AppHeader } from "@/features/shell/components/app-header";
import { BottomNav, NAV_BY_ROLE } from "@/features/shell/components/bottom-nav";
import { useAuth } from "@/hooks/auth";
import { useAppConfig } from "@/hooks/config";

/** Bottom navigation disembunyikan saat ujian berjalan di mode layar penuh. */
function useIsFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handler();
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  return isFullscreen;
}

/**
 * App shell global: header branding tenant + konten + bottom navigation role-aware.
 * Halaman tidak boleh menduplikasi header/bottom nav.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { role, isAuthenticated } = useAuth();
  const { config, isFeatureEnabled, version } = useAppConfig();
  const isFullscreen = useIsFullscreen();

  // Catat kehadiran harian siswa untuk tab Attendance pada analitik.
  useActivityHeartbeat(isAuthenticated && role === "siswa");



  const navItems = (role ? NAV_BY_ROLE[role] : NAV_BY_ROLE.siswa).filter(
    (item) => !item.flag || isFeatureEnabled(item.flag),
  );

  if (isFullscreen) {
    return (
      <MaintenanceGate>
        <div className="min-h-screen bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-foreground">
          <main className="mx-auto w-full max-w-5xl px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">{children}</main>
        </div>
      </MaintenanceGate>
    );
  }

  return (
    <MaintenanceGate>
      <div className="flex min-h-screen flex-col bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-foreground">
        {isAuthenticated ? <AppHeader /> : null}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {children}
          <p className="pt-8 text-center text-[11px] text-muted-foreground">
            {config.appName} · v{version}
          </p>
        </main>

        {isAuthenticated ? <BottomNav items={navItems} /> : null}
      </div>
    </MaintenanceGate>
  );
}
