import { SavePayload } from "@gbemu/core/emulator";
import {
  SaveStorageAdapter,
  SerializedSavePayload,
  createSaveStorageKey,
  deserializeSavePayload,
  serializeSavePayload,
} from "@gbemu/runtime";

export interface SaveEntry {
  id: string;
  name: string;
  payload: SerializedSavePayload;
  updatedAt: number;
}

export type LoadTarget =
  | { type: "load"; entry: SaveEntry }
  | { type: "start-new"; name: string }
  | null;

export const REQUIRED_BATTERY_SIZE = 32 * 1024;
export const VBA_RTC_TRAILER_SIZE = 48;
export const MAX_SAVE_NAME_LENGTH = 24;
export const NAME_TRUNCATION_SUFFIX = "...";

export function sortSaves(saves: SaveEntry[]): SaveEntry[] {
  return [...saves].sort(
    (a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name),
  );
}

export function truncateSaveName(name: string, suffix = ""): string {
  const availableLength = MAX_SAVE_NAME_LENGTH - suffix.length;
  if (availableLength <= 0) {
    return suffix.slice(0, MAX_SAVE_NAME_LENGTH);
  }
  if (name.length <= availableLength) {
    return `${name}${suffix}`;
  }
  if (availableLength <= NAME_TRUNCATION_SUFFIX.length) {
    return `${name.slice(0, availableLength)}${suffix}`;
  }
  return `${name.slice(0, availableLength - NAME_TRUNCATION_SUFFIX.length)}${NAME_TRUNCATION_SUFFIX}${suffix}`;
}

export function validateSaveName(
  name: string,
  saves: SaveEntry[],
  currentName?: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Name cannot be empty.";
  }
  if (trimmed.length > MAX_SAVE_NAME_LENGTH) {
    return `Name cannot exceed ${MAX_SAVE_NAME_LENGTH} characters.`;
  }
  const targetId = trimmed.toLowerCase();
  const currentId = currentName ? currentName.toLowerCase() : null;
  const exists = saves.some((entry) => {
    const entryId = entry.name.toLowerCase();
    if (currentId && entryId === currentId) {
      return false;
    }
    return entryId === targetId;
  });
  if (exists) {
    return "Another save already uses that name.";
  }
  return null;
}

export function nextSaveName(saves: SaveEntry[]): string {
  const usedNames = new Set(saves.map((entry) => entry.name.toLowerCase()));
  let index = 1;
  while (usedNames.has(`save ${index}`)) {
    index += 1;
  }
  return `Save ${index}`;
}

export function deriveImportName(fileName: string, saves: SaveEntry[]): string {
  const baseName = fileName.replace(/\.sav$/i, "").trim();
  const rawBase = baseName || nextSaveName(saves);
  const initial = truncateSaveName(rawBase);
  if (!validateSaveName(initial, saves)) {
    return initial;
  }
  let attempt = 2;
  while (true) {
    const suffix = ` (${attempt})`;
    const candidate = truncateSaveName(rawBase, suffix);
    if (!validateSaveName(candidate, saves)) {
      return candidate;
    }
    attempt += 1;
  }
}

export function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export async function exportSaveEntry(entry: SaveEntry): Promise<string> {
  const payload = deserializeSavePayload(entry.payload);
  const batteryCopy = payload.battery.slice();
  const rtcCopy = payload.rtc ? payload.rtc.slice() : null;
  const blobParts: ArrayBuffer[] = [batteryCopy.buffer];
  if (rtcCopy) {
    blobParts.push(rtcCopy.buffer);
  }
  const blob = new Blob(blobParts, {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const saveName = entry.name;
  anchor.href = url;
  anchor.download = `${saveName}.sav`;
  anchor.click();
  URL.revokeObjectURL(url);
  return `Exported ${saveName}.`;
}

export async function importSaveFile(options: {
  file: File;
  romTitle: string;
  saveStorage: SaveStorageAdapter;
  name: string;
}): Promise<string> {
  const { file, romTitle, saveStorage, name } = options;
  const allowedSizes = [
    REQUIRED_BATTERY_SIZE,
    REQUIRED_BATTERY_SIZE + VBA_RTC_TRAILER_SIZE,
  ];
  if (!allowedSizes.includes(file.size)) {
    throw new Error(
      "Save files must be 32 KiB or 32 KiB + 48 bytes for RTC data.",
    );
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hasRtc = file.size === REQUIRED_BATTERY_SIZE + VBA_RTC_TRAILER_SIZE;
  const battery = bytes.subarray(0, REQUIRED_BATTERY_SIZE).slice();
  const rtc = hasRtc
    ? bytes.subarray(REQUIRED_BATTERY_SIZE).slice()
    : undefined;
  const payload = serializeSavePayload({ battery, rtc });
  await saveStorage.write(createSaveStorageKey(romTitle, name), payload);
  return `Imported save as “${name}”.`;
}

export async function applyLoadTarget(
  loadTarget: Exclude<LoadTarget, null>,
  options: {
    romTitle: string | null;
    saveStorage: SaveStorageAdapter | null;
    onLoadSave: (payload: SavePayload, name: string) => Promise<void>;
    onStartFresh: (name: string) => Promise<void>;
  },
): Promise<string> {
  if (loadTarget.type === "load") {
    const payload = deserializeSavePayload(loadTarget.entry.payload);
    await options.onLoadSave(payload, loadTarget.entry.name);
    return `Loaded save “${loadTarget.entry.name}”.`;
  }

  await options.onStartFresh(loadTarget.name);
  return "The current running game has not created a save file yet.";
}
