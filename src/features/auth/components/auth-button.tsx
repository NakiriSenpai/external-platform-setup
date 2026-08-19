import { LogIn, LogOut } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth";

export function AuthButton() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) return null;

  if (!isAuthenticated) {
    if (pathname === "/login") return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="min-h-10"
        onClick={() => void navigate({ to: "/login" })}
      >
        <LogIn className="size-4" aria-hidden /> Masuk
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="min-h-10"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await logout();
          await navigate({ to: "/login", replace: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      <LogOut className="size-4" aria-hidden /> Keluar
    </Button>
  );
}
