import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin(config) {
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function authenticateUser(client, token) {
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data?.user || null;
}
