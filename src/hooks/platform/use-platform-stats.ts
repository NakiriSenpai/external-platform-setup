import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth";
import { getPlatformStats } from "@/services/platform";

/** Ringkasan platform (khusus Owner). */
export function usePlatformStats() {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
    enabled: role === "owner",
    staleTime: 60_000,
  });
}
