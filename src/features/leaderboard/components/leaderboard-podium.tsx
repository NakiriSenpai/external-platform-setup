import { Crown, Medal, Sparkle } from "lucide-react";

import { cn } from "@/lib/utils";
import { ROLE_LABELS, isAppRole } from "@/types/auth";
import type { LeaderboardRow } from "@/types/analytics";

import { RankAvatar } from "./rank-avatar";
import { formatScore } from "../utils";

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const label = isAppRole(role) ? ROLE_LABELS[role] : "Siswa";
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary",
        className,
      )}
    >
      {label}
    </span>
  );
}

const STYLES = {
  1: {
    ring: "ring-2 ring-[#facc15]",
    glow: "shadow-[0_0_30px_rgba(250,204,21,0.45)]",
    text: "text-[#facc15]",
    border: "border-[#facc15]/45",
    bg: "bg-[#facc15]/[0.07]",
    badge: "border-[#facc15] text-[#facc15] bg-background",
    laurel: "text-[#facc15]/70",
  },
  2: {
    ring: "ring-2 ring-[#cbd5e1]",
    glow: "shadow-[0_0_22px_rgba(203,213,225,0.30)]",
    text: "text-[#cbd5e1]",
    border: "border-[#cbd5e1]/30",
    bg: "bg-[#cbd5e1]/[0.05]",
    badge: "border-[#cbd5e1] text-[#cbd5e1] bg-background",
    laurel: "text-[#cbd5e1]/60",
  },
  3: {
    ring: "ring-2 ring-[#f97316]",
    glow: "shadow-[0_0_22px_rgba(249,115,22,0.32)]",
    text: "text-[#f97316]",
    border: "border-[#f97316]/35",
    bg: "bg-[#f97316]/[0.06]",
    badge: "border-[#f97316] text-[#f97316] bg-background",
    laurel: "text-[#f97316]/60",
  },
} as const;

type Place = 1 | 2 | 3;

function PodiumSlot({ row, place }: { row: LeaderboardRow | undefined; place: Place }) {
  const s = STYLES[place];
  const first = place === 1;
  const order = place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3";
  /** Elevation podium: #1 tertinggi, #2 menengah, #3 terendah. */
  const lift = first ? "pt-0" : place === 2 ? "pt-8 sm:pt-10" : "pt-14 sm:pt-16";
  const cardMinH = first
    ? "min-h-[10.5rem] sm:min-h-[11rem]"
    : place === 2
      ? "min-h-[9.5rem] sm:min-h-[10rem]"
      : "min-h-[8.5rem] sm:min-h-[9rem]";

  return (
    <div className={cn("flex min-w-0 flex-col items-center self-end", order, lift)}>

      {/* Rank badge */}
      <div
        className={cn(
          "mb-1 grid shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums",
          s.badge,
          first ? "size-8" : "size-7",
        )}
      >
        {place}
      </div>

      {/* Avatar + laurels */}
      <div className="relative shrink-0">
        {row ? (
          <RankAvatar
            row={row}
            className={cn(
              first ? "size-[4.5rem] sm:size-24" : "size-14 sm:size-[4.5rem]",
              s.ring,
              s.glow,
            )}
          />
        ) : (
          <div
            className={cn(
              "grid place-items-center rounded-full border border-dashed border-border text-xs text-muted-foreground",
              first ? "size-[4.5rem] sm:size-24" : "size-14 sm:size-[4.5rem]",
            )}
          >
            —
          </div>
        )}

        {row ? (
          <>
            <Medal
              className={cn(
                "pointer-events-none absolute -left-2 bottom-1 size-4 -scale-x-100 sm:size-5",
                s.laurel,
              )}
              aria-hidden
            />
            <Medal
              className={cn(
                "pointer-events-none absolute -right-2 bottom-1 size-4 sm:size-5",
                s.laurel,
              )}
              aria-hidden
            />
          </>
        ) : null}

        {first && row ? (
          <>
            <Crown className="pointer-events-none absolute -top-5 left-1/2 size-6 -translate-x-1/2 text-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
            <Sparkle className="pointer-events-none absolute -left-3 -top-1 size-3 text-[#facc15]/80" />
            <Sparkle className="pointer-events-none absolute -right-3 top-2 size-2.5 text-[#facc15]/70" />
          </>
        ) : null}

        {first && row ? (
          <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border border-[#facc15] bg-background sm:size-7">
            <Crown className="size-3 text-[#facc15] sm:size-3.5" />
          </span>
        ) : null}
      </div>

      {/* Card */}
      <div
        className={cn(
          "mt-3 flex w-full min-w-0 flex-col justify-between rounded-xl border p-2 text-center sm:p-2.5",
          cardMinH,
          row ? s.border : "border-dashed border-border",
          row ? s.bg : "bg-transparent",
          first ? "-mt-1 pt-4" : "",
          row?.is_current_user ? "ring-1 ring-primary" : "",
        )}
      >
        {row ? (
          <>
            <div className="min-w-0">
              <p
                className="line-clamp-2 min-h-[2.1em] break-words text-xs font-semibold leading-tight text-foreground sm:text-sm"
                title={row.display_name}
              >
                {row.display_name}
              </p>
              <div className="mt-1">
                <RoleBadge role={row.role} />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1 divide-x divide-border border-t border-border/70 pt-2">
              <div className="min-w-0 px-0.5">
                <p className="text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                  Ujian
                </p>
                <p
                  className={cn(
                    "text-[11px] font-bold leading-tight tabular-nums [font-variant-numeric:tabular-nums] sm:text-sm",
                    s.text,
                  )}
                  title={formatScore(row.attempt_count)}
                >
                  {formatScore(row.attempt_count)}
                </p>
              </div>
              <div className="min-w-0 px-0.5">
                <p className="text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                  Skor
                </p>
                <p
                  className={cn(
                    "text-[11px] font-bold leading-tight tabular-nums [font-variant-numeric:tabular-nums] sm:text-sm",
                    s.text,
                  )}
                  title={formatScore(row.first_attempt_score)}
                >
                  {formatScore(row.first_attempt_score)}
                </p>
              </div>
            </div>

          </>
        ) : (
          <p className="my-auto text-xs text-muted-foreground">Belum ada</p>
        )}
      </div>
    </div>
  );
}

/** Podium #1–#3 (ranking global filter aktif; tidak berubah saat paginasi). */
export function LeaderboardPodium({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] items-end gap-1.5 rounded-2xl border border-border bg-card px-2 pb-3 pt-8 sm:gap-3 sm:px-4">
      <PodiumSlot row={rows[1]} place={2} />
      <PodiumSlot row={rows[0]} place={1} />
      <PodiumSlot row={rows[2]} place={3} />
    </div>
  );
}
