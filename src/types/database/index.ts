import type { AppRole } from "@/types/auth";

/** Baris tabel public.tenants */
export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  tenant_code: string | null;
  tagline: string | null;
  timezone: string;
  logo_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Baris tabel public.profiles */
export type ProfileRow = {
  id: string;
  tenant_id: string | null;
  role: AppRole;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export const TABLES = {
  profiles: "profiles",
  tenants: "tenants",
} as const;

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow };
      tenants: { Row: TenantRow };
    };
  };
};
