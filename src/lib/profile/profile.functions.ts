import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { normalizeDisplayName, validateDisplayName } from "@/lib/profile/display-name";

/**
 * Ubah nama tampilan milik pemanggil sendiri.
 * userId tidak pernah diterima dari client: sumber kebenaran adalah sesi terverifikasi.
 */
export const updateDisplayName = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const value = (input as { displayName?: unknown } | null)?.displayName;
    if (typeof value !== "string") throw new Error("Nama tidak valid.");
    const message = validateDisplayName(value);
    if (message) throw new Error(message);
    return { displayName: normalizeDisplayName(value) };
  })
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

    // Isolasi: update dibatasi ke baris milik pemanggil (dan tenant-nya).
    let query = admin
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", caller.id);
    query = caller.tenantId ? query.eq("tenant_id", caller.tenantId) : query;

    const { error } = await query;
    if (error) throw new Error("Gagal menyimpan nama. Silakan coba lagi.");

    return { displayName: data.displayName };
  });
