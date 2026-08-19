import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useEffect, useMemo, type ReactNode } from "react";

import { DEFAULT_APP_CONFIG } from "@/lib/config/defaults";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/config/feature-flags";
import { APP_VERSION, BUILD_ID, resolveEnvironment } from "@/lib/config/version";
import { useAuth } from "@/hooks/auth";
import { getAppConfig } from "@/services/config/app-config.service";
import { listFeatureFlags, resolveFlags } from "@/services/config/feature-flags.service";
import type { AppConfig, FeatureFlagState } from "@/types/config";

export type AppConfigContextValue = {
  config: AppConfig;
  flags: FeatureFlagState;
  isFeatureEnabled: (key: FeatureFlagKey | string) => boolean;
  version: string;
  build: string;
  environment: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export const AppConfigContext = createContext<AppConfigContextValue | null>(null);

/** Menyalakan variabel CSS branding hanya bila Owner benar-benar mengaturnya. */
function applyBranding(config: AppConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const pairs: [string, string | null][] = [
    ["--primary", config.primaryColor],
    ["--secondary", config.secondaryColor],
    ["--accent", config.accentColor],
  ];
  for (const [name, value] of pairs) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }

  document.title = `${config.appName} — ${config.tagline}`.slice(0, 120);

  if (config.faviconUrl) {
    const link =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ??
      document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
    link.href = config.faviconUrl;
  }
}

/**
 * Satu-satunya sumber konfigurasi runtime (white label + feature flag).
 * Feature flag hanya mengontrol ketersediaan UI, BUKAN otorisasi.
 */
export function AppConfigProvider({ children }: { children: ReactNode }) {
  const { tenantId, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["app-config"],
    queryFn: getAppConfig,
    staleTime: 60_000,
  });

  const flagsQuery = useQuery({
    queryKey: ["feature-flags"],
    queryFn: listFeatureFlags,
    staleTime: 60_000,
    enabled: isAuthenticated,
  });

  const config = configQuery.data ?? DEFAULT_APP_CONFIG;

  useEffect(() => {
    applyBranding(config);
  }, [config]);

  const value = useMemo<AppConfigContextValue>(() => {
    const flags = flagsQuery.data
      ? resolveFlags(flagsQuery.data, tenantId)
      : { ...DEFAULT_FEATURE_FLAGS };
    return {
      config,
      flags,
      isFeatureEnabled: (key) => flags[key] ?? true,
      version: config.version || APP_VERSION,
      build: BUILD_ID,
      environment: resolveEnvironment(),
      isLoading: configQuery.isLoading,
      refresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["app-config"] }),
          queryClient.invalidateQueries({ queryKey: ["feature-flags"] }),
        ]);
      },
    };
  }, [config, flagsQuery.data, tenantId, configQuery.isLoading, queryClient]);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}
