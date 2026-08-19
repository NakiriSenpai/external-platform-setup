import { useMemo, useState } from "react";
import { History, KeyRound, Pencil, Plus, Power, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/auth";
import { useSetUserActive, useUsers } from "@/hooks/users";
import { useTenants } from "@/hooks/tenant";
import type { UserRoleFilter, UserStatusFilter } from "@/services/users";
import { ROLE_LABELS } from "@/types/auth";
import type { ProfileRow } from "@/types/database";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { UserAttemptsDialog } from "./user-attempts-dialog";
import { UserFormDialog } from "./user-form-dialog";

const PAGE_SIZE = 10;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = { scope: "owner" | "admin" };

export function UserList({ scope }: Props) {
  const { profile } = useAuth();
  // Owner memiliki tenant sendiri: daftar dibatasi ke tenant miliknya.
  const tenantId = profile?.tenant_id ?? null;


  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRoleFilter>("semua");
  const [status, setStatus] = useState<UserStatusFilter>("semua");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [selected, setSelected] = useState<ProfileRow | null>(null);

  const params = useMemo(
    () => ({ search, role, status, tenantId, page, pageSize: PAGE_SIZE }),
    [search, role, status, tenantId, page],
  );
  const { data, isLoading, isError } = useUsers(params);
  const setActive = useSetUserActive();
  const tenantsQuery = useTenants({ page: 1, pageSize: 100, status: "semua" });

  const tenantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const tenant of tenantsQuery.data?.rows ?? []) map.set(tenant.id, tenant.name);
    return map;
  }, [tenantsQuery.data]);

  const canManage = (user: ProfileRow) =>
    scope === "owner" || user.role === "guru" || user.role === "siswa";

  const toggleActive = async (user: ProfileRow) => {
    try {
      await setActive.mutateAsync({ userId: user.id, isActive: !user.is_active });
      toast.success(user.is_active ? "User dinonaktifkan." : "User diaktifkan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status user.");
    }
  };

  const resetFilterPage = () => setPage(1);

  // Arsitektur baru: setiap Owner wajib punya tenant sendiri (tanpa mode global).
  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Manajemen User</h1>
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          Owner belum memiliki tenant. Hubungi administrator platform.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Manajemen User</h1>
          <p className="text-sm text-muted-foreground">
            {scope === "owner"
              ? "Kelola seluruh pengguna pada tenant Anda."
              : "Kelola guru dan siswa pada lembaga Anda."}
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setSelected(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> Tambah User
        </Button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari nama, username, atau email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetFilterPage();
            }}
            aria-label="Cari user"
          />
        </div>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v as UserRoleFilter);
            resetFilterPage();
          }}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Role</SelectItem>
            {(scope === "owner"
              ? (["owner", "admin", "guru", "siswa"] as const)
              : (["admin", "guru", "siswa"] as const)
            ).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as UserStatusFilter);
            resetFilterPage();
          }}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="aktif">Aktif</SelectItem>
            <SelectItem value="nonaktif">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Gagal memuat daftar user.
        </p>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada user yang cocok dengan filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {data?.rows.map((user) => (
            <li key={user.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={`Avatar ${user.full_name ?? user.username ?? "user"}`}
                    loading="lazy"
                    className="size-11 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold">
                    {(user.full_name ?? user.username ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{user.full_name ?? "Tanpa nama"}</p>
                    <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>
                      <dt className="font-medium text-foreground/70">Display Name</dt>
                      <dd className="truncate">{user.display_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground/70">Username</dt>
                      <dd className="truncate">{user.username ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground/70">Email</dt>
                      <dd className="truncate">{user.email ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground/70">Tenant</dt>
                      <dd className="truncate">
                        {user.tenant_id ? (tenantNames.get(user.tenant_id) ?? "—") : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground/70">Terakhir Login</dt>
                      <dd>{formatDate(user.last_login_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground/70">Dibuat</dt>
                      <dd>{formatDate(user.created_at)}</dd>
                    </div>
                  </dl>

                  {canManage(user) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(user);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 size-3.5" /> Ubah
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(user);
                          setResetOpen(true);
                        }}
                      >
                        <KeyRound className="mr-1 size-3.5" /> Reset Password
                      </Button>
                      {scope === "owner" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(user);
                            setAttemptsOpen(true);
                          }}
                        >
                          <History className="mr-1 size-3.5" /> Riwayat Ujian
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant={user.is_active ? "secondary" : "default"}
                        disabled={setActive.isPending || user.id === profile?.id}
                        onClick={() => void toggleActive(user)}
                      >
                        <Power className="mr-1 size-3.5" />
                        {user.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > 0 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Halaman {data.page} dari {data.totalPages} · {data.total} user
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        scope={scope}
        fixedTenantId={tenantId}
        user={selected}
      />
      <ResetPasswordDialog open={resetOpen} onOpenChange={setResetOpen} user={selected} />
      <UserAttemptsDialog open={attemptsOpen} onOpenChange={setAttemptsOpen} user={selected} />
    </section>
  );
}
