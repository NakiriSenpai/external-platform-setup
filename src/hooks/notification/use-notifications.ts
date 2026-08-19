import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notification";

/** Notifikasi milik user aktif (RLS yang menentukan scope tenant/role). */
export function useNotifications() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => listMyNotifications(),
    enabled: isAuthenticated,
    staleTime: 60_000,
    // Cukup satu kali per menit + saat tab difokuskan (hindari polling berlebihan).
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: readonly string[]) => markAllNotificationsRead(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
