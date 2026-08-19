import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTenant, type CreateTenantPayload } from "@/services/owner";

/** Mutation membuat tenant baru beserta akun admin pertama. */
export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTenantPayload) => createTenant(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
