import { useQuery } from "@tanstack/react-query";

import { getProfileById } from "@/services/profile";
import { useAuth } from "@/hooks/auth";

/** Profil dari tabel `profiles` untuk user tertentu. */
export function useProfile(userId?: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfileById(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

/** Profil user yang sedang masuk (sudah tersedia di AuthContext). */
export function useCurrentProfile() {
  const { profile, isLoading } = useAuth();
  return { profile, isLoading };
}
