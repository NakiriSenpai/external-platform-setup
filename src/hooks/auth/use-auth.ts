import { useContext } from "react";

import { AuthContext, type AuthContextValue } from "@/contexts/auth/auth-context";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  return context;
}
