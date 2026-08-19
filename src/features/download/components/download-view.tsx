import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronLeft,
  Chrome,
  Download,
  FileDown,
  Shield,
  Sparkles,
} from "lucide-react";

import logoUrl from "@/assets/ium-logo.png";
import heroUrl from "@/assets/ium-hero.png";
import {
  appRelease,
  apkAvailability,
  formatReleaseDate,
} from "@/lib/config/app-release";
import { cn } from "@/lib/utils";
import { useIsStandaloneApp } from "@/lib/utils/app-mode";

type DownloadState = "idle" | "loading" | "error";

/** Halaman resmi unduh APK I:UM — distribusi langsung, di luar Google Play. */
export function DownloadView() {
  const navigate = useNavigate();
  const canGoBack = useRouterState({ select: (s) => s.location.state.__TSR_index > 0 });
  const [state, setState] = useState<DownloadState>("idle");
  const standalone = useIsStandaloneApp();

  const availability = apkAvailability();
  const available = availability === "APK_AVAILABLE";
  const sizeLabel = appRelease.fileSize ? ` (${appRelease.fileSize})` : "";

  const handleBack = () => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  };

  const handleDownload = () => {
    if (!appRelease.apkUrl) return;
    setState("loading");
    try {
      const anchor = document.createElement("a");
      anchor.href = appRelease.apkUrl;
      anchor.download = appRelease.fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setState("idle");
    } catch {
      try {
        window.location.href = appRelease.apkUrl;
        setState("idle");
      } catch {
        setState("error");
      }
    }
  };

  return (
    <div className="ium-page min-h-screen pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="mx-auto w-full max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:max-w-lg">
        {/* Header */}
        <header className="relative flex min-h-11 items-center justify-center">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Kembali"
            className="absolute left-0 grid size-11 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-surface-elevated"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Download Aplikasi</h1>
        </header>

        {/* Hero */}
        <section className="relative mt-4 overflow-hidden rounded-3xl">
          <img
            src={heroUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="relative flex flex-col items-center px-4 py-6 text-center">
            <img
              src={logoUrl}
              alt="Logo I:UM 이음"
              width={512}
              height={512}
              className="size-24 object-contain"
            />
            <p className="mt-3 text-sm font-semibold">
              Belajar bahasa Korea, hubungkan{" "}
              <span className="text-primary">masa depan.</span>
            </p>
          </div>
        </section>

        {/* Download card */}
        <section className="ium-card mt-4 p-4">
          <div className="flex items-center gap-4">
            <div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-primary-muted">
              <img src={logoUrl} alt="" aria-hidden className="size-16 object-contain" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-muted px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" aria-hidden />
                Update Terbaru
              </span>
              <h2 className="text-2xl font-bold leading-tight">I:UM</h2>
              <p className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                Versi {appRelease.version}
                <span
                  className={cn(
                    "inline-block size-2 rounded-full",
                    available ? "bg-emerald-500" : "bg-muted-foreground/50",
                  )}
                  aria-hidden
                />
              </p>
              <p className="text-xs text-muted-foreground">
                Terakhir diperbarui: {formatReleaseDate(appRelease.releaseDate)}
              </p>
            </div>
          </div>

          {standalone ? (
            <p className="ium-card mt-5 p-4 text-center text-sm font-semibold text-foreground">
              Anda sudah menggunakan aplikasi I:UM.
            </p>
          ) : (
          <button
            type="button"
            onClick={handleDownload}
            disabled={!available || state === "loading"}
            className={cn(
              "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white transition-opacity",
              available ? "ium-cta hover:opacity-95" : "bg-muted-foreground/30",
              (!available || state === "loading") && "cursor-not-allowed opacity-60",
            )}
          >
            <Download className="size-5" aria-hidden />
            {state === "loading"
              ? "Menyiapkan download…"
              : available
                ? `Download APK${sizeLabel}`
                : "APK belum tersedia"}
          </button>
          )}

          {standalone ? null : (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="size-4 text-primary" aria-hidden />
            {state === "error"
              ? "Gagal memulai download. Silakan coba lagi."
              : available
                ? "Download resmi dari situs I:UM"
                : "APK production belum diunggah ke hosting resmi I:UM"}
          </p>
          )}
        </section>

        {/* Installation guide */}
        <section className="ium-card mt-4 p-4">
          <h2 className="text-lg font-bold">Cara Install di Android</h2>

          <ol className="mt-4 space-y-5">
            <Step
              number={1}
              title="Download APK"
              description={'Klik tombol "Download APK" di atas untuk mengunduh file aplikasi.'}
              visual={
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card">
                    <FileDown className="size-5 text-primary" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {appRelease.fileName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {appRelease.fileSize ?? "Ukuran menyusul"}
                    </span>
                  </span>
                </div>
              }
            />
            <Step
              number={2}
              title="Izinkan Instal dari Sumber Tidak Dikenal"
              description="Buka Pengaturan > Keamanan > Instal aplikasi tidak dikenal."
              note="Nama menu dapat berbeda tergantung merek dan versi Android."
              visual={
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Instal aplikasi tidak dikenal</p>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Chrome className="size-4 text-primary" aria-hidden />
                    Chrome
                  </p>
                  <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    Izinkan dari sumber ini
                    <span className="flex h-5 w-9 items-center rounded-full bg-primary p-0.5">
                      <span className="ml-auto block size-4 rounded-full bg-white" />
                    </span>
                  </p>
                </div>
              }
            />
            <Step
              number={3}
              title="Install Aplikasi"
              description={'Buka file APK yang sudah diunduh, lalu ketuk "Instal".'}
              visual={
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <img src={logoUrl} alt="" aria-hidden className="size-4 object-contain" />
                    I:UM
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Apakah Anda ingin menginstal aplikasi ini?
                  </p>
                  <p className="flex justify-end gap-3 text-xs font-medium">
                    <span className="text-muted-foreground">Batal</span>
                    <span className="text-primary">Instal</span>
                  </p>
                </div>
              }
            />
            <Step
              number={4}
              title="Selesai"
              description="Setelah instalasi berhasil, buka aplikasi dan mulai belajar!"
              visual={
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Aplikasi terinstal.</p>
                  <p className="flex justify-end gap-3 text-xs font-medium">
                    <span className="text-muted-foreground">Selesai</span>
                    <span className="text-primary">Buka</span>
                  </p>
                </div>
              }
            />
          </ol>

          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Peringatan Keamanan
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
              Aplikasi ini didistribusikan langsung dari situs resmi I:UM dan tidak melalui Google
              Play Store. Pastikan Anda hanya mengunduh file APK dari sumber resmi I:UM untuk
              menjaga keamanan perangkat Anda.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  note,
  visual,
}: {
  number: number;
  title: string;
  description: string;
  note?: string;
  visual: React.ReactNode;
}) {
  return (
    <li className="grid gap-3 sm:grid-cols-[1fr_minmax(0,15rem)] sm:items-start">
      <div className="flex gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-muted text-sm font-bold text-primary">
          {number}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          {note ? <p className="mt-1 text-[11px] text-muted-foreground/80">{note}</p> : null}
        </div>
      </div>
      <div className="rounded-2xl bg-primary-muted/40 p-3">{visual}</div>
    </li>
  );
}
