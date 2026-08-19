import { useContext } from "react";

import { AppConfigContext, type AppConfigContextValue } from "@/contexts/config/app-config-context";
import type { FeatureFlagKey } from "@/lib/config/feature-flags";

export function useAppConfig(): AppConfigContextValue {
  const context = useContext(AppConfigContext);
  if (!context) throw new Error("useAppConfig harus digunakan di dalam AppConfigProvider.");
  return context;
}

/** Feature flag hanya untuk menyembunyikan UI — otorisasi tetap RBAC + RLS. */
export function useFeatureEnabled(key: FeatureFlagKey | string): boolean {
  return useAppConfig().isFeatureEnabled(key);
}
