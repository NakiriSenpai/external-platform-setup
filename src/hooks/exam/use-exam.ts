import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createExam,
  createQuestion,
  createSection,
  deleteExam,
  deleteQuestion,
  deleteSection,
  getExam,
  listExams,
  listQuestions,
  listSections,
  attachQuestionsToExam,
  reorderQuestions,
  reorderSections,
  setExamStatus,
  updateExam,
  updateQuestion,
  updateSection,
  type ExamListParams,
} from "@/services/exam";
import type { ExamInput, ExamStatus, SectionInput } from "@/types/exam";
import type { QuestionBankInput } from "@/types/question-bank";

export function useExams(params: ExamListParams) {
  return useQuery({
    queryKey: ["exams", params],
    queryFn: () => listExams(params),
    staleTime: 30_000,
  });
}

export function useExam(examId: string) {
  return useQuery({
    queryKey: ["exam", examId],
    queryFn: () => getExam(examId),
    enabled: Boolean(examId),
  });
}

export function useExamSections(examId: string) {
  return useQuery({
    queryKey: ["exam-sections", examId],
    queryFn: () => listSections(examId),
    enabled: Boolean(examId),
  });
}

export function useExamQuestions(examId: string) {
  return useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => listQuestions(examId),
    enabled: Boolean(examId),
  });
}

function useExamMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["exam"] });
      void queryClient.invalidateQueries({ queryKey: ["exam-sections"] });
      void queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
    },
  });
}

export const useCreateExam = () => useExamMutation<ExamInput>(createExam);
export const useUpdateExam = () =>
  useExamMutation<{ id: string; input: Partial<ExamInput> }>(({ id, input }) =>
    updateExam(id, input),
  );
export const useSetExamStatus = () =>
  useExamMutation<{ id: string; status: ExamStatus }>(({ id, status }) => setExamStatus(id, status));
export const useDeleteExam = () => useExamMutation<string>(deleteExam);

export const useCreateSection = () =>
  useExamMutation<{ examId: string; input: SectionInput }>(({ examId, input }) =>
    createSection(examId, input),
  );
export const useUpdateSection = () =>
  useExamMutation<{ id: string; input: Partial<SectionInput> }>(({ id, input }) =>
    updateSection(id, input),
  );
export const useDeleteSection = () => useExamMutation<string>(deleteSection);
export const useReorderSections = () => useExamMutation<string[]>(reorderSections);

export const useCreateQuestion = () =>
  useExamMutation<{ examId: string; sectionId: string; input: QuestionBankInput }>(
    ({ examId, sectionId, input }) => createQuestion(examId, sectionId, input),
  );
export const useUpdateQuestion = () =>
  useExamMutation<{ id: string; input: QuestionBankInput }>(({ id, input }) => updateQuestion(id, input));
export const useAttachQuestions = () =>
  useExamMutation<{ examId: string; sectionId: string; questionIds: string[] }>(
    ({ examId, sectionId, questionIds }) => attachQuestionsToExam(examId, sectionId, questionIds),
  );
export const useDeleteQuestion = () => useExamMutation<string>(deleteQuestion);
export const useReorderQuestions = () => useExamMutation<string[]>(reorderQuestions);
