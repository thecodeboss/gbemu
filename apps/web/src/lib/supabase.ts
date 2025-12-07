import type { SupabaseAuthClient } from "./supabase-auth-client";

export type SaveRow = {
  id: string;
  gameId: string;
  name: string;
  payload: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

type SessionProvider = Pick<SupabaseAuthClient, "getSession">;

export class SupabasePostgresClient {
  private readonly restUrl: string;
  private readonly anonKey: string;
  private readonly sessionProvider: SessionProvider;

  constructor(
    supabaseUrl: string,
    anonKey: string,
    sessionProvider: SessionProvider,
  ) {
    this.anonKey = anonKey;
    this.sessionProvider = sessionProvider;
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  private getAccessToken(): string | null {
    return this.sessionProvider.getSession()?.access_token ?? null;
  }

  private buildHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra ?? {});
    headers.set("apikey", this.anonKey);
    headers.set(
      "Authorization",
      `Bearer ${this.getAccessToken() ?? this.anonKey}`,
    );
    return headers;
  }

  private async request<T>(
    path: string,
    init: RequestOptions = {},
  ): Promise<T> {
    const headers = this.buildHeaders(init.headers);
    const isJsonBody =
      init.body &&
      typeof init.body === "string" &&
      !headers.has("Content-Type");

    if (isJsonBody) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${this.restUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let message = `Supabase request failed (${response.status})`;
      try {
        const error = (await response.json()) as {
          message?: string;
          hint?: string;
        };
        if (error?.message) {
          message = error.message;
        }
        if (error?.hint) {
          message += ` (${error.hint})`;
        }
      } catch (err) {
        console.error("Supabase error parsing failed", err);
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("json")) {
      return (await response.text()) as unknown as T;
    }

    return (await response.json()) as T;
  }

  async fetchSaves(): Promise<SaveRow[]> {
    const select = encodeURIComponent(
      "id,gameId,name,payload,createdAt,updatedAt",
    );
    return this.request<SaveRow[]>(`/saves?select=${select}`, {
      headers: {
        Accept: "application/json",
      },
    });
  }

  async upsertSave(record: SaveRow): Promise<SaveRow> {
    return this.request<SaveRow>("/saves?select=*", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.pgrst.object+json",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify(record),
    });
  }

  async deleteSave(id: string): Promise<void> {
    const encodedId = encodeURIComponent(id);
    await this.request<void>(`/saves?id=eq.${encodedId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });
  }
}

export async function createSupabaseClient(): Promise<SupabasePostgresClient> {
  const { supabaseAuthClient } = await import("@/lib/supabase-auth-client");
  return new SupabasePostgresClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseAuthClient,
  );
}
