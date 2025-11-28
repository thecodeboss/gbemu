const DB_NAME = "gbemu-recent-roms";
const DB_VERSION = 1;
const STORE_NAME = "recent-roms";

export interface RecentRomSummary {
  id: string;
  name: string;
  lastPlayed: number;
  size: number;
}

export interface RecentRomRecord extends RecentRomSummary {
  data: Uint8Array;
}

interface RecentRomRecordInternal extends RecentRomSummary {
  data: ArrayBuffer;
}

const generateId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `recent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

let dbPromise: Promise<IDBDatabase> | undefined;

const openDb = async (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable in this environment.");
  }
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex("lastPlayed", "lastPlayed", { unique: false });
      store.createIndex("name", "name", { unique: false });
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(
        request.error ?? new Error("Failed to open recent ROMs database."),
      );
    };
  }).catch((err) => {
    dbPromise = undefined;
    throw err;
  });
  return dbPromise;
};

export const isRecentStorageAvailable = (): boolean =>
  typeof indexedDB !== "undefined";

export const storeRecentRom = async (input: {
  name: string;
  data: Uint8Array;
  id?: string;
}): Promise<string> => {
  const db = await openDb();
  const record: RecentRomRecordInternal = {
    id: input.id ?? generateId(),
    name: input.name,
    data: input.data.slice().buffer,
    lastPlayed: Date.now(),
    size: input.data.byteLength,
  };

  return await new Promise<string>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const putRecord = () => {
      store.put(record);
    };

    if (input.id) {
      putRecord();
    } else {
      const byName = store.index("name");
      const existingKeyRequest = byName.getKey(record.name);
      existingKeyRequest.onsuccess = () => {
        const existingId = existingKeyRequest.result as string | undefined;
        if (existingId) {
          record.id = existingId;
        }
        putRecord();
      };
      existingKeyRequest.onerror = () => {
        reject(
          existingKeyRequest.error ??
            new Error("Failed to check existing recent ROM entries."),
        );
      };
    }

    tx.oncomplete = () => resolve(record.id);
    tx.onerror = () =>
      reject(tx.error ?? new Error("Failed to persist recent ROM entry."));
  });
};

export const listRecentRoms = async (
  page: number,
  pageSize: number,
): Promise<{ items: RecentRomSummary[]; total: number }> => {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("lastPlayed");

    const totalRequest = store.count();
    const items: RecentRomSummary[] = [];
    const start = Math.max(0, (page - 1) * pageSize);

    let skipped = 0;
    const cursorRequest = index.openCursor(null, "prev");

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        return;
      }
      if (skipped < start) {
        skipped += 1;
        cursor.continue();
        return;
      }
      if (items.length < pageSize) {
        const value = cursor.value as RecentRomRecordInternal;
        items.push({
          id: value.id,
          name: value.name,
          lastPlayed: value.lastPlayed,
          size: value.size,
        });
      }
      if (items.length < pageSize) {
        cursor.continue();
      }
    };

    cursorRequest.onerror = () =>
      reject(cursorRequest.error ?? new Error("Failed to read recent ROMs."));

    tx.oncomplete = () => {
      const total = totalRequest.result ?? 0;
      resolve({ items, total });
    };
    tx.onerror = () =>
      reject(tx.error ?? new Error("Failed to load recent ROMs."));
  });
};

export const loadRecentRom = async (
  id: string,
): Promise<RecentRomRecord | null> => {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const value = request.result as RecentRomRecordInternal | undefined;
      if (!value) {
        resolve(null);
        return;
      }
      resolve({
        id: value.id,
        name: value.name,
        lastPlayed: value.lastPlayed,
        size: value.size,
        data: new Uint8Array(value.data),
      });
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to load the requested ROM."));
  });
};
