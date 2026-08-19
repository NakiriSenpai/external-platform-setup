import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";

import { MaintenanceGate } from "@/components/common/maintenance-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase/client";
import { signOut, updateUserPassword } from "@/services/auth";
import { PASSWORD_RULES, isPasswordValid } from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/ium-logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — I:UM 이음" },
      {
        name: "description",
        content: "Buat password baru untuk akun I:UM 이음 Anda melalui tautan reset yang aman.",
      },
      { property: "og:title", content: "Reset Password — I:UM 이음" },
      {
        property: "og:description",
        content: "Buat password baru untuk akun I:UM 이음 Anda melalui tautan reset yang aman.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

type Status = "checking" | "ready" | "invalid" | "success";

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          className={cn("min-h-12 rounded-xl px-10", invalid && "border-destructive")}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recoveredRef = useRef(false);

  // Halaman hanya boleh dipakai bila benar-benar berada dalam flow recovery Auth.
  useEffect(() => {
    let active = true;

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("error")) {
      setStatus("invalid");
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        recoveredRef.current = true;
        setStatus("ready");
      }
    });

    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (!active || recoveredRef.current) return;
        setStatus(data.session ? "ready" : "invalid");
      });
    }, 1200);

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const ruleState = PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) }));
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    status === "ready" && isPasswordValid(password) && confirm.length > 0 && !mismatch;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateUserPassword(password);
      // Sesi recovery tidak boleh berlanjut sebagai sesi aplikasi biasa.
      await signOut().catch(() => undefined);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MaintenanceGate>
      <div className="ium-page min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-10">
          <header className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="Logo I:UM 이음"
              width={512}
              height={512}
              className="size-24 object-contain"
            />
          </header>

          <section className="ium-card mt-8 p-6">
            {status === "checking" ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">Memeriksa tautan reset password…</p>
              </div>
            ) : null}

            {status === "invalid" ? (
              <div className="flex flex-col items-center text-center">
                <span className="grid size-12 place-items-center rounded-full bg-destructive/10">
                  <TriangleAlert className="size-5 text-destructive" aria-hidden />
                </span>
                <h1 className="mt-3 text-xl font-bold tracking-tight">
                  Link Reset Password Kedaluwarsa
                </h1>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Link reset password ini sudah tidak berlaku. Silakan minta link reset password
                  baru.
                </p>
                <Button
                  className="ium-cta mt-6 min-h-13 w-full rounded-2xl text-base font-semibold hover:opacity-95"
                  onClick={() => void navigate({ to: "/login" })}
                >
                  Kirim Ulang Link Reset Password
                </Button>
              </div>
            ) : null}

            {status === "success" ? (
              <div className="flex flex-col items-center text-center">
                <span className="grid size-12 place-items-center rounded-full bg-primary-muted">
                  <Check className="size-5 text-primary" aria-hidden />
                </span>
                <h1 className="mt-3 text-xl font-bold tracking-tight">
                  Password berhasil diperbarui.
                </h1>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Password akun I:UM Anda telah berhasil diubah.
                </p>
                <Button
                  asChild
                  className="ium-cta mt-6 min-h-13 w-full rounded-2xl text-base font-semibold hover:opacity-95"
                >
                  <Link to="/login">Kembali ke Login</Link>
                </Button>
              </div>
            ) : null}

            {status === "ready" ? (
              <>
                <div className="flex flex-col items-center text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-primary-muted">
                    <Lock className="size-5 text-primary" aria-hidden />
                  </span>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight">Reset Password</h1>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    Buat password baru untuk akun Anda. Pastikan password mudah Anda ingat namun
                    tetap aman.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                  {error ? (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <PasswordField
                    id="new-password"
                    label="Password Baru"
                    placeholder="Masukkan password baru"
                    value={password}
                    onChange={setPassword}
                    disabled={isSubmitting}
                  />

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Password harus terdiri dari:</p>
                    <ul className="space-y-2">
                      {ruleState.map((rule) => (
                        <li key={rule.id} className="flex items-center gap-2 text-sm">
                          <span
                            className={cn(
                              "grid size-5 place-items-center rounded-full transition-colors",
                              rule.ok
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                            aria-hidden
                          >
                            <Check className="size-3" />
                          </span>
                          <span className={rule.ok ? "text-foreground" : "text-muted-foreground"}>
                            {rule.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <PasswordField
                    id="confirm-password"
                    label="Konfirmasi Password Baru"
                    placeholder="Masukkan ulang password baru"
                    value={confirm}
                    onChange={setConfirm}
                    disabled={isSubmitting}
                    invalid={mismatch}
                  />

                  {mismatch ? (
                    <p role="alert" className="text-sm text-destructive">
                      Password tidak sama.
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    className="ium-cta min-h-13 w-full rounded-2xl text-base font-semibold hover:opacity-95"
                    disabled={!canSubmit || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden /> Memproses…
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </>
            ) : null}
          </section>

          <div className="mt-auto flex items-start gap-3 pt-8">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-muted">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Link reset password ini akan kedaluwarsa dalam{" "}
              <span className="font-semibold text-primary">15 menit</span> untuk keamanan akun Anda.
            </p>
          </div>
        </div>
      </div>
    </MaintenanceGate>
  );
}
