import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseAuthClient } from "./supabase-auth-client";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY!;

const authFetch: typeof fetch = async (input, init = {}) => {
  const session = supabaseAuthClient.getSession();
  const headers = new Headers(init.headers ?? {});

  headers.set("apikey", supabaseAnonKey);
  headers.set(
    "Authorization",
    session?.access_token
      ? `Bearer ${session.access_token}`
      : `Bearer ${supabaseAnonKey}`,
  );

  return fetch(input, { ...init, headers });
};

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: authFetch },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
