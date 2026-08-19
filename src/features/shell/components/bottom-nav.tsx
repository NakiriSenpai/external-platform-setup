import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, ClipboardList, Home, Trophy, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/auth";

export type BottomNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  flag?: string;
};

/** Bottom nav hanya berisi fitur aplikasi (learning), bukan menu management. */
const STAFF_NAV: BottomNavItem[] = [
  { to: "/teacher", label: "Beranda", icon: Home },
  { to: "/materi", label: "Belajar", icon: BookOpen, flag: "lesson" },
  { to: "/ujian", label: "Ujian", icon: ClipboardList, flag: "exam_engine" },
  { to: "/leaderboard", label: "Peringkat", icon: Trophy, flag: "leaderboard" },
  { to: "/profile", label: "Profil", icon: User },
];

export const NAV_BY_ROLE: Record<AppRole, BottomNavItem[]> = {
  owner: [{ ...STAFF_NAV[0]!, to: "/owner" }, ...STAFF_NAV.slice(1)],
  admin: [{ ...STAFF_NAV[0]!, to: "/admin" }, ...STAFF_NAV.slice(1)],
  guru: STAFF_NAV,
  siswa: [
    { to: "/dashboard", label: "Beranda", icon: Home },
    { to: "/materi", label: "Belajar", icon: BookOpen, flag: "lesson" },
    { to: "/ujian", label: "Ujian", icon: ClipboardList, flag: "exam_engine" },
    { to: "/leaderboard", label: "Peringkat", icon: Trophy, flag: "leaderboard" },
    { to: "/profile", label: "Profil", icon: User },
  ],
};

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 w-full bg-background"
    >
      <div className="px-2 pt-2">
        <div className="mx-auto w-full max-w-5xl rounded-3xl border border-primary/25 bg-card/90 p-1.5 shadow-[0_-4px_40px_-16px_color-mix(in_oklab,var(--primary)_80%,transparent)] backdrop-blur">
          <ul className="flex items-stretch justify-between gap-1">
            {items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <li key={item.to} className="min-w-0 flex-1">
                  <Link
                    to={item.to}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 transition-colors",
                      active
                        ? "bg-primary/15 text-primary shadow-[0_0_22px_-8px_color-mix(in_oklab,var(--primary)_90%,transparent)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn("size-5", active && "drop-shadow-[0_0_6px_var(--primary)]")}
                    />
                    <span className="w-full truncate text-center text-[11px] font-medium leading-none">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="h-[env(safe-area-inset-bottom)] bg-background" />
    </nav>
  );
}
