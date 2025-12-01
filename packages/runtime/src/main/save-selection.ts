import { EmulatorRomInfo } from "@gbemu/core";

import {
  DEFAULT_SAVE_NAME,
  SaveStorageAdapter,
  SaveStorageKey,
  SerializedSavePayload,
  SaveStorageRecord,
  createSaveStorageKey,
  normalizeSaveGameId,
} from "../save/storage.js";

const activeSavePreferenceKey = (gameId: string): string =>
  `gbemu:last-save:${gameId}`;

export function rememberActiveSaveName(key: SaveStorageKey | null): void {
  if (!key) {
    return;
  }
  globalThis.localStorage.setItem(
    activeSavePreferenceKey(key.gameId),
    key.name,
  );
}

export function readActiveSaveName(gameId: string): string | null {
  return globalThis.localStorage.getItem(activeSavePreferenceKey(gameId));
}

export function clearActiveSaveName(gameId: string): void {
  globalThis.localStorage.removeItem(activeSavePreferenceKey(gameId));
}

async function listAvailableSaveNames(
  saveStorage: SaveStorageAdapter | undefined,
  gameId: string,
): Promise<string[]> {
  if (!saveStorage) {
    return [];
  }
  if (typeof saveStorage.listNames === "function") {
    const names = await saveStorage.listNames(gameId);
    return Array.from(new Set(names));
  }
  return [DEFAULT_SAVE_NAME];
}

async function findMostRecentSave(
  saveStorage: SaveStorageAdapter | undefined,
  gameId: string,
  names: string[],
): Promise<SaveStorageRecord | null> {
  if (!saveStorage || names.length === 0) {
    return null;
  }
  let latest: SaveStorageRecord | null = null;
  let latestTimestamp = -Infinity;
  for (const name of names) {
    const record = await saveStorage.read({ gameId, name });
    if (!record) {
      continue;
    }
    const recordTimestamp = record.updatedAt ?? record.createdAt ?? 0;
    if (!latest || recordTimestamp > latestTimestamp) {
      latest = record;
      latestTimestamp = recordTimestamp;
    }
  }
  return latest;
}

export async function resolveSaveKey(params: {
  romInfo: EmulatorRomInfo | null;
  requestedName?: string;
  saveStorage?: SaveStorageAdapter;
}): Promise<SaveStorageKey | null> {
  const { romInfo, requestedName, saveStorage } = params;
  if (!romInfo) {
    return null;
  }

  if (!saveStorage) {
    return createSaveStorageKey(romInfo.title, requestedName);
  }

  const gameId = normalizeSaveGameId(romInfo.title);
  const preferredName = requestedName;

  const toKey = (name: string, record?: SaveStorageRecord | null) =>
    record
      ? { gameId: record.gameId, name: record.name, id: record.id }
      : createSaveStorageKey(romInfo.title, name);

  if (preferredName) {
    const record = await saveStorage.read({ gameId, name: preferredName });
    return toKey(preferredName, record);
  }

  const availableNames = await listAvailableSaveNames(saveStorage, gameId);

  const rememberedName = readActiveSaveName(gameId);
  if (rememberedName && availableNames.includes(rememberedName)) {
    const record = await saveStorage.read({
      gameId,
      name: rememberedName,
    });
    if (record) {
      return toKey(rememberedName, record);
    }
  }

  const latestRecord = await findMostRecentSave(
    saveStorage,
    gameId,
    availableNames,
  );
  if (latestRecord) {
    return toKey(latestRecord.name, latestRecord);
  }

  if (availableNames.length > 0) {
    const fallbackName = availableNames[0];
    const record = await saveStorage.read({
      gameId,
      name: fallbackName,
    });
    return toKey(fallbackName, record);
  }

  clearActiveSaveName(gameId);
  return createSaveStorageKey(romInfo.title, DEFAULT_SAVE_NAME);
}

export async function fetchPreferredSavePayload(params: {
  saveStorage?: SaveStorageAdapter;
  currentSaveKey: SaveStorageKey | null;
  romInfo: EmulatorRomInfo | null;
}): Promise<{ key: SaveStorageKey; payload: SerializedSavePayload } | null> {
  const { saveStorage, currentSaveKey, romInfo } = params;
  if (!saveStorage) {
    return null;
  }

  let saveKey = currentSaveKey;
  if (!saveKey) {
    saveKey = await resolveSaveKey({ romInfo, saveStorage });
  }

  if (!saveKey) {
    return null;
  }

  let record = await saveStorage.read(saveKey);
  if (!record && romInfo) {
    const fallbackKey = await resolveSaveKey({ romInfo, saveStorage });
    if (
      fallbackKey &&
      (fallbackKey.gameId !== saveKey.gameId ||
        fallbackKey.name !== saveKey.name ||
        fallbackKey.id !== saveKey.id)
    ) {
      saveKey = fallbackKey;
      record = await saveStorage.read(saveKey);
    }
  }

  if (!record) {
    return null;
  }

  const resolvedKey: SaveStorageKey = {
    gameId: record.gameId,
    name: record.name,
    id: record.id,
  };

  return { key: resolvedKey, payload: record.payload };
}
