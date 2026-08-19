import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { env } from "@/lib/env";

const payloadSchema = z.object({
  tenant: z.object({
    name: z.string().trim().min(3, "Nama tenant minimal 3 karakter.").max(120),
    tenantCode: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9-]+$/, "Tenant Code hanya huruf, angka, dan tanda hubung."),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, dan tanda hubung."),
    timezone: z.string().trim().min(3).max(64),
    logoUrl: z.string().trim().url().max(500).nullable().optional(),
    isActive: z.boolean(),
  }),
  admin: z.object({
    fullName: z.string().trim().min(3, "Nama admin minimal 3 karakter.").max(120),
    displayName: z.string().trim().min(2).max(60),
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9._-]+$/, "Username hanya huruf kecil, angka, titik, garis bawah, hubung."),
    email: z.string().trim().email("Format email tidak valid.").max(160),
    password: z.string().min(8, "Password sementara minimal 8 karakter.").max(72),
  }),
});

export type CreateTenantPayload = z.infer<typeof payloadSchema>;

/**
 * Membuat tenant baru beserta akun Admin pertama.
 * Hanya Owner yang diizinkan. Dijalankan di server memakai service role key.
 * Bila salah satu langkah gagal, seluruh perubahan dibatalkan (compensating rollback).
 */
export const createTenantWithAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => payloadSchema.parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");

    // Nama variabel dibaca lentur agar tetap jalan di preview maupun Cloudflare.
    const serviceKey =
      process.env["LPK_SUPABASE_SERVICE_ROLE_KEY"] ??
      process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
      process.env["LPK_SERVICE_ROLE_KEY"];
    if (!serviceKey) {
      throw new Error(
        "Konfigurasi server belum lengkap: secret LPK_SUPABASE_SERVICE_ROLE_KEY belum tersedia di runtime ini. " +
          "Tambahkan secret tersebut lalu publish ulang aplikasi.",
      );
    }

    const url = process.env["LPK_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? env.supabaseUrl;
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // Kunci format `sb_secret_` bukan JWT: kirim hanya lewat header apikey.
        // Hanya hapus Authorization bila isinya memang service key itu sendiri,
        // supaya permintaan lain (mis. verifikasi token user) tidak ikut rusak.
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (
            serviceKey.startsWith("sb_") &&
            headers.get("Authorization") === `Bearer ${serviceKey}`
          ) {
            headers.delete("Authorization");
          }
          headers.set("apikey", serviceKey);
          return fetch(input, { ...init, headers });
        },
      },
    });

    // 1) Verifikasi pemanggil adalah Owner berdasarkan JWT pada request.
    const authHeader = getRequestHeader("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");

    // Verifikasi langsung ke endpoint resmi Supabase Auth (bebas dari shim di atas).
    const verifyResponse = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!verifyResponse.ok) {
      throw new Error("Sesi tidak valid. Silakan masuk kembali.");
    }
    const verifiedUser = (await verifyResponse.json()) as { id?: string };
    if (!verifiedUser.id) throw new Error("Sesi tidak valid. Silakan masuk kembali.");

    const ownerId = verifiedUser.id;
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", ownerId)
      .maybeSingle();

    if (!ownerProfile || ownerProfile.role !== "owner" || ownerProfile.is_active !== true) {
      throw new Error("Hanya Pemilik yang dapat membuat tenant.");
    }

    const { tenant, admin: adminInput } = data;

    // 2) Validasi keunikan.
    const { data: dupTenant } = await admin
      .from("tenants")
      .select("id, slug, tenant_code")
      .or(`slug.eq.${tenant.slug},tenant_code.ilike.${tenant.tenantCode}`)
      .limit(1);
    if (dupTenant && dupTenant.length > 0) {
      const row = dupTenant[0] as { slug: string; tenant_code: string | null };
      throw new Error(
        row.slug === tenant.slug ? "Slug sudah digunakan." : "Tenant Code sudah digunakan.",
      );
    }

    const { data: dupProfile } = await admin
      .from("profiles")
      .select("id, username, email")
      .or(`username.ilike.${adminInput.username},email.ilike.${adminInput.email}`)
      .limit(1);
    if (dupProfile && dupProfile.length > 0) {
      const row = dupProfile[0] as { username: string | null; email: string | null };
      throw new Error(
        row.username?.toLowerCase() === adminInput.username.toLowerCase()
          ? "Username sudah digunakan."
          : "Email sudah digunakan.",
      );
    }

    // 3) Buat tenant.
    const { data: createdTenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: tenant.name,
        slug: tenant.slug,
        tenant_code: tenant.tenantCode.toUpperCase(),
        timezone: tenant.timezone,
        logo_url: tenant.logoUrl ?? null,
        is_active: tenant.isActive,
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (tenantError || !createdTenant) {
      throw new Error(
        `Gagal membuat tenant: ${tenantError?.message ?? "penyebab tidak diketahui"}`,
      );
    }

    const tenantId = createdTenant.id as string;

    // 4) Buat akun Supabase Auth untuk Admin pertama.
    const { data: createdUser, error: authError } = await admin.auth.admin.createUser({
      email: adminInput.email,
      password: adminInput.password,
      email_confirm: true,
      user_metadata: {
        full_name: adminInput.fullName,
        display_name: adminInput.displayName,
        username: adminInput.username,
        role: "admin",
        tenant_id: tenantId,
        created_by: ownerId,
      },
    });

    if (authError || !createdUser.user) {
      await admin.from("tenants").delete().eq("id", tenantId);
      throw new Error(
        `Gagal membuat akun admin: ${authError?.message ?? "penyebab tidak diketahui"}. Tenant dibatalkan.`,
      );
    }

    const adminUserId = createdUser.user.id;

    // 5) Pastikan profile tersinkron (trigger mungkin belum ada di database lama).
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: adminUserId,
        tenant_id: tenantId,
        role: "admin",
        email: adminInput.email,
        full_name: adminInput.fullName,
        display_name: adminInput.displayName,
        username: adminInput.username,
        created_by: ownerId,
        is_active: true,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(adminUserId);
      await admin.from("tenants").delete().eq("id", tenantId);
      throw new Error(`Gagal menyimpan profil admin: ${profileError.message}. Tenant dibatalkan.`);
    }

    return { tenantId, adminUserId };
  });

const updateSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(3, "Nama tenant minimal 3 karakter.").max(120),
  tagline: z.string().trim().max(160).nullable(),
  logoUrl: z.string().trim().url().max(500).nullable(),
  isActive: z.boolean(),
});

export type UpdateTenantPayload = z.infer<typeof updateSchema>;

/**
 * Memperbarui branding & status tenant.
 * Identitas pemanggil diambil dari Bearer token (bukan dari payload client),
 * lalu divalidasi: hanya Owner yang boleh mengubah tenant.
 */
export const updateTenantBranding = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const { createAdminClient, verifyCaller } = await import("@/lib/server/supabase-admin.server");
    const admin = createAdminClient();
    const caller = await verifyCaller(admin, getRequestHeader("authorization") ?? "");

    if (caller.role !== "owner") {
      throw new Error("Hanya Pemilik yang dapat mengubah data tenant.");
    }

    const { data: target } = await admin
      .from("tenants")
      .select("id")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (!target) throw new Error("Tenant tidak ditemukan.");

    const { error } = await admin
      .from("tenants")
      .update({
        name: data.name,
        tagline: data.tagline,
        logo_url: data.logoUrl,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.tenantId);

    if (error) throw new Error(`Gagal menyimpan tenant: ${error.message}`);
    return { tenantId: data.tenantId };
  });
