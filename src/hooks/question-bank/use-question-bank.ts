import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBankQuestion,
  deleteBankQuestion,
  listBankQuestions,
  listGrammarTags,
  listLessons,
  listTags,
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

export function useGrammarTags() {
  return useQuery({
    queryKey: ["grammar-tags"],
    queryFn: listGrammarTags,
    staleTime: 5 * 60_000,
  });
}

export function useLessons() {
  return useQuery({
    queryKey: ["lessons"],
    queryFn: listLessons,
    staleTime: 5 * 60_000,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["question-tags"],
    queryFn: listTags,
    staleTime: 5 * 60_000,
  });
}

function useBankMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["question-bank"] });
      void queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
      void queryClient.invalidateQueries({ queryKey: ["question-tags"] });
    },
  });
}

export const useCreateBankQuestion = () => useBankMutation<QuestionBankInput>(createBankQuestion);
export const useUpdateBankQuestion = () =>
  useBankMutation<{ id: string; input: QuestionBankInput }>(({ id, input }) =>
    updateBankQuestion(id, input),
  );
export const useDeleteBankQuestion = () => useBankMutation<string>(deleteBankQuestion);
export const useMarkQuestionsUsed = () => useBankMutation<string[]>(markQuestionsUsed);
export const useArchiveBankQuestion = () =>
  useBankMutation<{ id: string; isArchived: boolean }>(({ id, isArchived }) =>
    setQuestionArchived(id, isArchived),
  );
