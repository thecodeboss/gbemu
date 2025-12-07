import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  SupabaseAuthSession,
  SupabaseAuthUser,
  supabaseAuthClient,
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

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const initial = await supabaseAuthClient.initialize();
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

    const unsubscribe = supabaseAuthClient.subscribe((nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      unsubscribe();
      supabaseAuthClient.teardown();
    };
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const next = await supabaseAuthClient.refreshSession(true);
      setSession(next);
      return next;
    } catch (err) {
      console.error("Supabase refresh failed", err);
      return null;
    }
  }, []);

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
