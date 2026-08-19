import { supabase } from "@/lib/supabase/client";
import type { TenantRow } from "@/types/database";
import { TABLES } from "@/types/database";

const COLUMNS =
  "id, name, slug, tenant_code, tagline, timezone, logo_url, is_active, created_by, created_at, updated_at";

export type TenantStatusFilter = "semua" | "aktif" | "nonaktif";

export type TenantListParams = {
  search?: string;
  status?: TenantStatusFilter;
  page?: number;
  pageSize?: number;
};

export type TenantListResult = {
  rows: TenantRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Ambil tenant berdasarkan id. */
export async function getTenantById(tenantId: string): Promise<TenantRow | null> {
  const { data, error } = await supabase
    .from(TABLES.tenants)
    .select(COLUMNS)
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error("Gagal memuat data lembaga.");
  return (data as TenantRow | null) ?? null;
}

/** Ambil tenant berdasarkan slug. */
export async function getTenantBySlug(slug: string): Promise<TenantRow | null> {
  const { data, error } = await supabase
    .from(TABLES.tenants)
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error("Gagal memuat data lembaga.");
  return (data as TenantRow | null) ?? null;
}

/** Daftar tenant dengan pencarian, filter status, dan pagination. */
export async function listTenants({
  search = "",
  status = "semua",
  page = 1,
  pageSize = 10,
}: TenantListParams = {}): Promise<TenantListResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(TABLES.tenants)
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const term = search.trim();
  if (term) {
    const safe = term.replace(/[%,()]/g, "");
    query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%,tenant_code.ilike.%${safe}%`);
  }
  if (status !== "semua") query = query.eq("is_active", status === "aktif");

  const { data, error, count } = await query;
  if (error) throw new Error("Gagal memuat daftar tenant.");

  const total = count ?? 0;
  return {
    rows: (data as TenantRow[] | null) ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
