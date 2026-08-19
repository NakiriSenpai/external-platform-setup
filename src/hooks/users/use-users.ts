import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createUser,
  getTenantUserStats,
  listUsers,
  resetPassword,
  setUserActive,
  updateUser,
  type CreateUserPayload,
  type ResetUserPasswordPayload,
  type SetUserStatusPayload,
  type UpdateUserPayload,
  type UserListParams,
} from "@/services/users";

/** Daftar user dengan filter dan pagination. */
export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => listUsers(params),
    staleTime: 30_000,
  });
}

function useUserMutation<TPayload>(fn: (payload: TPayload) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export const useCreateUser = () => useUserMutation<CreateUserPayload>(createUser);
export const useUpdateUser = () => useUserMutation<UpdateUserPayload>(updateUser);
export const useSetUserActive = () => useUserMutation<SetUserStatusPayload>(setUserActive);
export const useResetPassword = () => useUserMutation<ResetUserPasswordPayload>(resetPassword);

/** Ringkasan jumlah user pada tenant tertentu (dashboard admin). */
export function useTenantUserStats(tenantId: string | null) {
  return useQuery({
    queryKey: ["tenant-user-stats", tenantId],
    queryFn: () => getTenantUserStats(tenantId as string),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}
