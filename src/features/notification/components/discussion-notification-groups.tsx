import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Loader2, MessagesSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth";
import {
  useDeleteDiscussionGroup,
  useDiscussionEvents,
  useMarkDiscussionGroupRead,
} from "@/hooks/discussion/use-discussion";
import { cn } from "@/lib/utils";
import type { DiscussionNotificationGroup } from "@/types/discussion";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minute = 60_000;
  if (diff < minute) return "baru saja";
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} menit lalu`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

/** Kelompok notifikasi diskusi per Exam (satu baris per Exam, child list saat dibuka). */
export function DiscussionNotificationGroups({
  groups,
  onNavigate,
}: {
  groups: readonly DiscussionNotificationGroup[];
  onNavigate: () => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Diskusi Ujian
      </p>
      <ul className="space-y-2">
        {groups.map((group) => (
          <GroupRow key={group.group_id} group={group} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

function GroupRow({
  group,
  onNavigate,
}: {
  group: DiscussionNotificationGroup;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role } = useAuth();
  const events = useDiscussionEvents(open ? group.group_id : null);
  const markRead = useMarkDiscussionGroupRead();
  const remove = useDeleteDiscussionGroup();
  const unread = group.unread_count > 0;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread && !markRead.isPending) markRead.mutate(group.group_id);
  };

  const openThread = (questionId: string) => {
    onNavigate();
    void navigate({
      to: "/ujian/diskusi/$examId",
      params: { examId: group.exam_id },
      search: { q: questionId, ...(role === "owner" ? { t: group.tenant_id } : {}) },
    });
  };

  const handleDelete = () => {
    if (remove.isPending) return;
    if (!window.confirm(`Hapus notifikasi diskusi "${group.exam_title}" untuk semua pengguna?`)) {
      return;
    }
    remove.mutate(group.group_id, {
      onSuccess: () => toast.success("Notifikasi diskusi dihapus untuk semua pengguna."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus."),
    });
  };

  return (
    <li
      className={cn(
        "rounded-xl border",
        unread ? "border-primary/35 bg-primary/[0.07]" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={toggle} className="flex min-w-0 flex-1 gap-3 text-left">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/15 text-primary">
            <MessagesSquare className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {group.exam_title}
              </span>
              {unread ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
            </span>
            <span className="block text-xs text-muted-foreground">
              {unread
                ? `${group.unread_count} aktivitas baru`
                : `${group.activity_count} aktivitas`}{" "}
              · {relativeTime(group.last_activity_at)}
            </span>
          </span>
          {open ? (
            <ChevronDown className="size-4 shrink-0 self-center text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
          )}
        </button>
        {role === "owner" ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label="Hapus kelompok notifikasi untuk semua pengguna"
            disabled={remove.isPending}
            onClick={handleDelete}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4 text-destructive" />
            )}
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="border-t border-border px-3 py-2">
          {events.isLoading ? (
            <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Memuat aktivitas…
            </p>
          ) : events.isError ? (
            <p className="py-2 text-xs text-muted-foreground">Gagal memuat aktivitas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(events.data ?? []).map((ev) => (
                <li key={ev.event_id}>
                  <button
                    type="button"
                    onClick={() => openThread(ev.question_id)}
                    className="flex w-full items-start gap-2 py-2 text-left text-xs hover:bg-muted/30"
                  >
                    {ev.is_unread ? (
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                    ) : (
                      <span className="mt-1 size-1.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground">
                        <strong>Soal {ev.question_number ?? "?"}</strong> — {ev.actor_name}{" "}
                        {ev.kind === "reply"
                          ? `membalas komentar${ev.parent_author_name ? ` ${ev.parent_author_name}` : ""}.`
                          : "menambahkan komentar."}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {relativeTime(ev.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}
