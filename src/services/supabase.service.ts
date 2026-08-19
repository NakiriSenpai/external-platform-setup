import { supabase } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import type { ConnectionStatus } from "@/types/common";

/**
 * Cek konektivitas ke Supabase tanpa bergantung pada tabel apa pun.
 */
export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: env.supabasePublishableKey },
    });
    return response.ok
      ? { connected: true, message: "Supabase terhubung" }
      : { connected: false, message: `Supabase gagal (${response.status})` };
  } catch (error) {
    return {
      connected: false,
      message: error instanceof Error ? error.message : "Supabase tidak dapat dijangkau",
    };
  }
}

export { supabase };
