import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth";
import { listBookmarkedLessonIds, setLessonBookmark } from "@/services/lesson/lesson-bookmark.service";

/** Daftar id materi yang di-bookmark siswa. */
export function useLessonBookmarks() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["lesson-bookmarks"],
    queryFn: listBookmarkedLessonIds,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

export function useToggleLessonBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, bookmarked }: { lessonId: string; bookmarked: boolean }) =>
      setLessonBookmark(lessonId, bookmarked),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lesson-bookmarks"] });
    },
  });
}
