import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createNotification } from "@/lib/push/push.functions";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from "@/types/notification";
import type { NotificationType } from "@/types/notification";

const ROLE_OPTIONS = [
  { value: "all", label: "Semua pengguna" },
  { value: "siswa", label: "Siswa" },
  { value: "guru", label: "Guru" },
  { value: "admin", label: "Admin" },
] as const;

/**
 * Composer notifikasi untuk staff (owner/admin/guru).
 * Satu record notifikasi = in-app + push (push gagal tidak membatalkan in-app).
 * Tenant ditentukan server-side dari profil pemanggil.
 */
export function NotificationComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const send = useServerFn(createNotification);
  const queryClient = useQueryClient();

  const [type, setType] = useState<NotificationType>("announcement");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("all");

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          type,
          title: title.trim(),
          message: message.trim(),
          actionUrl: actionUrl.trim() ? actionUrl.trim() : null,
          targetRole: role === "all" ? null : role,
        },
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const push = result.push;
      toast.success(
        push.sent > 0
          ? `Notifikasi dikirim. Push terkirim ke ${push.sent} perangkat.`
          : "Notifikasi dibuat. Belum ada perangkat aktif yang menerima push.",
      );
      setTitle("");
      setMessage("");
      setActionUrl("");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Gagal mengirim notifikasi."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim Notifikasi</DialogTitle>
          <DialogDescription>
            Notifikasi tersimpan di Notification Center dan dikirim sebagai push ke perangkat
            penerima yang aktif.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="notif-type">Jenis</Label>
              <Select value={type} onValueChange={(value) => setType(value as NotificationType)}>
                <SelectTrigger id="notif-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {NOTIFICATION_TYPE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notif-role">Penerima</Label>
              <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                <SelectTrigger id="notif-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-title">Judul</Label>
            <Input
              id="notif-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Contoh: Materi baru tersedia"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-message">Pesan</Label>
            <Textarea
              id="notif-message"
              value={message}
              maxLength={500}
              rows={3}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Isi pemberitahuan"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-url">Action URL (opsional)</Label>
            <Input
              id="notif-url"
              value={actionUrl}
              maxLength={500}
              onChange={(event) => setActionUrl(event.target.value)}
              placeholder="/materi"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || title.trim().length < 3 || message.trim().length < 3}
            className="gap-1"
          >
            <Send className="size-4" /> Kirim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
