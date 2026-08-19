import { useQuery } from "@tanstack/react-query";

import {
  getLeaderboard,
  getLeaderboardPodium,
  getMyLeaderboardRank,
  listLeaderboardExams,
  type LeaderboardParams,
} from "@/services/leaderboard";
import { useAuth } from "@/hooks/auth";

/** List peringkat (di bawah podium). Agregasi first-attempt dilakukan di database. */
export function useLeaderboard(params: LeaderboardParams) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["leaderboard", params],
    queryFn: () => getLeaderboard(params),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Podium #1–#3: ranking global untuk filter aktif, tidak terpengaruh paginasi. */
export function useLeaderboardPodium(examId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["leaderboard-podium", examId],
    queryFn: () => getLeaderboardPodium({ examId }),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Peringkat user yang sedang masuk. */
export function useMyRank(params: LeaderboardParams) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["leaderboard-my-rank", params],
    queryFn: () => getMyLeaderboardRank(params),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

/** Opsi filter exam pada leaderboard. */
export function useLeaderboardExams() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["leaderboard-exams"],
    queryFn: () => listLeaderboardExams(),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}
