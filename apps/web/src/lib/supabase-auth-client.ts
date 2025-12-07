type MinimalUserMetadata = {
  avatar_url?: string | null;
  full_name?: string | null;
  global_name?: string | null;
};

type MinimalAppMetadata = {
  provider?: string;
  providers?: string[];
};

export type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: MinimalUserMetadata;
  app_metadata?: MinimalAppMetadata;
};

export type SupabaseAuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: SupabaseAuthUser;
};

type StoredSession = {
  currentSession?: SupabaseAuthSession | null;
  expiresAt?: number | null;
};

type SessionListener = (session: SupabaseAuthSession | null) => void;

function getProjectRef(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.split(".")[0] || null;
  } catch (err) {
    console.error("Failed to parse Supabase URL", err);
    return null;
  }
}

function getHashParams(): URLSearchParams {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}

function getSearchParams(): URLSearchParams {
  const search = typeof window !== "undefined" ? window.location.search : "";
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function removeAuthParamsFromUrl(
  source: "hash" | "search",
  params: URLSearchParams,
) {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }
  const nextUrl = new URL(window.location.href);
  if (source === "hash") {
    nextUrl.hash = "";
  } else {
    for (const key of params.keys()) {
      nextUrl.searchParams.delete(key);
    }
  }
  window.history.replaceState({}, document.title, nextUrl.toString());
}

export class SupabaseAuthClient {
  private session: SupabaseAuthSession | null = null;
  private readonly storageKey: string;
  private readonly authUrl: string;
  private readonly anonKey: string;
  private listeners = new Set<SessionListener>();
  private refreshTimer: number | null = null;

  constructor(supabaseUrl: string, anonKey: string) {
    this.authUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
    this.anonKey = anonKey;
    const projectRef = getProjectRef(supabaseUrl);
    this.storageKey = projectRef
      ? `sb-${projectRef}-auth-token`
      : "gbemu:auth-token";
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  teardown() {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.listeners.clear();
  }

  getSession(): SupabaseAuthSession | null {
    return this.session;
  }

  async initialize(): Promise<SupabaseAuthSession | null> {
    if (typeof window === "undefined") {
      return null;
    }

    const fromUrl = await this.tryLoadFromUrl();
    if (fromUrl) {
      return fromUrl;
    }

    const stored = await this.tryLoadFromStorage();
    if (stored) {
      this.setSession(stored);
      const expiresInMs = stored.expires_at * 1000 - Date.now();
      if (expiresInMs < 60_000) {
        try {
          return await this.refreshSession(true);
        } catch (err) {
          console.error("Supabase auth refresh failed", err);
        }
      }
      return stored;
    }

    this.notify();
    return null;
  }

  async refreshSession(force = false): Promise<SupabaseAuthSession | null> {
    if (!this.session) {
      return null;
    }
    const nowSeconds = Date.now() / 1000;
    const expiresIn = this.session.expires_at - nowSeconds;
    if (!force && expiresIn > 60) {
      return this.session;
    }

    const response = await fetch(
      `${this.authUrl}/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.anonKey,
        },
        body: JSON.stringify({ refresh_token: this.session.refresh_token }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to refresh Supabase session");
    }

    const result = (await response.json()) as Partial<SupabaseAuthSession> & {
      user?: SupabaseAuthUser;
      expires_at?: number;
    };

    const user =
      result.user ??
      (result.access_token
        ? await this.fetchUser(result.access_token)
        : this.session.user);

    const expiresAt =
      result.expires_at ??
      Math.round(Date.now() / 1000 + Number(result.expires_in ?? 0));

    const nextSession: SupabaseAuthSession = {
      access_token: result.access_token ?? this.session.access_token,
      refresh_token: result.refresh_token ?? this.session.refresh_token,
      token_type: result.token_type ?? "bearer",
      expires_in: Number(result.expires_in ?? this.session.expires_in),
      expires_at: expiresAt,
      user,
    };

    this.setSession(nextSession);
    return nextSession;
  }

  redirectToProvider(provider: string, redirectTo?: string) {
    const url = new URL(`${this.authUrl}/authorize`);
    url.searchParams.set("provider", provider);
    url.searchParams.set("redirect_to", redirectTo ?? window.location.origin);
    window.location.href = url.toString();
  }

  signOut() {
    this.setSession(null);
  }

  private async tryLoadFromUrl(): Promise<SupabaseAuthSession | null> {
    const hashParams = getHashParams();
    const searchParams = getSearchParams();
    const params = hashParams.has("access_token") ? hashParams : searchParams;

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = params.get("expires_in");

    if (!accessToken || !refreshToken || !expiresIn) {
      return null;
    }

    const tokenType = params.get("token_type") ?? "bearer";
    const session = await this.buildSessionFromTokens(
      accessToken,
      refreshToken,
      Number(expiresIn),
      tokenType,
    );

    removeAuthParamsFromUrl(
      hashParams.has("access_token") ? "hash" : "search",
      params,
    );
    this.setSession(session);
    return session;
  }

  private async tryLoadFromStorage(): Promise<SupabaseAuthSession | null> {
    try {
      if (typeof globalThis.localStorage === "undefined") {
        return null;
      }

      const raw = globalThis.localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredSession | SupabaseAuthSession;
      const session =
        "currentSession" in parsed
          ? (parsed.currentSession ?? null)
          : (parsed as SupabaseAuthSession);

      if (!session) {
        return null;
      }
      return session;
    } catch (err) {
      console.error("Failed to read stored Supabase session", err);
      return null;
    }
  }

  private async buildSessionFromTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    tokenType: string,
  ): Promise<SupabaseAuthSession> {
    const user = await this.fetchUser(accessToken);
    const expiresAt = Math.round(Date.now() / 1000 + expiresIn);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: tokenType,
      user,
    };
  }

  private async fetchUser(accessToken: string): Promise<SupabaseAuthUser> {
    const response = await fetch(`${this.authUrl}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: this.anonKey,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load Supabase user");
    }

    const user = (await response.json()) as SupabaseAuthUser;
    return user;
  }

  private scheduleRefresh(session: SupabaseAuthSession | null) {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!session) {
      return;
    }

    const refreshInMs = session.expires_at * 1000 - Date.now() - 60_000;
    const delay = Math.max(refreshInMs, 1_000);

    this.refreshTimer = window.setTimeout(() => {
      void this.refreshSession().catch((err) =>
        console.error("Supabase auth refresh failed", err),
      );
    }, delay);
  }

  private persistSession(session: SupabaseAuthSession | null) {
    try {
      if (typeof globalThis.localStorage === "undefined") {
        return;
      }

      if (!session) {
        globalThis.localStorage.removeItem(this.storageKey);
        return;
      }

      const stored: StoredSession = {
        currentSession: session,
        expiresAt: session.expires_at,
      };

      globalThis.localStorage.setItem(this.storageKey, JSON.stringify(stored));
    } catch (err) {
      console.error("Failed to persist Supabase session", err);
    }
  }

  private setSession(session: SupabaseAuthSession | null) {
    this.session = session;
    this.persistSession(session);
    this.scheduleRefresh(session);
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.session);
    }
  }
}

export const supabaseAuthClient = new SupabaseAuthClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
);
