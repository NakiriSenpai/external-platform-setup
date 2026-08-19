import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createExamCategory,
  deleteExamCategory,
  listExamCategories,
  updateExamCategory,
  type ExamCategoryInput,
  type ExamCategoryRow,
} from "@/services/exam/exam-category.service";

export function useExamCategories() {
  return useQuery({
    queryKey: ["exam-categories"],
    queryFn: listExamCategories,
    staleTime: 60_000,
  });
}

function useCategoryMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });
}

export const useCreateExamCategory = () => useCategoryMutation<ExamCategoryInput>(createExamCategory);
export const useUpdateExamCategory = () =>
  useCategoryMutation<{ id: string; input: ExamCategoryInput }>(({ id, input }) =>
    updateExamCategory(id, input),
  );
export const useDeleteExamCategory = () => useCategoryMutation<ExamCategoryRow>(deleteExamCategory);
