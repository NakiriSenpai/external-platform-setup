import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/** Cooldown ganti foto profil: 30 hari (hard rule di server). */
export const AVATAR_COOLDOWN_DAYS = 30;

const commitSchema = z.object({
  avatarUrl: z.string().trim().url().max(500),
  publicId: z.string().trim().min(1).max(300),
});

export type AvatarCooldownStatus = {
  canChange: boolean;
  /** true bila role pemanggil tidak terkena cooldown (owner/admin/guru). */
  exempt: boolean;
  lastChangedAt: string | null;
  nextAllowedAt: string | null;
  daysRemaining: number;
};

/** Hanya role `siswa` yang terkena cooldown. Role ditentukan di server. */
function isCooldownRole(role: string): boolean {
  return role === "siswa";
}

function cooldownStatus(lastChangedAt: string | null, exempt = false): AvatarCooldownStatus {
  if (exempt || !lastChangedAt) {
    return { canChange: true, exempt, lastChangedAt, nextAllowedAt: null, daysRemaining: 0 };
  }
  const last = new Date(lastChangedAt).getTime();
  const next = last + AVATAR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remaining = next - Date.now();
  return {
    canChange: remaining <= 0,
    exempt: false,
    lastChangedAt,
    nextAllowedAt: new Date(next).toISOString(),
    daysRemaining: remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000)),
  };
}

/** Status cooldown foto profil milik pemanggil sendiri. */
export const getAvatarCooldown = createServerFn({ method: "GET" }).handler(async () => {
  const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
  const admin = createAdminClient();
  const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

  const { data, error } = await admin
    .from("profiles")
    .select("avatar_updated_at")
    .eq("id", caller.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Kolom cooldown avatar belum tersedia di database. Jalankan migrasi profile avatar terlebih dahulu.",
    );
  }

  return cooldownStatus(
    (data?.["avatar_updated_at"] as string | null) ?? null,
    !isCooldownRole(caller.role),
  );
});

/**
 * Simpan avatar baru milik pemanggil sendiri.
 * Urutan aman: (client upload baru) -> update DB di sini -> (client hapus aset lama).
 * Pemanggil hanya dapat mengubah avatar dirinya sendiri; path wajib sesuai tenant & user.
 */
export const commitAvatarChange = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => commitSchema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

    // Isolasi multi-tenant: public_id wajib berada di folder milik tenant & user pemanggil.
    const expectedPrefix = `profile/${caller.tenantId ?? "platform"}/${caller.id}/`;
    if (!data.publicId.startsWith(expectedPrefix)) {
      throw new Error("Lokasi penyimpanan foto tidak sah.");
    }

    const { data: current, error: readError } = await admin
      .from("profiles")
      .select("avatar_url, avatar_public_id, avatar_updated_at")
      .eq("id", caller.id)
      .maybeSingle();

    if (readError) {
      throw new Error(
        "Kolom avatar belum lengkap di database. Jalankan migrasi profile avatar terlebih dahulu.",
      );
    }

    const exempt = !isCooldownRole(caller.role);
    const status = cooldownStatus(
      (current?.["avatar_updated_at"] as string | null) ?? null,
      exempt,
    );
    if (!status.canChange) {
      throw new Error(
        `Anda baru mengubah foto profil. Dapat diubah kembali dalam ${status.daysRemaining} hari.`,
      );
    }

    const previousPublicId = (current?.["avatar_public_id"] as string | null) ?? null;

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        avatar_url: data.avatarUrl,
        avatar_public_id: data.publicId,
        avatar_updated_at: new Date().toISOString(),
      })
      .eq("id", caller.id);

    if (updateError) throw new Error("Gagal menyimpan foto profil. Silakan coba lagi.");

    return {
      avatarUrl: data.avatarUrl,
      previousPublicId,
      cooldown: cooldownStatus(new Date().toISOString(), exempt),
    };
  });
