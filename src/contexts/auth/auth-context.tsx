import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import { shouldDropSessionOnBoot } from "@/lib/auth/remember";
import { getCurrentSession, signInWithPassword, signOut, toAuthUser } from "@/services/auth";
import { getProfileById } from "@/services/profile";
import type { AppRole, AuthState, LoginCredentials } from "@/types/auth";
import { ROLE_RANK } from "@/types/auth";
import type { ProfileRow } from "@/types/database";

export type AuthContextValue = AuthState & {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: readonly AppRole[]) => boolean;
  hasMinimumRole: (role: AppRole) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  // Role belum boleh dipakai sebelum profil selesai dimuat (cegah salah redirect).
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const activeRef = useRef(true);
  // Id user yang profilnya sedang/sudah dimuat — mencegah profil lama terpakai.
  const profileUserRef = useRef<string | null>(null);

  // Profil selalu diambil dari tabel `profiles` (source of truth).
  const loadProfile = useCallback(async (nextSession: Session | null) => {
    const userId = nextSession?.user?.id ?? null;
    profileUserRef.current = userId;
    if (!userId) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }
    setIsProfileLoading(true);
    try {
      const row = await getProfileById(userId);
      // Abaikan hasil bila user sudah berganti selama request berjalan.
      if (activeRef.current && profileUserRef.current === userId) setProfile(row);
    } catch {
      if (activeRef.current && profileUserRef.current === userId) setProfile(null);
    } finally {
      if (activeRef.current && profileUserRef.current === userId) setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;

    // Listener didaftarkan lebih dulu, lalu restore session yang tersimpan.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!activeRef.current) return;
      setSession(nextSession);
      setIsSessionLoading(false);
      const nextUserId = nextSession?.user?.id ?? null;
      if (nextUserId !== profileUserRef.current) {
        // User berganti: buang profil lama sebelum profil baru selesai dimuat.
        profileUserRef.current = nextUserId;
        setProfile(null);
        setIsProfileLoading(Boolean(nextUserId));
      }
      if (!nextSession) setIsProfileLoading(false);
      // Panggilan Supabase lain tidak boleh dilakukan langsung di dalam callback.
      setTimeout(() => void loadProfile(nextSession), 0);
    });

    void getCurrentSession().then(async (restored) => {
      if (!activeRef.current) return;
      // "Ingat saya" nonaktif: sesi tidak dilanjutkan setelah browser ditutup.
      if (restored && shouldDropSessionOnBoot()) {
        await signOut().catch(() => undefined);
        if (!activeRef.current) return;
        setSession(null);
        setProfile(null);
        setIsProfileLoading(false);
        setIsSessionLoading(false);
        return;
      }
      setSession(restored);
      await loadProfile(restored);
      if (activeRef.current) setIsSessionLoading(false);
    });

    return () => {
      activeRef.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      // Profil user sebelumnya tidak boleh dipakai untuk menentukan landing.
      profileUserRef.current = null;
      setProfile(null);
      setIsProfileLoading(true);
      const next = await signInWithPassword(credentials);
      setSession(next);
      await loadProfile(next);
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    await signOut();
    profileUserRef.current = null;
    setSession(null);
    setProfile(null);
    setIsProfileLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const value = useMemo<AuthContextValue>(() => {
    const user = toAuthUser(session, profile);
    const role = profile?.role ?? null;
    return {
      user,
      session,
      profile,
      role,
      tenantId: profile?.tenant_id ?? null,
      isAuthenticated: Boolean(session),
      isLoading: isSessionLoading || (Boolean(session) && isProfileLoading),
      login,
      logout,
      refreshProfile,
      hasRole: (target) => role === target,
      hasAnyRole: (roles) => (role ? roles.includes(role) : false),
      hasMinimumRole: (target) => (role ? ROLE_RANK[role] >= ROLE_RANK[target] : false),
    };
  }, [session, profile, isSessionLoading, isProfileLoading, login, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
