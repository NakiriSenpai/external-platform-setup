import { useMemo, useState } from "react";
import { Pencil, Plus, Power, Search } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useUpdateTenant } from "@/hooks/owner";
import { useTenants } from "@/hooks/tenant";
import type { TenantStatusFilter } from "@/services/tenant";
import type { TenantRow } from "@/types/database";
import { TenantEditDialog } from "./tenant-edit-dialog";
import { TenantFormDialog } from "./tenant-form-dialog";

const PAGE_SIZE = 10;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TenantCard({ tenant, onEdit }: { tenant: TenantRow; onEdit: (t: TenantRow) => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateTenant = useUpdateTenant();

  const toggleStatus = async () => {
    try {
      await updateTenant.mutateAsync({
        tenantId: tenant.id,
        name: tenant.name,
        tagline: tenant.tagline,
        logoUrl: tenant.logo_url,
        isActive: !tenant.is_active,
      });
      toast.success(tenant.is_active ? "Tenant dinonaktifkan." : "Tenant diaktifkan.");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status tenant.");
    }
  };

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        {tenant.logo_url ? (
          <img
            src={tenant.logo_url}
            alt={`Logo ${tenant.name}`}
            loading="lazy"
            className="size-11 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-sm font-semibold">
            {tenant.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{tenant.name}</p>
            <Badge variant={tenant.is_active ? "default" : "secondary"}>
              {tenant.is_active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          {tenant.tagline ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tenant.tagline}</p>
          ) : null}
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground/70">Tenant Code</dt>
              <dd>{tenant.tenant_code ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground/70">Slug</dt>
              <dd className="truncate">{tenant.slug}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground/70">Timezone</dt>
              <dd>{tenant.timezone}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground/70">Dibuat</dt>
              <dd>{formatDate(tenant.created_at)}</dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(tenant)}>
              <Pencil className="mr-1 size-4" /> Edit
            </Button>
            <Button
              size="sm"
              variant={tenant.is_active ? "ghost" : "secondary"}
              onClick={() => setConfirmOpen(true)}
            >
              <Power className="mr-1 size-4" />
              {tenant.is_active ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tenant.is_active ? "Nonaktifkan tenant?" : "Aktifkan tenant?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tenant.is_active
                ? `Pengguna pada tenant “${tenant.name}” tidak lagi dapat menggunakan aplikasi sesuai aturan akses yang berlaku.`
                : `Pengguna pada tenant “${tenant.name}” kembali dapat menggunakan aplikasi.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateTenant.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void toggleStatus();
              }}
              disabled={updateTenant.isPending}
            >
              {tenant.is_active ? "Nonaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function TenantList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantStatusFilter>("semua");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRow | null>(null);

  const params = useMemo(
    () => ({ search, status, page, pageSize: PAGE_SIZE }),
    [search, status, page],
  );
  const { data, isLoading, isError } = useTenants(params);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Manajemen Tenant</h1>
          <p className="text-sm text-muted-foreground">
            Daftar lembaga yang terdaftar pada platform.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="min-h-11">
          <Plus className="mr-1 size-4" /> Tambah Tenant
        </Button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari nama, kode, atau slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Cari tenant"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as TenantStatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter status">
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
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Gagal memuat daftar tenant.
        </p>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada tenant. Tekan “Tambah Tenant” untuk membuat yang pertama.
        </p>
      ) : (
        <ul className="space-y-2">
          {data?.rows.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} onEdit={setEditing} />
          ))}
        </ul>
      )}

      {data && data.total > 0 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Halaman {data.page} dari {data.totalPages} · {data.total} tenant
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

      <TenantFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <TenantEditDialog
        tenant={editing}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      />
    </section>
  );
}
