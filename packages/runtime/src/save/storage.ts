import { SavePayload } from "@gbemu/core";

export interface SerializedSavePayload {
  battery: string;
  rtc?: string;
  timestamp: number;
}

export interface SaveStorageKey {
  gameId: string;
  name: string;
}

export interface SaveStorageAdapter {
  read(key: SaveStorageKey): Promise<SerializedSavePayload | null>;
  write(key: SaveStorageKey, payload: SerializedSavePayload): Promise<void>;
  clear(key: SaveStorageKey): Promise<void>;
  listNames?(gameId: string): Promise<string[]>;
}

export const DEFAULT_SAVE_NAME = "Save 1";

export function normalizeSaveGameId(title: string): string {
  const collapsed = title.trim().toLowerCase();
  const slug = collapsed
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "untitled";
}

export function createSaveStorageKey(
  title: string,
  name?: string,
): SaveStorageKey {
  const resolvedName = name ?? DEFAULT_SAVE_NAME;
  return {
    gameId: normalizeSaveGameId(title),
    name: resolvedName || DEFAULT_SAVE_NAME,
  };
}

export function serializeSavePayload(
  payload: SavePayload,
): SerializedSavePayload {
  return {
    battery: encodeBytes(payload.battery),
    rtc: payload.rtc ? encodeBytes(payload.rtc) : undefined,
    timestamp: Date.now(),
  };
}

export function deserializeSavePayload(
  serialized: SerializedSavePayload,
): SavePayload {
  return {
    battery: decodeBytes(serialized.battery),
    rtc: serialized.rtc ? decodeBytes(serialized.rtc) : undefined,
  };
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function decodeBytes(source: string): Uint8Array {
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
