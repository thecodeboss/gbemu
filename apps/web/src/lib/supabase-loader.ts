import type { SupabaseAuthClient } from "./supabase-auth-client";
import type { SupabasePostgresClient } from "./supabase";

let authClientPromise: Promise<SupabaseAuthClient> | null = null;
export function loadSupabaseAuthClient(): Promise<SupabaseAuthClient> {
  if (!authClientPromise) {
    authClientPromise = import("@/lib/supabase-auth-client").then(
      ({ supabaseAuthClient }) => supabaseAuthClient,
    );
  }
  return authClientPromise;
}

let supabaseClientPromise: Promise<SupabasePostgresClient> | null = null;
export function loadSupabasePostgresClient(): Promise<SupabasePostgresClient> {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("@/lib/supabase").then((module) =>
      module.createSupabaseClient(),
    );
  }
  return supabaseClientPromise;
}
