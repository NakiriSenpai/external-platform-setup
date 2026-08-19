import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth";
import {
  fetchAnalyticsOverview,
  fetchAnalyticsTrend,
  fetchAttendance,
  fetchExamPerformance,
  fetchQuestionStats,
  fetchScoreMatrix,
  fetchStudentAttempts,
  fetchStudentRows,
  setStudentAnalyticsExcluded,
  type StudentRowsParams,
} from "@/services/analytics/analytics-v2.service";
import type { AnalyticsFilterState } from "@/types/analytics/analytics-v2";

const STALE = 60_000;

function useStaffEnabled() {
  const { isAuthenticated, profile } = useAuth();
  return isAuthenticated && Boolean(profile) && profile?.role !== "siswa";
}

export function useOverviewV2(filters: AnalyticsFilterState) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-overview", filters],
    queryFn: () => fetchAnalyticsOverview(filters),
    enabled,
    staleTime: STALE,
  });
}

export function useTrendV2(filters: AnalyticsFilterState) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-trend", filters],
    queryFn: () => fetchAnalyticsTrend(filters),
    enabled,
    staleTime: STALE,
  });
}

export function useExamPerformance(filters: AnalyticsFilterState) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-exams", filters],
    queryFn: () => fetchExamPerformance(filters),
    enabled,
    staleTime: STALE,
  });
}

export function useStudentRows(params: StudentRowsParams) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-students", params],
    queryFn: () => fetchStudentRows(params),
    enabled,
    staleTime: STALE,
  });
}

export function useStudentAttemptsV2(studentId: string | null, filters: AnalyticsFilterState) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-student-attempts", studentId, filters],
    queryFn: () => fetchStudentAttempts(studentId as string, filters),
    enabled: enabled && Boolean(studentId),
    staleTime: STALE,
  });
}

export function useScoreMatrix(filters: AnalyticsFilterState) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-matrix", filters],
    queryFn: () => fetchScoreMatrix(filters),
    enabled,
    staleTime: STALE,
  });
}

export function useQuestionStats(
  examId: string | null,
  filters: AnalyticsFilterState,
  scope: QuestionScope = "first",
) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-questions", examId, filters, scope],
    queryFn: () => fetchQuestionStats(examId as string, filters, scope),
    enabled: enabled && Boolean(examId),
    staleTime: STALE,
  });
}

export function useAttendance(filters: AnalyticsFilterState) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["av2-attendance", filters],
    queryFn: () => fetchAttendance(filters),
    enabled,
    staleTime: STALE,
  });
}

/** Aktif/nonaktifkan siswa dari perhitungan analitik (persistent). */
export function useSetStudentExcluded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, excluded }: { userIds: string[]; excluded: boolean }) =>
      setStudentAnalyticsExcluded(userIds, excluded),
    onSuccess: () => {
      for (const key of ["av2-students", "av2-overview", "av2-trend", "av2-matrix", "av2-exams"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
