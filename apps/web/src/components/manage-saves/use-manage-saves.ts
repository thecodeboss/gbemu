import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SAVE_SLOT,
  createSaveStorageKey,
  deserializeSavePayload,
  normalizeSaveGameId,
  resolveSaveSlot,
} from "@gbemu/runtime";

import { useSaveStorage } from "@/hooks/use-save-storage";
import { useEmulator } from "@/hooks/use-emulator";
import { useCurrentRom } from "@/hooks/use-current-rom";

import {
  LoadTarget,
  SaveEntry,
  deriveImportSlotName,
  exportSaveEntry,
  importSaveFile,
  nextUntitledName,
  sortSaves,
  validateSaveName,
} from "./utils";

interface SaveManagerState {
  statusMessage: string | null;
  error: string | null;
  isLoading: boolean;
  isImporting: boolean;
  hasStorage: boolean;
}

interface SaveManagerActions {
  queueLoad: (entry: SaveEntry) => void;
  queueStartNew: () => void;
  importSave: (file?: File) => Promise<void>;
  renameSave: (slot: string, nextName: string) => Promise<boolean>;
  exportSave: (entry: SaveEntry) => Promise<void>;
  requestDelete: (entry: SaveEntry) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  confirmLoad: () => Promise<void>;
  cancelLoad: () => void;
}

interface SaveManagerContext {
  dialogOpen: boolean;
  closeDialog: () => void;
  saves: SaveEntry[];
  loadTarget: LoadTarget;
  deleteTarget: SaveEntry | null;
  confirmationType: "load" | "start-new";
  state: SaveManagerState;
  actions: SaveManagerActions;
}

export function useManageSaves(): SaveManagerContext {
  const { isSaveManagerOpen, closeSaveManager, saveStorage, romTitle } =
    useSaveStorage();
  const { rom } = useCurrentRom();
  const { runtime } = useEmulator();

  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loadTarget, setLoadTarget] = useState<LoadTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaveEntry | null>(null);
  const [lastConfirmationType, setLastConfirmationType] = useState<
    "load" | "start-new"
  >("load");

  const hasStorage = Boolean(saveStorage && romTitle);

  const sortedSaves = useMemo(() => sortSaves(saves), [saves]);

  const refreshSaves = useCallback(async () => {
    if (!saveStorage || !romTitle) {
      setSaves([]);
      setError(
        "Save management needs a loaded ROM with an available IndexedDB adapter.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const gameId = normalizeSaveGameId(romTitle);
      const slots =
        typeof saveStorage.listSlots === "function"
          ? await saveStorage.listSlots(gameId)
          : [];
      const slotSet = new Set(slots.map((slot) => resolveSaveSlot(slot)));

      const defaultPayload = await saveStorage.read(
        createSaveStorageKey(romTitle, DEFAULT_SAVE_SLOT),
      );
      if (defaultPayload) {
        slotSet.add(DEFAULT_SAVE_SLOT);
      }

      const entries: SaveEntry[] = [];
      for (const slot of slotSet) {
        const payload = await saveStorage.read(
          createSaveStorageKey(romTitle, slot),
        );
        if (payload) {
          entries.push({ slot, payload });
        }
      }

      setSaves(entries);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to read saves from IndexedDB.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [romTitle, saveStorage]);

  useEffect(() => {
    if (!isSaveManagerOpen) {
      setLoadTarget(null);
      setDeleteTarget(null);
      return;
    }
    setStatusMessage(null);
    setError(null);
    void refreshSaves();
  }, [isSaveManagerOpen, refreshSaves]);

  useEffect(() => {
    if (loadTarget?.type) {
      setLastConfirmationType(loadTarget.type);
    }
  }, [loadTarget]);

  const renameSave = useCallback(
    async (slot: string, nextName: string) => {
      if (!saveStorage || !romTitle) {
        setError("Cannot rename saves without storage.");
        return false;
      }
      setError(null);
      setStatusMessage(null);
      const trimmed = resolveSaveSlot(nextName || slot);
      const validationError = validateSaveName(trimmed, saves, slot);
      if (validationError) {
        setError(validationError);
        return false;
      }

      if (trimmed === slot) {
        setStatusMessage("Name unchanged.");
        return true;
      }

      const existingPayload = await saveStorage.read(
        createSaveStorageKey(romTitle, slot),
      );
      if (!existingPayload) {
        setError("Save payload could not be loaded for renaming.");
        return false;
      }

      await saveStorage.write(
        createSaveStorageKey(romTitle, trimmed),
        existingPayload,
      );
      await saveStorage.clear(createSaveStorageKey(romTitle, slot));
      setStatusMessage(`Renamed "${slot}" to "${trimmed}".`);
      void refreshSaves();
      return true;
    },
    [refreshSaves, romTitle, saveStorage, saves],
  );

  const deleteSave = useCallback(
    async (slot: string) => {
      if (!saveStorage || !romTitle) {
        setError("Cannot delete saves without storage.");
        return;
      }
      setError(null);
      setStatusMessage(null);
      await saveStorage.clear(createSaveStorageKey(romTitle, slot));
      setStatusMessage(`Deleted “${slot}”.`);
      void refreshSaves();
    },
    [refreshSaves, romTitle, saveStorage],
  );

  const exportSave = useCallback(
    async (entry: SaveEntry) => {
      try {
        const message = await exportSaveEntry(entry, romTitle);
        setStatusMessage(message);
      } catch (err) {
        console.error(err);
        setError("Export failed. Please try again.");
      }
    },
    [romTitle],
  );

  const queueLoad = useCallback((entry: SaveEntry) => {
    setLoadTarget({ type: "load", entry });
  }, []);

  const queueStartNew = useCallback(() => {
    setLoadTarget({
      type: "start-new",
      slot: nextUntitledName(saves),
    });
  }, [saves]);

  const getImportSlotName = useCallback(
    (fileName: string): string => deriveImportSlotName(fileName, saves),
    [saves],
  );

  const importSave = useCallback(
    async (file?: File) => {
      if (!file || !saveStorage || !romTitle) {
        return;
      }

      setIsImporting(true);
      setError(null);
      setStatusMessage(null);
      try {
        const slot = getImportSlotName(file.name);
        const message = await importSaveFile({
          file,
          romTitle,
          saveStorage,
          slot,
        });
        setStatusMessage(message);
        void refreshSaves();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Import failed. Please try another file.",
        );
      } finally {
        setIsImporting(false);
      }
    },
    [getImportSlotName, refreshSaves, romTitle, saveStorage],
  );

  const confirmLoad = useCallback(async () => {
    if (!loadTarget) {
      return;
    }
    try {
      if (!runtime) {
        throw new Error("No runtime is active to load a save.");
      }
      if (loadTarget.type === "load") {
        const payload = deserializeSavePayload(loadTarget.entry.payload);
        await runtime.pause();
        await runtime.reset();
        await runtime.loadSave(payload, {
          slot: loadTarget.entry.slot,
        });
        await runtime.start();
        setStatusMessage(`Loaded save “${loadTarget.entry.slot}”.`);
      } else if (loadTarget.type === "start-new") {
        if (!saveStorage) {
          throw new Error("Save storage is unavailable.");
        }
        if (!rom?.data) {
          throw new Error("No ROM is loaded to start a fresh save.");
        }
        const romInfo = await runtime.getRomInfo();
        const title = romInfo?.title ?? romTitle;
        if (!title) {
          throw new Error("Unable to determine ROM title for save loading.");
        }
        const slot = loadTarget.slot || "default";
        await runtime.pause();
        await runtime.reset({ hard: true });
        await runtime.loadRom(rom.data, {
          skipPersistentLoad: true,
        });
        const serialized = await saveStorage.read(
          createSaveStorageKey(title, slot),
        );
        if (serialized) {
          const payload = deserializeSavePayload(serialized);
          await runtime.loadSave(payload, { slot });
          setStatusMessage(`Loaded autosave for slot “${slot}”.`);
        } else {
          setStatusMessage(`Started new save for slot “${slot}”.`);
        }
        await runtime.start();
      }
      setLoadTarget(null);
      void refreshSaves();
      closeSaveManager();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to apply the requested save action.",
      );
    }
  }, [
    closeSaveManager,
    loadTarget,
    rom,
    refreshSaves,
    romTitle,
    runtime,
    saveStorage,
  ]);

  const cancelLoad = useCallback(() => setLoadTarget(null), []);

  const requestDelete = useCallback((entry: SaveEntry) => {
    setDeleteTarget(entry);
  }, []);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteSave(deleteTarget.slot);
    setDeleteTarget(null);
  }, [deleteSave, deleteTarget]);

  return {
    dialogOpen: isSaveManagerOpen,
    closeDialog: closeSaveManager,
    saves: sortedSaves,
    loadTarget,
    deleteTarget,
    confirmationType: loadTarget?.type ?? lastConfirmationType,
    state: {
      statusMessage,
      error,
      isLoading,
      isImporting,
      hasStorage,
    },
    actions: {
      queueLoad,
      queueStartNew,
      importSave,
      renameSave,
      exportSave,
      requestDelete,
      confirmDelete,
      cancelDelete,
      confirmLoad,
      cancelLoad,
    },
  };
}
