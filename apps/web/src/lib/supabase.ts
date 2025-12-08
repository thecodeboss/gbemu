import { supabaseAuthClient } from "./supabase-auth-client";

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

export class SupabasePostgresClient {
  private readonly restUrl: string;
  private readonly anonKey: string;

  constructor(supabaseUrl: string, anonKey: string) {
    this.anonKey = anonKey;
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  private async getAccessToken(): Promise<string | null> {
    const session = supabaseAuthClient.getSession();
    if (!session) {
      return null;
    }

    const secondsUntilExpiry = session.expires_at - Date.now() / 1000;
    if (secondsUntilExpiry <= 10) {
      try {
        const refreshed = await supabaseAuthClient.refreshSession(true);
        return refreshed?.access_token ?? null;
      } catch (err) {
        console.error("Supabase access token refresh failed", err);
      }
    }

    return session.access_token;
  }

  private async buildHeaders(extra?: HeadersInit): Promise<Headers> {
    const headers = new Headers(extra ?? {});
    headers.set("apikey", this.anonKey);
    const accessToken = await this.getAccessToken();
    headers.set("Authorization", `Bearer ${accessToken ?? this.anonKey}`);
    return headers;
  }

  private async request<T>(
    path: string,
    init: RequestOptions = {},
  ): Promise<T> {
    const headers = await this.buildHeaders(init.headers);
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

export const supabase = new SupabasePostgresClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
);
