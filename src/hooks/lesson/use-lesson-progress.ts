import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth";
import {
  completeLesson,
  getLessonAnalytics,
  getLessonAnalyticsOverview,
  getLessonProgress,
  getStudentCategoryProgress,
  getStudentLessonAnalytics,
  getStudentLessonProgress,
  listLessonsWithProgress,
  startLesson,
  updateLessonProgress,
  type LessonAnalyticsFilters,
} from "@/services/lesson/lesson-progress.service";

/**
 * Sprint 17: SEMUA role (owner/admin/guru/siswa) memiliki personal lesson
 * progress. Pembatasan role hanya berlaku pada Teacher Analytics.
 */
function useLearnerEnabled() {
  const { isAuthenticated, profile } = useAuth();
  return isAuthenticated && Boolean(profile);
}

function useStaffEnabled() {
  const { isAuthenticated, profile } = useAuth();
  return isAuthenticated && Boolean(profile) && profile?.role !== "siswa";
}

function useInvalidateProgress() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lesson-progress"] }),
      queryClient.invalidateQueries({ queryKey: ["lessons-with-progress"] }),
      queryClient.invalidateQueries({ queryKey: ["student-lesson-progress"] }),
      queryClient.invalidateQueries({ queryKey: ["student-category-progress"] }),
    ]);
}

export function useLessonProgress(lessonId: string) {
  const isStudent = useLearnerEnabled();
  return useQuery({
    queryKey: ["lesson-progress", lessonId],
    queryFn: () => getLessonProgress(lessonId),
    enabled: isStudent && Boolean(lessonId),
    staleTime: 10_000,
  });
}

export function useStartLesson() {
  const invalidate = useInvalidateProgress();
  return useMutation({
    mutationFn: (lessonId: string) => startLesson(lessonId),
    onSuccess: invalidate,
  });
}

export function useUpdateLessonProgress() {
  const invalidate = useInvalidateProgress();
  return useMutation({
    mutationFn: ({
      lessonId,
      blockIds,
      currentBlockId = null,
    }: {
      lessonId: string;
      blockIds: string[];
      currentBlockId?: string | null;
    }) => updateLessonProgress(lessonId, blockIds, currentBlockId),
    onSuccess: invalidate,
  });
}

export function useCompleteLesson() {
  const invalidate = useInvalidateProgress();
  return useMutation({
    mutationFn: (lessonId: string) => completeLesson(lessonId),
    onSuccess: invalidate,
  });
}

/** Daftar materi terbit + progres personal role yang sedang login. */
export function useLessonsWithProgress() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["lessons-with-progress"],
    queryFn: listLessonsWithProgress,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

export function useStudentLessonProgress() {
  const isStudent = useLearnerEnabled();
  return useQuery({
    queryKey: ["student-lesson-progress"],
    queryFn: getStudentLessonProgress,
    enabled: isStudent,
    staleTime: 30_000,
  });
}

export function useStudentCategoryProgress() {
  const isStudent = useLearnerEnabled();
  return useQuery({
    queryKey: ["student-category-progress"],
    queryFn: getStudentCategoryProgress,
    enabled: isStudent,
    staleTime: 30_000,
  });
}

export function useLessonAnalyticsOverview(filters: LessonAnalyticsFilters) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["lesson-analytics-overview", filters],
    queryFn: () => getLessonAnalyticsOverview(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useLessonAnalytics(filters: LessonAnalyticsFilters) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["lesson-analytics", filters],
    queryFn: () => getLessonAnalytics(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useStudentLessonAnalytics(
  studentId: string | null,
  filters: LessonAnalyticsFilters,
) {
  const enabled = useStaffEnabled();
  return useQuery({
    queryKey: ["lesson-analytics-student", studentId, filters],
    queryFn: () => getStudentLessonAnalytics(studentId as string, filters),
    enabled: enabled && Boolean(studentId),
    staleTime: 60_000,
  });
}
