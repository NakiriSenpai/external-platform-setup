import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";

import logoUrl from "@/assets/ium-logo.png";
import { useIsStandaloneApp } from "@/lib/utils/app-mode";

/** Banner ringkas ajakan memakai aplikasi Android I:UM (hanya di browser). */
export function DownloadAppBanner() {
  const standalone = useIsStandaloneApp();
  if (standalone) return null;

  return (
    <Link
      to="/download"
      className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3.5 transition-colors hover:border-primary/50"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-muted">
        <img src={logoUrl} alt="" aria-hidden className="size-7 object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          Gunakan I:UM di perangkat Anda
        </span>
        <span className="block text-xs text-muted-foreground">
          Belajar lebih nyaman dengan aplikasi I:UM.
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
        <Download className="size-4" aria-hidden />
        <span className="hidden sm:inline">Download Aplikasi</span>
      </span>
    </Link>
  );
}
