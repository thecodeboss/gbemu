import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { loadSupabaseAuthClient } from "@/lib/supabase-loader";
import type {
  SupabaseAuthClient,
  SupabaseAuthSession,
  SupabaseAuthUser,
} from "@/lib/supabase-auth-client";

type AuthContextValue = {
  user: SupabaseAuthUser | null;
  session: SupabaseAuthSession | null;
  loading: boolean;
  refreshSession: () => Promise<SupabaseAuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SupabaseAuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const authClientRef = useRef<SupabaseAuthClient | null>(null);

  const getAuthClient = useCallback(async () => {
    const existing = authClientRef.current;
    if (existing) {
      return existing;
    }
    const client = await loadSupabaseAuthClient();
    authClientRef.current = client;
    return client;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      let client: SupabaseAuthClient | null = null;
      try {
        client = await getAuthClient();
        const initial = await client.initialize();
        if (!isMounted) return;
        setSession(initial);
      } catch (err) {
        console.error("Supabase auth init failed", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void init();

    void getAuthClient()
      .then((client) => {
        if (!isMounted) return;
        unsubscribe = client.subscribe((nextSession) => {
          if (!isMounted) return;
          setSession(nextSession);
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Supabase auth subscription failed", err);
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
      authClientRef.current?.teardown();
    };
  }, [getAuthClient]);

  const refreshSession = useCallback(async () => {
    try {
      const client = await getAuthClient();
      const next = await client.refreshSession(true);
      setSession(next);
      return next;
    } catch (err) {
      console.error("Supabase refresh failed", err);
      return null;
    }
  }, [getAuthClient]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
