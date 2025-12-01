import { SavePayload } from "@gbemu/core";

export type SerializedSavePayload = Uint8Array;

export interface SaveStorageKey {
  gameId: string;
  name: string;
  id?: string;
}

export interface SaveStorageRecord {
  id: string;
  gameId: string;
  name: string;
  payload: SerializedSavePayload;
  createdAt: number;
  updatedAt: number;
}

export interface SaveStorageAdapter {
  read(key: SaveStorageKey): Promise<SaveStorageRecord | null>;
  write(
    key: SaveStorageKey,
    payload: SerializedSavePayload,
  ): Promise<SaveStorageRecord>;
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
  id?: string,
): SaveStorageKey {
  const resolvedName = name ?? DEFAULT_SAVE_NAME;
  return {
    gameId: normalizeSaveGameId(title),
    name: resolvedName || DEFAULT_SAVE_NAME,
    id,
  };
}

export function serializeSavePayload(
  payload: SavePayload,
): SerializedSavePayload {
  const batteryLength = payload.battery.byteLength;
  const rtcLength = payload.rtc?.byteLength ?? 0;
  const headerSize = 8;
  const buffer = new Uint8Array(headerSize + batteryLength + rtcLength);
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );

  view.setUint32(0, batteryLength, true);
  view.setUint32(4, rtcLength, true);

  buffer.set(payload.battery, headerSize);
  if (payload.rtc) {
    buffer.set(payload.rtc, headerSize + batteryLength);
  }

  return buffer;
}

export function deserializeSavePayload(
  serialized: SerializedSavePayload,
): SavePayload {
  if (serialized.byteLength < 8) {
    throw new Error("Serialized save payload is too small to decode.");
  }

  const view = new DataView(
    serialized.buffer,
    serialized.byteOffset,
    serialized.byteLength,
  );

  const batteryLength = view.getUint32(0, true);
  const rtcLength = view.getUint32(4, true);

  const payloadStart = 8;
  const payloadEnd = payloadStart + batteryLength + rtcLength;
  if (payloadEnd > serialized.byteLength) {
    throw new Error("Serialized save payload is truncated.");
  }

  const battery = serialized.slice(payloadStart, payloadStart + batteryLength);
  const rtc =
    rtcLength > 0
      ? serialized.slice(payloadStart + batteryLength, payloadEnd)
      : undefined;

  return { battery, rtc };
}
