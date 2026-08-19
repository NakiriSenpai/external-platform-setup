import { useQuery } from "@tanstack/react-query";

import {
  getAnalyticsOverview,
  getExamDetailAnalytics,
  getStudentDetail,
  listExamAnalytics,
  listStudentAnalytics,
  type AnalyticsFilters,
  type StudentAnalyticsParams,
} from "@/services/analytics";
import { useAuth } from "@/hooks/auth";

function useStaffEnabled() {
  const { isAuthenticated, profile } = useAuth();
  return isAuthenticated && Boolean(profile) && profile?.role !== "siswa";
}

export function useAnalyticsOverview(filters: AnalyticsFilters) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["analytics-overview", filters],
    queryFn: () => getAnalyticsOverview(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useExamAnalytics(filters: AnalyticsFilters) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["analytics-exams", filters],
    queryFn: () => listExamAnalytics(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useStudentAnalytics(params: StudentAnalyticsParams) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["analytics-students", params],
    queryFn: () => listStudentAnalytics(params),
    enabled,
    staleTime: 60_000,
  });
}

export function useStudentDetail(studentId: string | null, filters: AnalyticsFilters) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["analytics-student-detail", studentId, filters],
    queryFn: () => getStudentDetail(studentId as string, filters),
    enabled: enabled && Boolean(studentId),
    staleTime: 60_000,
  });
}

export function useExamDetailAnalytics(examId: string | null, filters: AnalyticsFilters) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["analytics-exam-detail", examId, filters],
    queryFn: () => getExamDetailAnalytics(examId as string, filters),
    enabled: enabled && Boolean(examId),
    staleTime: 60_000,
  });
}
