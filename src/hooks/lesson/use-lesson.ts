import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  attachQuestionsToLesson,
  createLesson,
  createLessonBlock,
  createLessonQuestion,
  createLessonSection,
  deleteLesson,
  deleteLessonBlock,
  deleteLessonSection,
  detachLessonQuestion,
  getLesson,
  listLessonBlocks,
  listLessonQuestions,
  listLessonSections,
  listLessonsAdmin,
  reorderLessonBlocks,
  reorderLessonQuestions,
  reorderLessonSections,
  setLessonStatus,
  updateLesson,
  updateLessonBlock,
  updateLessonQuestion,
  updateLessonSection,
} from "@/services/lesson";
import type {
  LessonBlockInput,
  LessonInput,
  LessonListParams,
  LessonSectionInput,
  LessonStatus,
} from "@/types/lesson";
import type { QuestionBankInput } from "@/types/question-bank";

export function useLessons(params: LessonListParams) {
  return useQuery({
    queryKey: ["lessons-admin", params],
    queryFn: () => listLessonsAdmin(params),
    staleTime: 30_000,
  });
}

export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => getLesson(lessonId),
    enabled: Boolean(lessonId),
  });
}

export function useLessonSections(lessonId: string) {
  return useQuery({
    queryKey: ["lesson-sections", lessonId],
    queryFn: () => listLessonSections(lessonId),
    enabled: Boolean(lessonId),
  });
}

export function useLessonBlocks(lessonId: string) {
  return useQuery({
    queryKey: ["lesson-blocks", lessonId],
    queryFn: () => listLessonBlocks(lessonId),
    enabled: Boolean(lessonId),
  });
}

export function useLessonQuestions(lessonId: string) {
  return useQuery({
    queryKey: ["lesson-questions", lessonId],
    queryFn: () => listLessonQuestions(lessonId),
    enabled: Boolean(lessonId),
  });
}

function useLessonMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lessons-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["lesson"] });
      void queryClient.invalidateQueries({ queryKey: ["lesson-sections"] });
      void queryClient.invalidateQueries({ queryKey: ["lesson-blocks"] });
      void queryClient.invalidateQueries({ queryKey: ["lesson-questions"] });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["question-bank"] });
    },
  });
}

export const useCreateLesson = () => useLessonMutation<LessonInput, unknown>(createLesson);
export const useUpdateLesson = () =>
  useLessonMutation<{ id: string; input: Partial<LessonInput> }, unknown>(({ id, input }) =>
    updateLesson(id, input),
  );
export const useSetLessonStatus = () =>
  useLessonMutation<{ id: string; status: LessonStatus }, unknown>(({ id, status }) =>
    setLessonStatus(id, status),
  );
export const useDeleteLesson = () => useLessonMutation<string, unknown>(deleteLesson);

export const useCreateLessonSection = () =>
  useLessonMutation<{ lessonId: string; input: LessonSectionInput }, unknown>(
    ({ lessonId, input }) => createLessonSection(lessonId, input),
  );
export const useUpdateLessonSection = () =>
  useLessonMutation<{ id: string; input: Partial<LessonSectionInput> }, unknown>(({ id, input }) =>
    updateLessonSection(id, input),
  );
export const useDeleteLessonSection = () => useLessonMutation<string, unknown>(deleteLessonSection);
export const useReorderLessonSections = () =>
  useLessonMutation<string[], unknown>(reorderLessonSections);

export const useCreateLessonBlock = () =>
  useLessonMutation<{ sectionId: string; input: LessonBlockInput }, unknown>(
    ({ sectionId, input }) => createLessonBlock(sectionId, input),
  );
export const useUpdateLessonBlock = () =>
  useLessonMutation<{ id: string; input: LessonBlockInput }, unknown>(({ id, input }) =>
    updateLessonBlock(id, input),
  );
export const useDeleteLessonBlock = () => useLessonMutation<string, unknown>(deleteLessonBlock);
export const useReorderLessonBlocks = () =>
  useLessonMutation<string[], unknown>(reorderLessonBlocks);

export const useCreateLessonQuestion = () =>
  useLessonMutation<{ lessonId: string; sectionId: string; input: QuestionBankInput }, unknown>(
    ({ lessonId, sectionId, input }) => createLessonQuestion(lessonId, sectionId, input),
  );
export const useUpdateLessonQuestion = () =>
  useLessonMutation<{ id: string; input: QuestionBankInput }, unknown>(({ id, input }) =>
    updateLessonQuestion(id, input),
  );
export const useAttachLessonQuestions = () =>
  useLessonMutation<{ lessonId: string; sectionId: string; questionIds: string[] }, number>(
    ({ lessonId, sectionId, questionIds }) =>
      attachQuestionsToLesson(lessonId, sectionId, questionIds),
  );
export const useDetachLessonQuestion = () =>
  useLessonMutation<string, unknown>(detachLessonQuestion);
export const useReorderLessonQuestions = () =>
  useLessonMutation<string[], unknown>(reorderLessonQuestions);
