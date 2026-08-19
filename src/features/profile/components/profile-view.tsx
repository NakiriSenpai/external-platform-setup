import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlus,
  Camera,
  ChevronRight,
  Crown,
  Download,
  LogOut,
  Lock,
  Mail,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth";
import { useTheme } from "@/hooks/use-theme";
import { getAvatarCooldown } from "@/lib/profile/avatar.functions";
import { ROLE_LABELS, type AppRole } from "@/types/auth";
import type { Theme } from "@/types/common";
import { cn } from "@/lib/utils";
import { useIsStandaloneApp } from "@/lib/utils/app-mode";
import { AvatarDialog } from "./avatar-dialog";
import { ChangePasswordDialog } from "./change-password-dialog";
import { ChangeNameDialog } from "./change-name-dialog";

const ROLE_DESCRIPTION: Record<AppRole, string> = {
  owner: "Pemilik akun dan pengelola utama platform.",
  admin: "Mengelola pengguna dan konten di lembaga Anda.",
  guru: "Mengajar, menyusun materi, dan memantau siswa.",
  siswa: "Mengikuti materi dan ujian yang tersedia.",
};

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Smartphone },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border-subtle px-4 py-3.5">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      <div className="divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

export function ProfileView() {
  const { user, profile, role, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const standalone = useIsStandaloneApp();
  const navigate = useNavigate();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);

  const cooldownQuery = useQuery({
    queryKey: ["avatar-cooldown", user?.id],
    queryFn: () => getAvatarCooldown(),
    enabled: Boolean(user?.id),
    retry: false,
    staleTime: 60_000,
  });

  const displayName = profile?.display_name ?? profile?.full_name ?? "Pengguna";
  const avatarUrl = profile?.avatar_url ?? null;

  const handleLogout = async () => {
    try {
      await logout();
      await navigate({ to: "/login" });
    } catch {
      toast.error("Gagal keluar. Silakan coba lagi.");
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Profil Saya</h1>
        <p className="text-sm text-muted-foreground">Kelola informasi akun dan preferensi Anda</p>
      </header>

      {/* Kartu identitas */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-primary bg-background-elevated glow-primary">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`Foto profil ${displayName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAvatarOpen(true)}
              aria-label="Ganti foto profil"
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 space-y-2">
            <h2 className="truncate text-xl font-bold">{displayName}</h2>
            {role ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-muted px-3 py-1.5 text-sm font-semibold text-primary">
                {ROLE_LABELS[role]}
                <Crown className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {role ? ROLE_DESCRIPTION[role] : "Akun pengguna platform."}
            </p>
          </div>
        </div>
      </section>

      {/* Informasi akun */}
      <SectionCard icon={UserIcon} title="Informasi Akun">
        <button
          type="button"
          onClick={() => setNameOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated"
        >
          <UserIcon className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Nama</span>
          <span className="ml-auto truncate text-sm text-muted-foreground">{displayName}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Email</span>
          <span className="ml-auto truncate text-sm text-muted-foreground">
            {profile?.email ?? user?.email ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <CalendarPlus className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Bergabung sejak</span>
          <span className="ml-auto text-sm text-muted-foreground">
            {formatDate(profile?.created_at)}
          </span>
        </div>
      </SectionCard>

      {/* Keamanan */}
      <SectionCard icon={Shield} title="Keamanan">
        <button
          type="button"
          onClick={() => setPasswordOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated"
        >
          <Lock className="h-5 w-5 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">Ganti Password</span>
            <span className="block text-xs text-muted-foreground">
              Perbarui password akun Anda secara berkala.
            </span>
          </span>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </SectionCard>

      {/* Tampilan */}
      <SectionCard icon={Palette} title="Tampilan">
        <div className="space-y-4 px-4 py-4">
          <div className="flex items-start gap-3">
            <Moon className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Tema Aplikasi</p>
              <p className="text-xs text-muted-foreground">
                Pilih tampilan aplikasi yang nyaman untuk Anda
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border px-2 py-4 transition-colors",
                    active
                      ? "border-primary bg-primary-muted text-foreground"
                      : "border-border bg-background-elevated text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-primary" : "")} />
                  <span className="text-xs font-medium">{option.label}</span>
                  {active ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            {theme === "system"
              ? "Aplikasi akan mengikuti pengaturan tema di perangkat Anda."
              : "Tema tersimpan dan tetap dipakai setelah muat ulang maupun keluar akun."}
          </p>
        </div>
      </SectionCard>

      {/* Aplikasi */}
      {standalone ? null : (
        <SectionCard icon={Smartphone} title="Aplikasi">
          <Link
            to="/download"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated"
          >
            <Download className="h-5 w-5 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Download Aplikasi</span>
              <span className="block text-xs text-muted-foreground">
                Dapatkan aplikasi I:UM untuk Android
              </span>
            </span>
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </SectionCard>
      )}



      <Button
        type="button"
        variant="outline"
        onClick={() => void handleLogout()}
        className="h-14 w-full rounded-2xl border-destructive/40 text-base font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="mr-2 h-5 w-5" />
        Keluar dari akun
      </Button>

      <AvatarDialog
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        currentAvatarUrl={avatarUrl}
        cooldown={cooldownQuery.data ?? null}
        onSaved={() => void cooldownQuery.refetch()}
      />
      <ChangeNameDialog
        open={nameOpen}
        onOpenChange={setNameOpen}
        currentName={profile?.display_name ?? profile?.full_name ?? ""}
      />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
