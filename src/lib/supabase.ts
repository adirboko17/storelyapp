import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseConfig } from "@/lib/config";
import { secureStoreAdapter } from "@/lib/secure-store";

let client: SupabaseClient | null = null;

export function getSupabase() {
  const config = readPublicSupabaseConfig();
  if (config.problem) return null;
  if (client) return client;
  client = createClient(config.url, config.key, {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
