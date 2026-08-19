import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, BookOpen, ClipboardCheck, Trophy } from "lucide-react";

import { MaintenanceGate } from "@/components/common/maintenance-gate";
import logoUrl from "@/assets/ium-logo.png";
import heroUrl from "@/assets/ium-hero.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "I:UM 이음 — Belajar Bahasa Korea, Hubungkan Masa Depan" },
      {
        name: "description",
        content:
          "I:UM 이음 membantu Anda meningkatkan kemampuan bahasa Korea lewat materi lengkap, latihan interaktif, pantau progress, dan peringkat pencapaian.",
      },
      { property: "og:title", content: "I:UM 이음 — Belajar Bahasa Korea" },
      {
        property: "og:description",
        content: "Tingkatkan kemampuan bahasa Korea Anda bersama I:UM dan raih peluang lebih luas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

const FEATURES = [
  { icon: BookOpen, line1: "Materi", line2: "Lengkap" },
  { icon: ClipboardCheck, line1: "Latihan", line2: "Interaktif" },
  { icon: BarChart3, line1: "Pantau", line2: "Progress" },
  { icon: Trophy, line1: "Peringkat &", line2: "Pencapaian" },
] as const;

function Welcome() {
  return (
    <MaintenanceGate>
      <div className="ium-page min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-8 pt-10">
          <header className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="Logo I:UM 이음"
              width={512}
              height={512}
              className="size-28 object-contain"
            />
            <h1 className="mt-4 text-[26px] font-bold leading-snug tracking-tight sm:text-3xl">
              Belajar bahasa Korea,
              <br />
              hubungkan{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                masa depan
              </span>
              .
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Tingkatkan kemampuan bahasa Korea Anda bersama I:UM dan raih peluang yang lebih luas.
            </p>
          </header>

          <div className="mt-6 flex justify-center">
            <img
              src={heroUrl}
              alt="Ilustrasi belajar bahasa Korea: buku, dokumen, headphone, dan grafik progres"
              width={1024}
              height={768}
              className="h-auto w-full max-w-sm object-contain"
            />
          </div>

          <section className="ium-card mt-8 grid grid-cols-4 divide-x divide-border-subtle p-4">
            {FEATURES.map(({ icon: Icon, line1, line2 }) => (
              <div key={line1} className="flex min-w-0 flex-col items-center gap-2 px-1 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-primary-muted">
                  <Icon className="size-5 text-primary" aria-hidden />
                </span>
                <span className="text-[11px] font-medium leading-tight text-foreground/80 sm:text-xs">
                  {line1}
                  <br />
                  {line2}
                </span>
              </div>
            ))}
          </section>

          <div className="mt-auto pt-8">
            <Link
              to="/login"
              className="ium-cta flex min-h-14 w-full items-center justify-center rounded-2xl text-base font-semibold transition-opacity hover:opacity-95"
            >
              Mulai
            </Link>
          </div>
        </div>
      </div>
    </MaintenanceGate>
  );
}
