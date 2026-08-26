import { createClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./authConfig.js";

export const supabaseConfig = readSupabaseConfig(import.meta.env);

export const supabaseClient = supabaseConfig.configured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  : null;
