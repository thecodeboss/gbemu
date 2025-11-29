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
    setRomTitle(rom?.name ?? null);
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
    }),
    [
      closeSaveManager,
      ensureSaveStorage,
      isSaveManagerOpen,
      openSaveManager,
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

export function useSaveStorage(): SaveStorageContextValue {
  const context = useContext(SaveStorageContext);
  if (!context) {
    throw new Error("useSaveStorage must be used within a SaveStorageProvider");
  }
  return context;
}
