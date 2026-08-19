import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ExamAttemptExpiredError,
  ExamSnapshotMissingError,
  deleteAttempt,
  getActiveAttempt,
  getAttemptResult,
  getAttemptReview,
  getAttemptSession,
  listAvailableExams,
  listMyAttempts,
  listUserAttempts,
  listMyResults,
  recordFullscreenViolation,
  saveAnswer,
  setFlag,
  startAttempt,
  submitAttempt,
  type SubmitReason,
} from "@/services/attempt";

export function useAvailableExams() {
  return useQuery({
    queryKey: ["available-exams"],
    queryFn: listAvailableExams,
    staleTime: 30_000,
  });
}

/** Hapus satu riwayat attempt (Owner only). */
export function useDeleteAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAttempt,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
      void queryClient.invalidateQueries({ queryKey: ["user-attempts"] });
      void queryClient.invalidateQueries({ queryKey: ["my-results"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

/** Riwayat attempt milik user lain (Owner only). */
export function useUserAttempts(userId: string | null) {
  return useQuery({
    queryKey: ["user-attempts", userId],
    queryFn: () => listUserAttempts(userId as string),
    enabled: Boolean(userId),
    staleTime: 10_000,
  });
}

export function useMyAttempts() {
  return useQuery({ queryKey: ["my-attempts"], queryFn: listMyAttempts, staleTime: 10_000 });
}

/** Hasil ujian milik user — dipakai statistik katalog ujian. */
export function useMyResults() {
  return useQuery({ queryKey: ["my-results"], queryFn: listMyResults, staleTime: 30_000 });
}

export function useActiveAttempt(examId: string) {
  return useQuery({
    queryKey: ["active-attempt", examId],
    queryFn: () => getActiveAttempt(examId),
    enabled: Boolean(examId),
  });
}

/**
 * Sesi attempt lengkap (snapshot immutable + jawaban tersimpan).
 * Sumber tunggal recovery setelah refresh / force close browser.
 * `enabled` dipakai untuk menunggu restorasi session auth (anti race condition).
 */
export function useAttemptSession(attemptId: string, enabled = true) {
  return useQuery({
    queryKey: ["attempt-session", attemptId],
    queryFn: () => getAttemptSession(attemptId),
    enabled: Boolean(attemptId) && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Expired / snapshot hilang bukan error jaringan → jangan diulang.
    retry: (failureCount, err) =>
      !(err instanceof ExamAttemptExpiredError || err instanceof ExamSnapshotMissingError) &&
      failureCount < 2,
    retryDelay: (attempt) => Math.min(1500, 400 * (attempt + 1)),
  });
}

export function useStartAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => startAttempt(examId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
    },
  });
}

export function useSaveAnswer() {
  return useMutation({ mutationFn: saveAnswer });
}

export function useSetFlag() {
  return useMutation({ mutationFn: setFlag });
}

export function useRecordViolation() {
  return useMutation({ mutationFn: (attemptId: string) => recordFullscreenViolation(attemptId) });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, reason }: { attemptId: string; reason: SubmitReason }) =>
      submitAttempt(attemptId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
      void queryClient.invalidateQueries({ queryKey: ["attempt-session"] });
      void queryClient.invalidateQueries({ queryKey: ["attempt-result"] });
    },
  });
}

/** Result page: baca hasil tersimpan, tidak pernah menghitung ulang. */
export function useAttemptResult(attemptId: string) {
  return useQuery({
    queryKey: ["attempt-result", attemptId],
    queryFn: () => getAttemptResult(attemptId),
    enabled: Boolean(attemptId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Review page: baca snapshot beku milik attempt. */
export function useAttemptReview(attemptId: string) {
  return useQuery({
    queryKey: ["attempt-review", attemptId],
    queryFn: () => getAttemptReview(attemptId),
    enabled: Boolean(attemptId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
