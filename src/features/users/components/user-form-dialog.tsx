import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { useCreateUser, useUpdateUser } from "@/hooks/users";
import { useTenants } from "@/hooks/tenant";
import { uploadToCloudinary } from "@/services/cloudinary.service";
import { ROLE_LABELS, type AppRole } from "@/types/auth";
import type { ProfileRow } from "@/types/database";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wewenang pemanggil menentukan pilihan role & tenant. */
  scope: "owner" | "admin";
  /** Tenant tetap untuk Admin. */
  fixedTenantId?: string | null;
  /** Bila diisi, dialog berjalan dalam mode ubah. */
  user?: ProfileRow | null;
};

const emptyForm = {
  fullName: "",
  displayName: "",
  username: "",
  email: "",
  password: "",
  role: "siswa" as AppRole,
  isActive: "aktif",
  avatarUrl: "",
  tenantId: "",
};

export function UserFormDialog({ open, onOpenChange, scope, fixedTenantId, user }: Props) {
  const isEdit = Boolean(user);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const tenantsQuery = useTenants({ page: 1, pageSize: 100, status: "semua" });

  // Owner tidak boleh membuat/menetapkan role owner baru (server juga menolak).
  // Akun Owner yang sudah ada tetap ditampilkan apa adanya saat mode ubah.
  const roleOptions = useMemo<AppRole[]>(() => {
    const base: AppRole[] = scope === "owner" ? ["admin", "guru", "siswa"] : ["guru", "siswa"];
    return user?.role === "owner" ? ["owner", ...base] : base;
  }, [scope, user?.role]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (user) {
      setForm({
        fullName: user.full_name ?? "",
        displayName: user.display_name ?? "",
        username: user.username ?? "",
        email: user.email ?? "",
        password: "",
        role: user.role,
        isActive: user.is_active ? "aktif" : "nonaktif",
        avatarUrl: user.avatar_url ?? "",
        tenantId: user.tenant_id ?? "",
      });
    } else {
      setForm({ ...emptyForm, tenantId: fixedTenantId ?? "" });
    }
  }, [open, user, fixedTenantId]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, {
        folder: "lpk/avatars",
        resourceType: "image",
      });
      set("avatarUrl", result.secureUrl);
      toast.success("Avatar berhasil diunggah.");
    } catch {
      toast.error("Gagal mengunggah avatar ke Cloudinary.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && user) {
        await updateUser.mutateAsync({
          userId: user.id,
          fullName: form.fullName,
          displayName: form.displayName || form.fullName,
          username: form.username.toLowerCase(),
          isActive: form.isActive === "aktif",
          avatarUrl: form.avatarUrl ? form.avatarUrl : null,
          ...(scope === "owner"
            ? {
                role: form.role,
                tenantId: fixedTenantId ?? (form.tenantId ? form.tenantId : null),
              }
            : {}),
        });
        toast.success("Data user berhasil diperbarui.");
      } else {
        await createUser.mutateAsync({
          fullName: form.fullName,
          displayName: form.displayName || form.fullName,
          username: form.username.toLowerCase(),
          email: form.email,
          password: form.password,
          role: form.role,
          isActive: form.isActive === "aktif",
          avatarUrl: form.avatarUrl ? form.avatarUrl : null,
          tenantId: fixedTenantId ?? (form.tenantId ? form.tenantId : null),

        });
        toast.success("User berhasil dibuat.");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan user. Silakan coba lagi.");
    }
  };

  const busy = createUser.isPending || updateUser.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah User" : "Tambah User"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui data pengguna. Email tidak dapat diubah."
              : "Akun masuk dan profil dibuat sekaligus."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nama</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              required
              minLength={3}
              className="min-h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => set("username", e.target.value.toLowerCase())}
                required
                minLength={3}
                className="min-h-11"
              />
            </div>
          </div>

          {!isEdit ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password Sementara</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  required
                  minLength={8}
                  className="min-h-11"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => set("role", v)}
                disabled={isEdit && scope !== "owner"}
              >
                <SelectTrigger id="role" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.isActive} onValueChange={(v) => set("isActive", v)}>
                <SelectTrigger id="status" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="nonaktif">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {scope === "owner" && !fixedTenantId && form.role !== "owner" ? (
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Select value={form.tenantId} onValueChange={(v) => set("tenantId", v)}>
                <SelectTrigger id="tenant" className="min-h-11">
                  <SelectValue placeholder="Pilih tenant" />
                </SelectTrigger>
                <SelectContent>
                  {(tenantsQuery.data?.rows ?? []).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}


          <div className="space-y-2">
            <Label htmlFor="avatar">Avatar</Label>
            <div className="flex items-center gap-3">
              {form.avatarUrl ? (
                <img
                  src={form.avatarUrl}
                  alt="Pratinjau avatar"
                  className="size-11 rounded-full border border-border object-cover"
                />
              ) : null}
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                className="min-h-11"
                onChange={(e) => void handleAvatar(e.target.files?.[0])}
              />
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Batal
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
