import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { SaveStorageAdapter, createIndexedDbSaveAdapter } from "@gbemu/runtime";

import { useCurrentRom } from "@/hooks/use-current-rom";

interface SaveStorageContextValue {
  saveStorage: SaveStorageAdapter | null;
  ensureSaveStorage: () => SaveStorageAdapter | null;
  isSaveManagerOpen: boolean;
  openSaveManager: () => void;
  closeSaveManager: () => void;
  romTitle: string | null;
  setRomTitle: (title: string | null) => void;
}

const SaveStorageContext = createContext<SaveStorageContextValue | undefined>(
  undefined,
);

export function SaveStorageProvider({ children }: { children: ReactNode }) {
  const { rom } = useCurrentRom();
  const [saveStorage, setSaveStorage] = useState<SaveStorageAdapter | null>(
    null,
  );
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false);
  const [romTitle, setRomTitle] = useState<string | null>(null);

  const ensureSaveStorage = useCallback((): SaveStorageAdapter | null => {
    if (saveStorage) {
      return saveStorage;
    }
    try {
      const adapter = createIndexedDbSaveAdapter();
      setSaveStorage(adapter);
      return adapter;
    } catch (err) {
      console.error(err);
      setSaveStorage(null);
      return null;
    }
  }, [saveStorage]);

  const openSaveManager = useCallback(() => {
    const adapter = ensureSaveStorage();
    setSaveStorage(adapter);
    // Default to the current ROM title if the emulator set it; fall back to filename only when missing.
    setRomTitle((prev) => prev ?? rom?.name ?? null);
    setIsSaveManagerOpen(true);
  }, [ensureSaveStorage, rom?.name]);

  const closeSaveManager = useCallback(() => {
    setIsSaveManagerOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      saveStorage,
      ensureSaveStorage,
      isSaveManagerOpen,
      openSaveManager,
      closeSaveManager,
      romTitle,
      setRomTitle,
    }),
    [
      closeSaveManager,
      ensureSaveStorage,
      isSaveManagerOpen,
      openSaveManager,
      setRomTitle,
      romTitle,
      saveStorage,
    ],
  );

  return (
    <SaveStorageContext.Provider value={value}>
      {children}
    </SaveStorageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSaveStorage(): SaveStorageContextValue {
  const context = useContext(SaveStorageContext);
  if (!context) {
    throw new Error("useSaveStorage must be used within a SaveStorageProvider");
  }
  return context;
}
