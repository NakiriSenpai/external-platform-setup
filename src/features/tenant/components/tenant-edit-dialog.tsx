import { useEffect, useState, type FormEvent } from "react";
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
import { useUpdateTenant } from "@/hooks/owner";
import { uploadToCloudinary } from "@/services/cloudinary.service";
import type { TenantRow } from "@/types/database";

type Props = {
  tenant: TenantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Edit branding tenant: nama, slogan, icon (Cloudinary eksternal), dan status. */
export function TenantEditDialog({ tenant, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [status, setStatus] = useState("aktif");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateTenant = useUpdateTenant();

  useEffect(() => {
    if (!tenant || !open) return;
    setName(tenant.name);
    setTagline(tenant.tagline ?? "");
    setLogoUrl(tenant.logo_url ?? "");
    setStatus(tenant.is_active ? "aktif" : "nonaktif");
    setError(null);
  }, [tenant, open]);

  const handleIcon = async (file: File | undefined) => {
    if (!file || !tenant) return;
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, {
        // Asset tenant terpisah dari asset user.
        folder: `tenant/${tenant.id}/branding`,
        resourceType: "image",
      });
      setLogoUrl(result.secureUrl);
      toast.success("Icon tenant berhasil diunggah.");
    } catch {
      toast.error("Gagal mengunggah icon ke Cloudinary.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tenant) return;
    setError(null);
    try {
      await updateTenant.mutateAsync({
        tenantId: tenant.id,
        name: name.trim(),
        tagline: tagline.trim() ? tagline.trim() : null,
        logoUrl: logoUrl.trim() ? logoUrl.trim() : null,
        isActive: status === "aktif",
      });
      toast.success("Perubahan tenant tersimpan.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tenant.");
    }
  };

  const busy = updateTenant.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
          <DialogDescription>
            Branding ini dipakai pada header aplikasi untuk seluruh pengguna tenant tersebut.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-name">Nama Tenant</Label>
            <Input
              id="tenant-name"
              required
              minLength={3}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tenant-tagline">Slogan</Label>
            <Input
              id="tenant-tagline"
              maxLength={160}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Belajar bahasa Korea. Terhubung bersama."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon Tenant</Label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Pratinjau icon tenant"
                  className="size-14 rounded-xl border border-border object-cover"
                />
              ) : (
                <div className="grid size-14 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                  —
                </div>
              )}
              <div>
                <input
                  id="tenant-icon"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleIcon(e.target.files?.[0])}
                />
                <Button asChild variant="outline" size="sm" disabled={busy}>
                  <label htmlFor="tenant-icon" className="cursor-pointer">
                    {uploading ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-1 size-4" />
                    )}
                    Ganti Icon
                  </label>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tenant-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="tenant-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="nonaktif">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {updateTenant.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
