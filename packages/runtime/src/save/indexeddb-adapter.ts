import {
  SaveStorageAdapter,
  SaveStorageKey,
  SerializedSavePayload,
  normalizeSaveGameId,
  resolveSaveSlot,
} from "./storage.js";

export interface IndexedDbSaveAdapterOptions {
  databaseName?: string;
  storeName?: string;
}

const DEFAULT_DB_NAME = "gbemu-saves";
const DEFAULT_STORE_NAME = "saves";
const DB_VERSION = 1;

interface SaveRecord {
  gameId: string;
  slot: string;
  payload: SerializedSavePayload;
  createdAt: number;
  updatedAt: number;
}

export function createIndexedDbSaveAdapter(
  options?: IndexedDbSaveAdapterOptions,
): SaveStorageAdapter {
  const databaseName = options?.databaseName ?? DEFAULT_DB_NAME;
  const storeName = options?.storeName ?? DEFAULT_STORE_NAME;

  async function openDatabase(): Promise<IDBDatabase> {
    if (!("indexedDB" in globalThis)) {
      throw new Error("IndexedDB is not available in this environment.");
    }

    return await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {
            keyPath: ["gameId", "slot"],
          });
          store.createIndex("byGame", "gameId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        reject(request.error ?? new Error("Failed to open IndexedDB."));
      };
    });
  }

  async function withStore<T>(
    mode: IDBTransactionMode,
    handler: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await openDatabase();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let request: IDBRequest<T>;
      try {
        request = handler(store);
      } catch (err) {
        db.close();
        reject(err);
        return;
      }

      request.onsuccess = () => {
        resolve(request.result as T);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("IndexedDB request failed."));
      };

      tx.oncomplete = () => {
        db.close();
      };
      tx.onabort = () => {
        db.close();
        if (tx.error) {
          reject(tx.error);
        }
      };
    });
  }

  function toKey(key: SaveStorageKey): [string, string] {
    return [normalizeSaveGameId(key.gameId), resolveSaveSlot(key.slot)];
  }

  return {
    async read(key): Promise<SerializedSavePayload | null> {
      const [gameId, slot] = toKey(key);
      const record = await withStore<SaveRecord | undefined>(
        "readonly",
        (store) => store.get([gameId, slot]),
      );
      if (!record) {
        return null;
      }
      return record.payload;
    },

    async write(key, payload: SerializedSavePayload): Promise<void> {
      const [gameId, slot] = toKey(key);
      const timestamp = Date.now();
      const record: SaveRecord = {
        gameId,
        slot,
        payload,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await withStore("readwrite", (store) => store.put(record));
    },

    async clear(key): Promise<void> {
      const [gameId, slot] = toKey(key);
      await withStore("readwrite", (store) => store.delete([gameId, slot]));
    },

    async listSlots(gameId: string): Promise<string[]> {
      const normalizedGameId = normalizeSaveGameId(gameId);
      const rows = await withStore<SaveRecord[]>("readonly", (store) => {
        const index = store.index("byGame");
        return index.getAll(IDBKeyRange.only(normalizedGameId));
      });
      return rows.map((row) => row.slot);
    },
  };
}
