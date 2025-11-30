import { EmulatorRomInfo } from "@gbemu/core";

import {
  DEFAULT_SAVE_NAME,
  SaveStorageAdapter,
  SaveStorageKey,
  SerializedSavePayload,
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

async function findMostRecentSaveName(
  saveStorage: SaveStorageAdapter | undefined,
  gameId: string,
  names: string[],
): Promise<string | null> {
  if (!saveStorage || names.length === 0) {
    return null;
  }
  let latest: { name: string; timestamp: number } | null = null;
  for (const name of names) {
    const payload = await saveStorage.read({ gameId, name });
    if (!payload) {
      continue;
    }
    if (!latest || payload.timestamp > latest.timestamp) {
      latest = { name, timestamp: payload.timestamp };
    }
  }
  return latest?.name ?? null;
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

  if (preferredName) {
    return createSaveStorageKey(romInfo.title, preferredName);
  }

  const availableNames = await listAvailableSaveNames(saveStorage, gameId);

  const rememberedName = readActiveSaveName(gameId);
  if (rememberedName && availableNames.includes(rememberedName)) {
    const payload = await saveStorage.read({
      gameId,
      name: rememberedName,
    });
    if (payload) {
      return createSaveStorageKey(romInfo.title, rememberedName);
    }
  }

  const latestName = await findMostRecentSaveName(
    saveStorage,
    gameId,
    availableNames,
  );
  if (latestName) {
    return createSaveStorageKey(romInfo.title, latestName);
  }

  if (availableNames.length > 0) {
    return createSaveStorageKey(romInfo.title, availableNames[0]);
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

  let payload = await saveStorage.read(saveKey);
  if (!payload && romInfo) {
    const fallbackKey = await resolveSaveKey({ romInfo, saveStorage });
    if (
      fallbackKey &&
      (fallbackKey.gameId !== saveKey.gameId ||
        fallbackKey.name !== saveKey.name)
    ) {
      saveKey = fallbackKey;
      payload = await saveStorage.read(saveKey);
    }
  }

  if (!payload) {
    return null;
  }

  return { key: saveKey, payload };
}
