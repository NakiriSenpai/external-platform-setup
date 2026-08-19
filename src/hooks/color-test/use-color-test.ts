import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  answerColorTest,
  archiveColorTestQuestion,
  createColorTestQuestions,
  finishColorTest,
  getColorTest,
  listColorTestPool,
  listColorTestSummaries,
  setColorTestQuestionActive,
  skipColorTest,
  startColorTest,
  updateColorTestQuestion,
} from "@/services/color-test";
import type { ColorTestPayload } from "@/types/color-test";

/**
 * Sesi Color Test satu attempt. Sesi dibuat sekali (immutable), sehingga
 * refresh/reload TIDAK pernah menghasilkan 12 soal baru.
 */
export function useColorTestSession(attemptId: string, enabled = true) {
  return useQuery({
    queryKey: ["color-test", attemptId],
    queryFn: () => startColorTest(attemptId),
    enabled: Boolean(attemptId) && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Read-only: dipakai Result Page / Riwayat, tidak pernah membuat sesi baru. */
export function useColorTestResult(attemptId: string) {
  return useQuery({
    queryKey: ["color-test-result", attemptId],
    queryFn: () => getColorTest(attemptId),
    enabled: Boolean(attemptId),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useColorTestSummaries(attemptIds: string[]) {
  const key = [...attemptIds].sort().join(",");
  return useQuery({
    queryKey: ["color-test-summaries", key],
    queryFn: () => listColorTestSummaries(attemptIds),
    enabled: attemptIds.length > 0,
    staleTime: 30_000,
  });
}

function useSessionWriter(attemptId: string) {
  const queryClient = useQueryClient();
  return (payload: ColorTestPayload) => {
    queryClient.setQueryData(["color-test", attemptId], payload);
    void queryClient.invalidateQueries({ queryKey: ["color-test-result", attemptId] });
    void queryClient.invalidateQueries({ queryKey: ["color-test-summaries"] });
  };
}

export function useAnswerColorTest(attemptId: string) {
  const write = useSessionWriter(attemptId);
  return useMutation({ mutationFn: answerColorTest, onSuccess: write });
}

export function useSkipColorTest(attemptId: string) {
  const write = useSessionWriter(attemptId);
  return useMutation({ mutationFn: skipColorTest, onSuccess: write });
}

export function useFinishColorTest(attemptId: string) {
  const write = useSessionWriter(attemptId);
  return useMutation({
    mutationFn: ({
      sessionId,
      reason,
    }: {
      sessionId: string;
      reason?: "manual" | "exit" | "time_up";
    }) => finishColorTest(sessionId, reason ?? "manual"),
    onSuccess: write,
  });
}

/* ------------------------------- POOL -------------------------------- */

export function useColorTestPool() {
  return useQuery({ queryKey: ["color-test-pool"], queryFn: listColorTestPool, staleTime: 10_000 });
}

export function useColorTestPoolMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["color-test-pool"] });

  return {
    create: useMutation({ mutationFn: createColorTestQuestions, onSuccess: invalidate }),
    setActive: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) =>
        setColorTestQuestionActive(id, active),
      onSuccess: invalidate,
    }),
    archive: useMutation({ mutationFn: archiveColorTestQuestion, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({
        id,
        patch,
      }: {
        id: string;
        patch: {
          image_url?: string;
          image_public_id?: string | null;
          correct_answer?: string;
          active?: boolean;
        };
      }) => updateColorTestQuestion(id, patch),
      onSuccess: invalidate,
    }),
  };
}
