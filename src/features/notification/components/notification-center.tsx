import { useMemo, useState } from "react";
import {
  BellRing,
  BookOpen,
  CheckCheck,
  Download,
  Megaphone,
  ClipboardList,
  Send,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationComposer } from "@/features/notification/components/notification-composer";
import { useAuth } from "@/hooks/auth";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/notification";
import {
  enablePushNotifications,
  isPushSupported,
  pushPermission,
  vapidPublicKey,
} from "@/lib/push/push-client";
import { cn } from "@/lib/utils";
import type { NotificationItem, NotificationType } from "@/types/notification";
import { NOTIFICATION_TYPE_LABELS } from "@/types/notification";

const TYPE_ICON: Record<NotificationType, typeof BellRing> = {
  material: BookOpen,
  exam: ClipboardList,
  announcement: Megaphone,
  maintenance: Wrench,
  system: BellRing,
  update: Download,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minute = 60_000;
  if (diff < minute) return "baru saja";
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} menit lalu`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} jam lalu`;
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function NotificationRowItem({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: (item: NotificationItem) => void;
}) {
  const Icon = TYPE_ICON[item.type] ?? BellRing;
  const unread = !item.readAt;

  return (
    <li>
      <button
        type="button"
        onClick={() => onRead(item)}
        className={cn(
          "flex w-full gap-3 rounded-xl border p-3 text-left transition-colors",
          unread
            ? "border-primary/35 bg-primary/[0.07] hover:bg-primary/10"
            : "border-border bg-card hover:bg-muted/40",
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full border",
            unread
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
            {unread ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
          </span>
          <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
            {item.message}
          </span>
          <span className="mt-1 block text-[11px] text-muted-foreground/80">
            {NOTIFICATION_TYPE_LABELS[item.type]} · {relativeTime(item.created_at)}
          </span>
        </span>
      </button>
    </li>
  );
}

export function NotificationCenter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useNotifications();
  const { role } = useAuth();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [pushDismissed, setPushDismissed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const items = useMemo(() => data ?? [], [data]);
  const unread = items.filter((item) => !item.readAt);
  const isStaff = role === "owner" || role === "admin" || role === "guru";

  const showPushPrompt =
    !pushDismissed &&
    Boolean(vapidPublicKey) &&
    isPushSupported() &&
    pushPermission() === "default";

  const handleOpenItem = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    if (item.action_url) {
      onOpenChange(false);
      if (item.action_url.startsWith("http")) window.open(item.action_url, "_blank", "noopener");
      else window.location.assign(item.action_url);
    }
  };

  const handleEnablePush = async () => {
    const result = await enablePushNotifications();
    if (result === "granted") toast.success("Notifikasi perangkat diaktifkan.");
    else if (result === "denied") toast.info("Notifikasi perangkat tidak diaktifkan.");
    else toast.info("Perangkat ini belum mendukung notifikasi push.");
    setPushDismissed(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SheetTitle className="text-base">Notifikasi</SheetTitle>
              <SheetDescription className="text-xs">
                {unread.length > 0 ? `${unread.length} belum dibaca` : "Semua sudah dibaca"}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1">
              {isStaff ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setComposerOpen(true)}
                >
                  <Send className="size-4" /> Kirim
                </Button>
              ) : null}
              {unread.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => markAll.mutate(unread.map((item) => item.id))}
                  disabled={markAll.isPending}
                >
                  <CheckCheck className="size-4" /> Tandai semua
                </Button>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        {isStaff ? (
          <NotificationComposer open={composerOpen} onOpenChange={setComposerOpen} />
        ) : null}

        <ScrollArea className="flex-1">
          <div className="space-y-3 p-4">
            {showPushPrompt ? (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.07] p-3">
                <p className="text-sm font-semibold">Aktifkan Notifikasi?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Terima pemberitahuan tentang materi baru, ujian, pengumuman, dan informasi
                  penting.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => void handleEnablePush()}>
                    Aktifkan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPushDismissed(true)}>
                    Nanti
                  </Button>
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <BellRing className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Belum ada notifikasi</p>
                <p className="text-xs text-muted-foreground">
                  Pemberitahuan materi, ujian, dan pengumuman akan muncul di sini.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <NotificationRowItem key={item.id} item={item} onRead={handleOpenItem} />
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
