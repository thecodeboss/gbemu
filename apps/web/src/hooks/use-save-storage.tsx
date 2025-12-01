import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SaveStorageAdapter, createIndexedDbSaveAdapter } from "@gbemu/runtime";

import {
  SupabaseSyncedSaveStorage,
  SaveSyncState,
  createSupabaseSaveAdapter,
} from "@/lib/save-sync";
import { supabase } from "@/lib/supabase/client";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { useAuth } from "@/hooks/use-auth";

interface SaveStorageContextValue {
  saveStorage: SaveStorageAdapter | null;
  ensureSaveStorage: () => SaveStorageAdapter | null;
  refreshRemoteSaves: () => Promise<void>;
  isSaveManagerOpen: boolean;
  openSaveManager: () => void;
  closeSaveManager: () => void;
  romTitle: string | null;
  setRomTitle: (title: string | null) => void;
  syncStateById: Record<string, SaveSyncState>;
}

const SaveStorageContext = createContext<SaveStorageContextValue | undefined>(
  undefined,
);

export function SaveStorageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { rom } = useCurrentRom();
  const adapterRef = useRef<SupabaseSyncedSaveStorage | null>(null);
  const [syncStateById, setSyncStateById] = useState<
    Record<string, SaveSyncState>
  >({});
  const [saveStorage, setSaveStorage] = useState<SaveStorageAdapter | null>(
    () => {
      try {
        const baseAdapter = createIndexedDbSaveAdapter();
        return createSupabaseSaveAdapter({
          baseAdapter,
          onStatusChange: setSyncStateById,
        });
      } catch (err) {
        console.error(err);
        return null;
      }
    },
  );
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false);
  const [romTitle, setRomTitle] = useState<string | null>(null);

  const ensureSaveStorage = useCallback((): SaveStorageAdapter | null => {
    if (adapterRef.current) {
      return adapterRef.current;
    }
    if (saveStorage) {
      adapterRef.current = saveStorage as SupabaseSyncedSaveStorage;
      return saveStorage;
    }
    try {
      const baseAdapter = createIndexedDbSaveAdapter();
      const adapter = createSupabaseSaveAdapter({
        baseAdapter,
        onStatusChange: setSyncStateById,
      });
      adapterRef.current = adapter;
      setSaveStorage(adapter);
      return adapter;
    } catch (err) {
      console.error(err);
      setSaveStorage(null);
      return null;
    }
  }, [saveStorage, setSyncStateById]);

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

  const refreshRemoteSaves = useCallback(async () => {
    const adapter = ensureSaveStorage() as SupabaseSyncedSaveStorage | null;
    if (!adapter) {
      return;
    }
    await adapter.syncFromSupabase();
    await adapter.flushQueue();
    setSyncStateById(adapter.getSyncStateMap());
  }, [ensureSaveStorage]);

  useEffect(() => {
    adapterRef.current = saveStorage as SupabaseSyncedSaveStorage | null;
  }, [saveStorage]);

  useEffect(() => {
    const adapter = adapterRef.current as SupabaseSyncedSaveStorage | null;
    if (!adapter) {
      return;
    }
    void adapter.setRemote(user ? supabase : null, user ? user.id : null);
  }, [user]);

  const value = useMemo(
    () => ({
      saveStorage,
      ensureSaveStorage,
      refreshRemoteSaves,
      isSaveManagerOpen,
      openSaveManager,
      closeSaveManager,
      romTitle,
      setRomTitle,
      syncStateById,
    }),
    [
      closeSaveManager,
      ensureSaveStorage,
      isSaveManagerOpen,
      openSaveManager,
      setRomTitle,
      romTitle,
      saveStorage,
      refreshRemoteSaves,
      syncStateById,
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
