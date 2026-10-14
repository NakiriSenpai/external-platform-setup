import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth";
import {
  deleteDiscussionGroup,
  deleteExamComment,
  editExamComment,
  listDiscussionEvents,
  listDiscussionGroups,
  listExamDiscussion,
  markDiscussionGroupRead,
  postExamComment,
} from "@/services/discussion/discussion.service";

const discussionKey = (examId: string, questionId: string | null, tenantId: string | null) =>
  ["exam-discussion", examId, questionId ?? "all", tenantId ?? "self"] as const;

export function useExamDiscussion(input: {
  examId: string;
  questionId?: string | null;
  tenantId?: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: discussionKey(input.examId, input.questionId ?? null, input.tenantId ?? null),
    queryFn: () =>
      listExamDiscussion({
        examId: input.examId,
        questionId: input.questionId,
        tenantId: input.tenantId,
      }),
    enabled: Boolean(input.examId) && (input.enabled ?? true),
    staleTime: 15_000,
    retry: false,
  });
}

function useInvalidateDiscussion() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["exam-discussion"] });
    void queryClient.invalidateQueries({ queryKey: ["discussion-groups"] });
  };
}

export function usePostComment() {
  const invalidate = useInvalidateDiscussion();
  return useMutation({ mutationFn: postExamComment, onSuccess: invalidate });
}

export function useEditComment() {
  const invalidate = useInvalidateDiscussion();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => editExamComment(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteComment() {
  const invalidate = useInvalidateDiscussion();
  return useMutation({ mutationFn: deleteExamComment, onSuccess: invalidate });
}

export function useDiscussionGroups() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["discussion-groups"],
    queryFn: listDiscussionGroups,
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}

export function useDiscussionEvents(groupId: string | null) {
  return useQuery({
    queryKey: ["discussion-events", groupId],
    queryFn: () => listDiscussionEvents(groupId as string),
    enabled: Boolean(groupId),
    staleTime: 15_000,
  });
}

export function useMarkDiscussionGroupRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markDiscussionGroupRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["discussion-groups"] }),
  });
}

export function useDeleteDiscussionGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDiscussionGroup,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["discussion-groups"] });
      void queryClient.invalidateQueries({ queryKey: ["discussion-events"] });
    },
  });
}
