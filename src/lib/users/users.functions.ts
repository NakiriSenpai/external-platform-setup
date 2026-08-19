import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const OWNER_NO_TENANT = "Owner belum memiliki tenant. Hubungi administrator platform.";
const CROSS_TENANT = "Anda hanya dapat mengelola user pada tenant Anda sendiri.";

const roleSchema = z.enum(["owner", "admin", "guru", "siswa"]);

const createSchema = z.object({
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter.").max(120),
  displayName: z.string().trim().min(2, "Display name minimal 2 karakter.").max(60),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Username hanya huruf kecil, angka, titik, garis bawah, hubung."),
  email: z.string().trim().email("Format email tidak valid.").max(160),
  password: z.string().min(8, "Password sementara minimal 8 karakter.").max(72),
  role: roleSchema,
  isActive: z.boolean(),
  avatarUrl: z.string().trim().url().max(500).nullable().optional(),
  tenantId: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter.").max(120),
  displayName: z.string().trim().min(2, "Display name minimal 2 karakter.").max(60),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Username hanya huruf kecil, angka, titik, garis bawah, hubung."),
  isActive: z.boolean(),
  avatarUrl: z.string().trim().url().max(500).nullable().optional(),
  role: roleSchema.optional(),
  tenantId: z.string().uuid().nullable().optional(),
});

const statusSchema = z.object({ userId: z.string().uuid(), isActive: z.boolean() });

const passwordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8, "Password sementara minimal 8 karakter.").max(72),
});

export type CreateUserPayload = z.infer<typeof createSchema>;
export type UpdateUserPayload = z.infer<typeof updateSchema>;
export type SetUserStatusPayload = z.infer<typeof statusSchema>;
export type ResetUserPasswordPayload = z.infer<typeof passwordSchema>;

/** Membuat user baru (Auth + profile) sesuai wewenang pemanggil. */
export const createUserAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

    let tenantId = data.tenantId ?? null;
    if (caller.role === "owner") {
      // Owner tidak boleh membuat Owner baru; role dari payload client tidak dipercaya.
      if (data.role === "owner") {
        throw new Error("Owner tidak dapat membuat akun Owner baru.");
      }
      // Owner memiliki tenant sendiri: user baru SELALU masuk tenant Owner.
      if (!caller.tenantId) throw new Error(OWNER_NO_TENANT);
      tenantId = caller.tenantId;
    } else if (caller.role === "admin") {
      if (data.role !== "guru" && data.role !== "siswa") {
        throw new Error("Admin hanya dapat membuat akun Guru atau Siswa.");
      }
      if (!caller.tenantId) throw new Error("Akun Anda belum terhubung ke tenant mana pun.");
      tenantId = caller.tenantId;
    } else {
      throw new Error("Anda tidak memiliki akses untuk membuat user.");
    }

    // Keunikan username & email.
    const { data: dup } = await admin
      .from("profiles")
      .select("id, username, email")
      .or(`username.ilike.${data.username},email.ilike.${data.email}`)
      .limit(1);
    if (dup && dup.length > 0) {
      const row = dup[0] as { username: string | null; email: string | null };
      throw new Error(
        row.username?.toLowerCase() === data.username.toLowerCase()
          ? "Username sudah digunakan."
          : "Email sudah digunakan.",
      );
    }

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        display_name: data.displayName,
        username: data.username,
        avatar_url: data.avatarUrl ?? null,
        role: data.role,
        tenant_id: tenantId,
        created_by: caller.id,
      },
    });

    if (authError || !created.user) {
      throw new Error(`Gagal membuat akun: ${authError?.message ?? "penyebab tidak diketahui"}`);
    }

    const userId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        tenant_id: tenantId,
        role: data.role,
        email: data.email,
        full_name: data.fullName,
        display_name: data.displayName,
        username: data.username,
        avatar_url: data.avatarUrl ?? null,
        created_by: caller.id,
        is_active: data.isActive,
      },
      { onConflict: "id" },
    );

    // Rollback bila profile gagal supaya tidak ada data setengah jadi.
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(`Gagal menyimpan profil: ${profileError.message}. Akun dibatalkan.`);
    }

    return { userId };
  });

/** Memperbarui data user. Role & tenant hanya boleh diubah Owner. */
export const updateUserAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

    const { data: target } = await admin
      .from("profiles")
      .select("id, role, tenant_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("User tidak ditemukan.");

    const patch: Record<string, unknown> = {
      full_name: data.fullName,
      display_name: data.displayName,
      username: data.username,
      is_active: data.isActive,
      avatar_url: data.avatarUrl ?? null,
    };

    if (caller.role === "owner") {
      // Owner ber-tenant hanya boleh mengelola user pada tenant miliknya.
      if (!caller.tenantId) throw new Error(OWNER_NO_TENANT);
      if (target.tenant_id !== caller.tenantId) throw new Error(CROSS_TENANT);
      // Promosi ke Owner dilarang; akun Owner yang sudah ada tetap Owner.
      if (data.role === "owner" && target.role !== "owner") {
        throw new Error("Owner tidak dapat mempromosikan user menjadi Owner.");
      }
      if (data.role) patch["role"] = data.role;
      patch["tenant_id"] = caller.tenantId;
    } else if (caller.role === "admin") {
      if (target.tenant_id !== caller.tenantId) {
        throw new Error("Anda hanya dapat mengelola user pada tenant Anda sendiri.");
      }
      if (target.role !== "guru" && target.role !== "siswa") {
        throw new Error("Admin tidak dapat mengubah akun Owner maupun Admin lain.");
      }
    } else {
      throw new Error("Anda tidak memiliki akses untuk mengubah user.");
    }

    // Username tetap unik lintas user.
    const { data: dup } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .neq("id", data.userId)
      .limit(1);
    if (dup && dup.length > 0) throw new Error("Username sudah digunakan.");

    const { error } = await admin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(`Gagal memperbarui user: ${error.message}`);

    await admin.auth.admin.updateUserById(data.userId, {
      user_metadata: {
        full_name: data.fullName,
        display_name: data.displayName,
        username: data.username,
        avatar_url: data.avatarUrl ?? null,
        role: (patch["role"] as string | undefined) ?? target.role,
        tenant_id: (patch["tenant_id"] as string | null | undefined) ?? target.tenant_id,
      },
    });

    return { userId: data.userId };
  });

/** Mengaktifkan atau menonaktifkan user. */
export const setUserStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

    const { data: target } = await admin
      .from("profiles")
      .select("id, role, tenant_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("User tidak ditemukan.");
    if (target.id === caller.id) throw new Error("Anda tidak dapat mengubah status akun sendiri.");

    if (caller.role === "admin") {
      if (target.tenant_id !== caller.tenantId) {
        throw new Error("Anda hanya dapat mengelola user pada tenant Anda sendiri.");
      }
      if (target.role !== "guru" && target.role !== "siswa") {
        throw new Error("Admin tidak dapat mengubah akun Owner maupun Admin lain.");
      }
    } else if (caller.role === "owner") {
      if (!caller.tenantId) throw new Error(OWNER_NO_TENANT);
      if (target.tenant_id !== caller.tenantId) throw new Error(CROSS_TENANT);
    } else {
      throw new Error("Anda tidak memiliki akses untuk mengubah status user.");
    }

    const { error } = await admin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.userId);
    if (error) throw new Error(`Gagal mengubah status user: ${error.message}`);

    return { userId: data.userId, isActive: data.isActive };
  });

/** Mengganti password sementara user melalui Auth Admin API resmi. */
export const resetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => passwordSchema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

    const { data: target } = await admin
      .from("profiles")
      .select("id, role, tenant_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("User tidak ditemukan.");

    if (caller.role === "admin") {
      if (target.tenant_id !== caller.tenantId) {
        throw new Error("Anda hanya dapat mengelola user pada tenant Anda sendiri.");
      }
      if (target.role !== "guru" && target.role !== "siswa") {
        throw new Error("Admin tidak dapat mengubah akun Owner maupun Admin lain.");
      }
    } else if (caller.role === "owner") {
      if (!caller.tenantId) throw new Error(OWNER_NO_TENANT);
      if (target.tenant_id !== caller.tenantId) throw new Error(CROSS_TENANT);
    } else {
      throw new Error("Anda tidak memiliki akses untuk mengatur ulang password.");
    }

    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(`Gagal mengatur ulang password: ${error.message}`);

    return { userId: data.userId };
  });
