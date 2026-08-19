import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  countQuestionReferences,
  createBankQuestion,
  deleteBankQuestion,
  listBankQuestions,
  listLessons,
  setQuestionArchived,
  markQuestionsUsed,
  updateBankQuestion,
} from "@/services/question-bank";
import type { QuestionBankFilters, QuestionBankInput } from "@/types/question-bank";

export function useBankQuestions(filters: QuestionBankFilters) {
  return useQuery({
    queryKey: ["question-bank", filters],
    queryFn: () => listBankQuestions(filters),
    staleTime: 30_000,
  });
}

export function useLessons() {
  return useQuery({
    queryKey: ["lessons"],
    queryFn: listLessons,
    staleTime: 5 * 60_000,
  });
}

/** Referensi Exam/Lesson untuk satu soal (dipakai dialog konfirmasi hapus). */
export function useQuestionReferences(questionId: string | null) {
  return useQuery({
    queryKey: ["question-references", questionId],
    queryFn: () => countQuestionReferences(questionId as string),
    enabled: Boolean(questionId),
    staleTime: 10_000,
  });
}

function useBankMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["question-bank"] });
      void queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
    },
  });
}

export const useCreateBankQuestion = () => useBankMutation<QuestionBankInput, string>(createBankQuestion);
export const useUpdateBankQuestion = () =>
  useBankMutation<{ id: string; input: QuestionBankInput }, void>(({ id, input }) =>
    updateBankQuestion(id, input),
  );
export const useDeleteBankQuestion = () => useBankMutation(deleteBankQuestion);
export const useMarkQuestionsUsed = () => useBankMutation<string[], void>(markQuestionsUsed);
export const useArchiveBankQuestion = () =>
  useBankMutation<{ id: string; isArchived: boolean }, void>(({ id, isArchived }) =>
    setQuestionArchived(id, isArchived),
  );
