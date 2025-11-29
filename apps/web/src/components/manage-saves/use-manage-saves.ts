import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_SAVE_NAME,
  createSaveStorageKey,
  deserializeSavePayload,
  normalizeSaveGameId,
} from "@gbemu/runtime";

import { useSaveStorage } from "@/hooks/use-save-storage";
import { useEmulator } from "@/hooks/use-emulator";
import { useCurrentRom } from "@/hooks/use-current-rom";

import {
  LoadTarget,
  SaveEntry,
  deriveImportName,
  exportSaveEntry,
  importSaveFile,
  nextSaveName,
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
  renameSave: (name: string, nextName: string) => Promise<boolean>;
  exportSave: (entry: SaveEntry) => Promise<void>;
  requestDelete: (entry: SaveEntry) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  confirmLoad: () => Promise<void>;
  cancelLoad: () => void;
}

export interface SaveManagerContext {
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
      const names =
        typeof saveStorage.listNames === "function"
          ? await saveStorage.listNames(gameId)
          : [DEFAULT_SAVE_NAME];
      const nameSet = new Set(names);

      const entries: SaveEntry[] = [];
      for (const name of nameSet) {
        const payload = await saveStorage.read(
          createSaveStorageKey(romTitle, name),
        );
        if (payload) {
          entries.push({ name, payload });
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
    async (name: string, nextName: string) => {
      if (!saveStorage || !romTitle) {
        setError("Cannot rename saves without storage.");
        return false;
      }
      setError(null);
      setStatusMessage(null);
      const trimmed = (nextName || name).trim();
      const validationError = validateSaveName(trimmed, saves, name);
      if (validationError) {
        setError(validationError);
        return false;
      }

      if (trimmed === name) {
        setStatusMessage("Name unchanged.");
        return true;
      }

      const existingPayload = await saveStorage.read(
        createSaveStorageKey(romTitle, name),
      );
      if (!existingPayload) {
        setError("Save payload could not be loaded for renaming.");
        return false;
      }

      await saveStorage.write(
        createSaveStorageKey(romTitle, trimmed),
        existingPayload,
      );
      await saveStorage.clear(createSaveStorageKey(romTitle, name));
      setStatusMessage(`Renamed “${name}” to “${trimmed}”.`);
      void refreshSaves();
      return true;
    },
    [refreshSaves, romTitle, saveStorage, saves],
  );

  const deleteSave = useCallback(
    async (name: string) => {
      if (!saveStorage || !romTitle) {
        setError("Cannot delete saves without storage.");
        return;
      }
      setError(null);
      setStatusMessage(null);
      await saveStorage.clear(createSaveStorageKey(romTitle, name));
      setStatusMessage(`Deleted “${name}”.`);
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
      name: nextSaveName(saves),
    });
  }, [saves]);

  const getImportName = useCallback(
    (fileName: string): string => deriveImportName(fileName, saves),
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
        const name = getImportName(file.name);
        const message = await importSaveFile({
          file,
          romTitle,
          saveStorage,
          name,
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
    [getImportName, refreshSaves, romTitle, saveStorage],
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
          name: loadTarget.entry.name,
        });
        await runtime.start();
        setStatusMessage(`Loaded save “${loadTarget.entry.name}”.`);
      } else if (loadTarget.type === "start-new") {
        if (!rom?.data) {
          throw new Error("No ROM is loaded to start a fresh save.");
        }
        await runtime.pause();
        await runtime.reset({ hard: true });
        await runtime.loadRom(rom.data, {
          skipPersistentLoad: true,
          saveName: loadTarget.name,
        });
        setStatusMessage(
          "The current running game has not created a save file yet.",
        );
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
  }, [closeSaveManager, loadTarget, rom, refreshSaves, runtime]);

  const cancelLoad = useCallback(() => setLoadTarget(null), []);

  const requestDelete = useCallback((entry: SaveEntry) => {
    setDeleteTarget(entry);
  }, []);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteSave(deleteTarget.name);
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

export const ManageSavesContext = createContext<SaveManagerContext | null>(
  null,
);

export function useManageSavesContext(): SaveManagerContext {
  const context = useContext(ManageSavesContext);
  if (!context) {
    throw new Error(
      "useManageSavesContext must be used within a ManageSavesContext provider.",
    );
  }
  return context;
}
