import {
  SaveStorageAdapter,
  SaveStorageKey,
  SerializedSavePayload,
  SaveStorageRecord,
  normalizeSaveGameId,
} from "./storage.js";

export interface IndexedDbSaveAdapterOptions {
  databaseName?: string;
  storeName?: string;
}

const DEFAULT_DB_NAME = "gbemu-saves";
const DEFAULT_STORE_NAME = "saves";
const DB_VERSION = 3;

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
        if (db.objectStoreNames.contains(storeName)) {
          db.deleteObjectStore(storeName);
        }
        const store = db.createObjectStore(storeName, {
          keyPath: "id",
        });
        store.createIndex("byGame", "gameId", { unique: false });
        store.createIndex("byGameName", ["gameId", "name"], { unique: true });
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

  function normalizeKey(key: SaveStorageKey): SaveStorageKey {
    return {
      id: key.id,
      gameId: normalizeSaveGameId(key.gameId),
      name: key.name.trim(),
    };
  }

  return {
    async read(key): Promise<SaveStorageRecord | null> {
      const normalizedKey = normalizeKey(key);
      const record = await withStore<SaveStorageRecord | undefined>(
        "readonly",
        (store) =>
          normalizedKey.id
            ? store.get(normalizedKey.id)
            : store
                .index("byGameName")
                .get([normalizedKey.gameId, normalizedKey.name]),
      );
      if (!record) {
        return null;
      }
      return record;
    },

    async write(
      key,
      payload: SerializedSavePayload,
    ): Promise<SaveStorageRecord> {
      const normalizedKey = normalizeKey(key);
      const timestamp = Date.now();
      const db = await openDatabase();

      return await new Promise<SaveStorageRecord>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        const handleError = (error: unknown) => {
          reject(
            error instanceof Error
              ? error
              : new Error("Failed to write save payload."),
          );
        };

        const upsert = (existing: SaveStorageRecord | undefined): void => {
          const record: SaveStorageRecord = {
            id: existing?.id ?? normalizedKey.id ?? crypto.randomUUID(),
            gameId: normalizedKey.gameId,
            name: normalizedKey.name,
            payload: payload.slice(),
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          };

          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve(record);
          putRequest.onerror = () =>
            handleError(putRequest.error ?? new Error("Failed to write save."));
        };

        const lookupRequest = normalizedKey.id
          ? store.get(normalizedKey.id)
          : store
              .index("byGameName")
              .get([normalizedKey.gameId, normalizedKey.name]);

        lookupRequest.onsuccess = () => {
          const existing = lookupRequest.result as
            | SaveStorageRecord
            | undefined;
          upsert(existing);
        };
        lookupRequest.onerror = () =>
          handleError(
            lookupRequest.error ?? new Error("Failed to read existing save."),
          );

        tx.oncomplete = () => {
          db.close();
        };
        tx.onabort = () => {
          const error =
            tx.error ?? new Error("IndexedDB transaction was aborted.");
          db.close();
          reject(error);
        };
      });
    },

    async clear(key): Promise<void> {
      const normalizedKey = normalizeKey(key);
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        const handleError = (error: unknown) => {
          reject(
            error instanceof Error
              ? error
              : new Error("Failed to delete save payload."),
          );
        };

        const performDelete = (recordId: string): void => {
          const deleteRequest = store.delete(recordId);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () =>
            handleError(
              deleteRequest.error ?? new Error("Failed to delete save record."),
            );
        };

        const lookupRequest = normalizedKey.id
          ? store.get(normalizedKey.id)
          : store
              .index("byGameName")
              .get([normalizedKey.gameId, normalizedKey.name]);

        lookupRequest.onsuccess = () => {
          const record = lookupRequest.result as SaveStorageRecord | undefined;
          if (!record) {
            resolve();
            return;
          }
          performDelete(record.id);
        };

        lookupRequest.onerror = () =>
          handleError(
            lookupRequest.error ?? new Error("Failed to read existing save."),
          );

        tx.oncomplete = () => {
          db.close();
        };
        tx.onabort = () => {
          const error =
            tx.error ?? new Error("IndexedDB transaction was aborted.");
          db.close();
          reject(error);
        };
      });
    },

    async listNames(gameId: string): Promise<string[]> {
      const normalizedGameId = normalizeSaveGameId(gameId);
      const rows = await withStore<SaveStorageRecord[]>("readonly", (store) => {
        const index = store.index("byGame");
        return index.getAll(IDBKeyRange.only(normalizedGameId));
      });
      return rows.map((row) => row.name);
    },
  };
}
