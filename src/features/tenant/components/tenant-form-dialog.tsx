import { useState, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTenant } from "@/hooks/owner";
import { uploadToCloudinary } from "@/services/cloudinary.service";
import {
  DEFAULT_TIMEZONE,
  TIMEZONES,
  toSlug,
  toTenantCode,
} from "@/features/tenant/tenant.constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialForm = {
  name: "",
  tenantCode: "",
  slug: "",
  timezone: DEFAULT_TIMEZONE as string,
  logoUrl: "",
  isActive: "aktif",
  adminFullName: "",
  adminDisplayName: "",
  adminUsername: "",
  adminEmail: "",
  adminPassword: "",
};

export function TenantFormDialog({ open, onOpenChange }: Props) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const createTenant = useCreateTenant();

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, {
        folder: "lpk/tenants",
        resourceType: "image",
      });
      set("logoUrl", result.secureUrl);
      toast.success("Logo berhasil diunggah.");
    } catch {
      toast.error("Gagal mengunggah logo ke Cloudinary.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createTenant.mutateAsync({
        tenant: {
          name: form.name,
          tenantCode: toTenantCode(form.tenantCode || form.name),
          slug: toSlug(form.slug || form.name),
          timezone: form.timezone,
          logoUrl: form.logoUrl ? form.logoUrl : null,
          isActive: form.isActive === "aktif",
        },
        admin: {
          fullName: form.adminFullName,
          displayName: form.adminDisplayName || form.adminFullName,
          username: form.adminUsername.toLowerCase(),
          email: form.adminEmail,
          password: form.adminPassword,
        },
      });
      toast.success("Tenant dan akun admin pertama berhasil dibuat.");
      setForm(initialForm);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal membuat tenant. Silakan coba lagi.";
      setError(message);
    }
  };

  const busy = createTenant.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Tenant</DialogTitle>
          <DialogDescription>
            Lengkapi data lembaga dan akun Admin pertamanya. Akun admin dibuat otomatis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Data Tenant</h3>

            <div className="space-y-1.5">
              <Label htmlFor="name">Nama Tenant</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!form.slug) set("slug", toSlug(e.target.value));
                }}
                placeholder="LPK Aquila Nusantara"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tenantCode">Tenant Code</Label>
                <Input
                  id="tenantCode"
                  required
                  value={form.tenantCode}
                  onChange={(e) => set("tenantCode", toTenantCode(e.target.value))}
                  placeholder="AQUILA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  required
                  value={form.slug}
                  onChange={(e) => set("slug", toSlug(e.target.value))}
                  placeholder="aquila-nusantara"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Pilih timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={form.isActive} onValueChange={(v) => set("isActive", v)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logo">Logo</Label>
              <div className="flex items-center gap-3">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Pratinjau logo tenant"
                    className="size-12 rounded-md border border-border object-cover"
                  />
                ) : null}
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleLogo(e.target.files?.[0])}
                />
              </div>
              {uploading ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Upload className="size-3" /> Mengunggah logo…
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Admin Pertama</h3>

            <div className="space-y-1.5">
              <Label htmlFor="adminFullName">Nama</Label>
              <Input
                id="adminFullName"
                required
                value={form.adminFullName}
                onChange={(e) => set("adminFullName", e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adminDisplayName">Display Name</Label>
                <Input
                  id="adminDisplayName"
                  required
                  value={form.adminDisplayName}
                  onChange={(e) => set("adminDisplayName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminUsername">Username</Label>
                <Input
                  id="adminUsername"
                  required
                  value={form.adminUsername}
                  onChange={(e) => set("adminUsername", e.target.value.toLowerCase())}
                  placeholder="admin.aquila"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminEmail">Email</Label>
              <Input
                id="adminEmail"
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => set("adminEmail", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminPassword">Password Sementara</Label>
              <Input
                id="adminPassword"
                type="text"
                required
                minLength={8}
                value={form.adminPassword}
                onChange={(e) => set("adminPassword", e.target.value)}
                placeholder="Minimal 8 karakter"
              />
            </div>
          </section>

          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {createTenant.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Simpan Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
