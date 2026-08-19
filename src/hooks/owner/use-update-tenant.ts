import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateTenant, type UpdateTenantPayload } from "@/services/owner";

/** Mutation memperbarui branding & status tenant. */
export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTenantPayload) => updateTenant(payload),
    onSuccess: (_result, payload) => {
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["tenant", payload.tenantId] });
    },
  });
}
