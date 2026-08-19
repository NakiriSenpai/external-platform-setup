import { supabase } from "@/lib/supabase/client";
import { DEFAULT_FEATURE_FLAGS } from "@/lib/config/feature-flags";
import type { FeatureFlagRow, FeatureFlagState } from "@/types/config";

const COLUMNS = "id, key, name, description, scope, tenant_id, enabled, updated_at, updated_by";

/** Seluruh flag yang dapat dibaca user saat ini (global + tenant miliknya). */
export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  const { data, error } = await supabase.from("feature_flags").select(COLUMNS).order("key");
  if (error) return [];
  return (data as FeatureFlagRow[] | null) ?? [];
}

/**
 * Resolusi flag efektif: global dulu, lalu ditimpa flag tenant bila ada.
 * Default seluruh fitur aktif agar aplikasi tetap berperilaku seperti semula.
 */
export function resolveFlags(rows: FeatureFlagRow[], tenantId: string | null): FeatureFlagState {
  const state: FeatureFlagState = { ...DEFAULT_FEATURE_FLAGS };
  for (const row of rows.filter((r) => r.tenant_id === null)) state[row.key] = row.enabled;
  if (tenantId) {
    for (const row of rows.filter((r) => r.tenant_id === tenantId)) state[row.key] = row.enabled;
  }
  return state;
}

/** Ubah status satu flag (RLS: hanya Owner). */
export async function setFeatureFlag(id: string, enabled: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("feature_flags")
    .update({
      enabled,
      updated_at: new Date().toISOString(),
      updated_by: auth.user?.id ?? null,
    })
    .eq("id", id);
  if (error) throw new Error("Gagal memperbarui feature flag.");
}
