import {
  SaveStorageAdapter,
  SaveStorageKey,
  SaveStorageRecord,
  SaveWriteOptions,
} from "@gbemu/runtime";
import {
  SupabasePostgresClient,
  SaveRow as SupabaseSaveRow,
} from "@/lib/supabase";

export type SaveSyncState = "synced" | "pending" | "error";

interface QueueUpsertOperation {
  type: "upsert";
  record: SaveStorageRecord;
}

interface QueueDeleteOperation {
  type: "delete";
  id: string;
}

type QueueOperation = QueueUpsertOperation | QueueDeleteOperation;

interface PersistedQueueRecord {
  id: string;
  gameId: string;
  name: string;
  payload: string;
  createdAt: number;
  updatedAt: number;
}

interface PersistedQueueOperation {
  type: QueueOperation["type"];
  record?: PersistedQueueRecord;
  id?: string;
}

export interface SupabaseSyncedSaveStorage extends SaveStorageAdapter {
  syncFromSupabase(): Promise<void>;
  flushQueue(): Promise<void>;
  setRemote(
    client: SupabasePostgresClient | null,
    userId: string | null,
  ): Promise<void>;
  getSyncStateMap(): Record<string, SaveSyncState>;
}

function queueStorageKey(userId: string): string {
  return `gbemu:save-sync:queue:${userId}`;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const value of bytes) {
    hex += value.toString(16).padStart(2, "0");
  }
  return `\\x${hex}`;
}

function hexToBytes(raw: string): Uint8Array | null {
  const normalized =
    raw.startsWith("\\x") || raw.startsWith("0x") ? raw.slice(2) : raw;
  if (normalized.length % 2 !== 0) {
    return null;
  }

  const result = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    const byte = Number.parseInt(normalized.slice(index, index + 2), 16);
    if (Number.isNaN(byte)) {
      return null;
    }
    result[index / 2] = byte;
  }
  return result;
}

function encodePayloadForQueue(payload: Uint8Array): string {
  let binary = "";
  for (const byte of payload) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeQueuedPayload(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}

function decodeSupabasePayload(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    const bytes = hexToBytes(normalized);
    if (bytes) {
      return bytes;
    }
    try {
      return decodeQueuedPayload(normalized);
    } catch (err) {
      console.warn("Failed to decode Supabase payload", err);
      return null;
    }
  }
  return null;
}

function parseSupabaseTimestamp(value: unknown): number {
  if (value === null || value === undefined) {
    return NaN;
  }
  const timestamp = String(value).trim();
  if (timestamp === "") {
    return NaN;
  }

  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(timestamp);
  const normalized = hasTimezone ? timestamp : `${timestamp}Z`;

  return Date.parse(normalized);
}

function serializeQueue(queue: QueueOperation[]): PersistedQueueOperation[] {
  return queue.map((operation) =>
    operation.type === "delete"
      ? { type: "delete", id: operation.id }
      : {
          type: "upsert",
          record: {
            id: operation.record.id,
            gameId: operation.record.gameId,
            name: operation.record.name,
            payload: encodePayloadForQueue(operation.record.payload),
            createdAt: operation.record.createdAt,
            updatedAt: operation.record.updatedAt,
          },
        },
  );
}

function hydrateQueue(operations: PersistedQueueOperation[]): QueueOperation[] {
  const queue: QueueOperation[] = [];
  for (const entry of operations) {
    if (entry.type === "delete" && entry.id) {
      queue.push({ type: "delete", id: entry.id });
      continue;
    }
    if (entry.type === "upsert" && entry.record) {
      queue.push({
        type: "upsert",
        record: {
          id: entry.record.id,
          gameId: entry.record.gameId,
          name: entry.record.name,
          payload: decodeQueuedPayload(entry.record.payload),
          createdAt: entry.record.createdAt,
          updatedAt: entry.record.updatedAt,
        },
      });
    }
  }
  return queue;
}

function loadQueueForUser(userId: string | null): QueueOperation[] {
  if (!userId) {
    return [];
  }
  try {
    const raw = globalThis.localStorage.getItem(queueStorageKey(userId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PersistedQueueOperation[];
    return hydrateQueue(parsed);
  } catch (err) {
    console.error("Failed to load save sync queue", err);
    return [];
  }
}

function persistQueue(userId: string | null, queue: QueueOperation[]): void {
  if (!userId) {
    return;
  }
  try {
    const serialized = JSON.stringify(serializeQueue(queue));
    globalThis.localStorage.setItem(queueStorageKey(userId), serialized);
  } catch (err) {
    console.error("Failed to persist save sync queue", err);
  }
}

function toSupabaseRecord(record: SaveStorageRecord) {
  return {
    id: record.id,
    gameId: record.gameId,
    name: record.name,
    payload: bytesToHex(record.payload),
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}

function toSaveStorageRecord(row: {
  id?: unknown;
  gameId?: unknown;
  name?: unknown;
  payload?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): SaveStorageRecord | null {
  if (
    typeof row.id !== "string" ||
    typeof row.gameId !== "string" ||
    typeof row.name !== "string"
  ) {
    return null;
  }
  const payload = decodeSupabasePayload(row.payload);
  if (!payload) {
    return null;
  }
  const createdAt = parseSupabaseTimestamp(row.createdAt);
  const updatedAt = parseSupabaseTimestamp(row.updatedAt);
  const createdMs = Number.isNaN(createdAt) ? Date.now() : createdAt;
  const updatedMs = Number.isNaN(updatedAt) ? createdMs : updatedAt;

  return {
    id: row.id,
    gameId: row.gameId,
    name: row.name,
    payload,
    createdAt: createdMs,
    updatedAt: updatedMs,
  };
}

export function createSupabaseSaveAdapter(options: {
  baseAdapter: SaveStorageAdapter;
  onStatusChange?: (status: Record<string, SaveSyncState>) => void;
}): SupabaseSyncedSaveStorage {
  const { baseAdapter, onStatusChange } = options;
  let supabaseClient: SupabasePostgresClient | null = null;
  let userId: string | null = null;
  let queue: QueueOperation[] = [];
  let isFlushing = false;
  let isSyncing = false;
  let onlineHandler: (() => void) | null = null;
  const statusMap = new Map<string, SaveSyncState>();

  const emitStatusChange = () => {
    if (!onStatusChange) {
      return;
    }
    const entries: [string, SaveSyncState][] = Array.from(statusMap.entries());
    onStatusChange(Object.fromEntries(entries));
  };

  const setStatus = (id: string, state: SaveSyncState) => {
    const current = statusMap.get(id);
    if (current === state) {
      return;
    }
    statusMap.set(id, state);
    emitStatusChange();
  };

  const clearStatus = (id: string) => {
    if (!statusMap.has(id)) {
      return;
    }
    statusMap.delete(id);
    emitStatusChange();
  };

  const processUpsert = async (operation: QueueUpsertOperation) => {
    if (!supabaseClient || !userId) {
      return false;
    }

    try {
      await supabaseClient.upsertSave(toSupabaseRecord(operation.record));
      setStatus(operation.record.id, "synced");
      return true;
    } catch (error) {
      console.error("Supabase save upsert failed", error);
      setStatus(operation.record.id, "error");
      return false;
    }
  };

  const processDelete = async (operation: QueueDeleteOperation) => {
    if (!supabaseClient || !userId) {
      return false;
    }

    try {
      await supabaseClient.deleteSave(operation.id);
      clearStatus(operation.id);
      return true;
    } catch (error) {
      console.error("Supabase save delete failed", error);
      setStatus(operation.id, "error");
      return false;
    }
  };

  const flushQueue = async () => {
    if (!supabaseClient || !userId || queue.length === 0 || isFlushing) {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    const pending = [...queue];
    const pendingRefs = new Set(pending);
    isFlushing = true;
    try {
      for (const operation of pending) {
        const success =
          operation.type === "delete"
            ? await processDelete(operation)
            : await processUpsert(operation);
        if (success) {
          const index = queue.findIndex((item) => item === operation);
          if (index >= 0) {
            queue.splice(index, 1);
          }
        }
      }
      persistQueue(userId, queue);
    } finally {
      isFlushing = false;
      emitStatusChange();
    }

    const hasNewOperations = queue.some(
      (operation) => !pendingRefs.has(operation),
    );
    if (hasNewOperations) {
      void flushQueue();
    }
  };

  const enqueueOperation = (operation: QueueOperation) => {
    if (!userId || !supabaseClient) {
      return;
    }

    const existingIndex = queue.findIndex((item) => {
      if (item.type !== operation.type) {
        return false;
      }
      if (item.type === "delete" && operation.type === "delete") {
        return item.id === operation.id;
      }
      if (item.type === "upsert" && operation.type === "upsert") {
        return item.record.id === operation.record.id;
      }
      return false;
    });

    if (existingIndex >= 0) {
      queue.splice(existingIndex, 1, operation);
    } else {
      queue.push(operation);
    }

    if (operation.type === "upsert") {
      setStatus(operation.record.id, "pending");
    }

    persistQueue(userId, queue);
    void flushQueue();
  };

  const syncFromSupabase = async (): Promise<void> => {
    if (!supabaseClient || !userId) {
      return;
    }
    if (isSyncing) {
      return;
    }

    isSyncing = true;
    try {
      const listAll = baseAdapter.listAll;
      if (!listAll) {
        console.warn("listAll is required to sync saves from Supabase.");
        return;
      }

      let remoteRows: SupabaseSaveRow[] = [];

      try {
        remoteRows = await supabaseClient.fetchSaves();
      } catch (error) {
        console.error("Failed to fetch saves from Supabase", error);
        return;
      }

      const remoteRecords = remoteRows
        .map((row) => toSaveStorageRecord(row))
        .filter((row): row is SaveStorageRecord => Boolean(row));

      const localRecords = await listAll();
      const localById = new Map<string, SaveStorageRecord>();
      const localByName = new Map<string, SaveStorageRecord>();
      for (const record of localRecords) {
        localById.set(record.id, record);
        localByName.set(
          `${record.gameId}:${record.name.toLowerCase()}`,
          record,
        );
      }

      const seen = new Set<string>();

      for (const remote of remoteRecords) {
        const nameKey = `${remote.gameId}:${remote.name.toLowerCase()}`;
        const localByNameMatch = localByName.get(nameKey);

        if (localByNameMatch && localByNameMatch.id !== remote.id) {
          if (remote.updatedAt >= localByNameMatch.updatedAt) {
            await baseAdapter.clear({
              gameId: localByNameMatch.gameId,
              name: localByNameMatch.name,
              id: localByNameMatch.id,
            });
            localById.delete(localByNameMatch.id);
            localByName.delete(nameKey);
            clearStatus(localByNameMatch.id);
            seen.add(localByNameMatch.id);
          } else {
            enqueueOperation({ type: "upsert", record: localByNameMatch });
            seen.add(localByNameMatch.id);
            continue;
          }
        }

        const local = localById.get(remote.id) ?? localByNameMatch;
        if (!local || remote.updatedAt > local.updatedAt) {
          const written = await baseAdapter.write(
            {
              gameId: remote.gameId,
              name: remote.name,
              id: remote.id,
            },
            remote.payload,
            {
              createdAt: remote.createdAt,
              updatedAt: remote.updatedAt,
              skipSync: true,
            } satisfies SaveWriteOptions,
          );
          localById.set(written.id, written);
          localByName.set(nameKey, written);
          setStatus(remote.id, "synced");
          seen.add(remote.id);
          continue;
        }

        if (remote.updatedAt < local.updatedAt) {
          enqueueOperation({ type: "upsert", record: local });
          seen.add(local.id);
          continue;
        }

        setStatus(remote.id, statusMap.get(remote.id) ?? "synced");
        seen.add(remote.id);
      }

      for (const local of localRecords) {
        if (!localById.has(local.id)) {
          continue;
        }
        if (seen.has(local.id)) {
          continue;
        }
        enqueueOperation({ type: "upsert", record: local });
      }
    } finally {
      isSyncing = false;
    }
  };

  const attachOnlineListener = () => {
    if (onlineHandler) {
      return;
    }
    onlineHandler = () => {
      void flushQueue();
    };
    globalThis.addEventListener("online", onlineHandler);
  };

  const detachOnlineListener = () => {
    if (!onlineHandler) {
      return;
    }
    globalThis.removeEventListener("online", onlineHandler);
    onlineHandler = null;
  };

  const setRemote = async (
    client: SupabasePostgresClient | null,
    nextUserId: string | null,
  ): Promise<void> => {
    if (supabaseClient === client && userId === nextUserId) {
      return;
    }

    supabaseClient = client;

    if (userId !== nextUserId) {
      statusMap.clear();
      queue = loadQueueForUser(nextUserId);
      for (const operation of queue) {
        if (operation.type === "upsert") {
          statusMap.set(operation.record.id, "pending");
        }
      }
      emitStatusChange();
    }

    userId = nextUserId;

    if (supabaseClient && userId) {
      attachOnlineListener();
      await syncFromSupabase();
      await flushQueue();
    } else {
      detachOnlineListener();
    }
  };

  const read = (key: SaveStorageKey) => baseAdapter.read(key);

  const write = async (
    key: SaveStorageKey,
    payload: Uint8Array,
    options?: SaveWriteOptions,
  ): Promise<SaveStorageRecord> => {
    const record = await baseAdapter.write(key, payload, options);
    if (!options?.skipSync) {
      enqueueOperation({ type: "upsert", record });
    }
    return record;
  };

  const clear = async (key: SaveStorageKey): Promise<void> => {
    const existing = await baseAdapter.read(key);
    await baseAdapter.clear(key);
    if (existing) {
      enqueueOperation({ type: "delete", id: existing.id });
    }
  };

  return {
    read,
    write,
    clear,
    listNames: baseAdapter.listNames?.bind(baseAdapter),
    listAll: baseAdapter.listAll?.bind(baseAdapter),
    syncFromSupabase,
    flushQueue,
    setRemote,
    getSyncStateMap: () => Object.fromEntries(statusMap),
  };
}
