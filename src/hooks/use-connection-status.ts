import { useQuery } from "@tanstack/react-query";

import { checkSupabaseConnection } from "@/services/supabase.service";
import { checkCloudinaryConnection } from "@/services/cloudinary.service";

export function useSupabaseStatus() {
  return useQuery({
    queryKey: ["status", "supabase"],
    queryFn: checkSupabaseConnection,
    staleTime: 60_000,
  });
}

export function useCloudinaryStatus() {
  return useQuery({
    queryKey: ["status", "cloudinary"],
    queryFn: checkCloudinaryConnection,
    staleTime: 60_000,
  });
}
