import {
  createTenantWithAdmin,
  updateTenantBranding,
  type CreateTenantPayload,
  type UpdateTenantPayload,
} from "@/lib/owner/tenants.functions";

export type { CreateTenantPayload, UpdateTenantPayload };

/** Membuat tenant + akun admin pertama (dieksekusi di server, khusus Owner). */
export async function createTenant(payload: CreateTenantPayload) {
  return createTenantWithAdmin({ data: payload });
}

/** Memperbarui branding & status tenant (validasi Owner di server). */
export async function updateTenant(payload: UpdateTenantPayload) {
  return updateTenantBranding({ data: payload });
}
