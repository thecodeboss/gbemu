import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FolderInput, Plus } from "lucide-react";
import {
  DEFAULT_SAVE_SLOT,
  createSaveStorageKey,
  deserializeSavePayload,
  normalizeSaveGameId,
  resolveSaveSlot,
} from "@gbemu/runtime";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { DeleteSaveDialog } from "./delete-save-dialog";
import { NewSaveDialog } from "./new-save-dialog";
import { SaveList } from "./save-list";
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

import { useSaveStorage } from "@/hooks/use-save-storage";
import { useEmulator } from "@/hooks/use-emulator";
import { useCurrentRom } from "@/hooks/use-current-rom";

export function ManageSavesDialog() {
  const { isSaveManagerOpen, closeSaveManager, saveStorage, romTitle } =
    useSaveStorage();
  const { rom } = useCurrentRom();
  const { runtime } = useEmulator();
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loadTarget, setLoadTarget] = useState<LoadTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaveEntry | null>(null);
  const [lastConfirmationType, setLastConfirmationType] = useState<
    "load" | "start-new"
  >("load");
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasStorage = Boolean(saveStorage && romTitle);

  const sortedSaves = useMemo(() => sortSaves(saves), [saves]);

  const refreshSaves = useCallback(async () => {
    if (!saveStorage || !romTitle) {
      setSaves([]);
      setDraftNames({});
      setError(
        "Save management needs a loaded ROM with an available IndexedDB adapter.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const gameId = normalizeSaveGameId(romTitle);
      console.log("ROM Title:", romTitle, "Game ID:", gameId);
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
      setDraftNames((prev) => {
        const next: Record<string, string> = {};
        for (const entry of entries) {
          next[entry.slot] = prev[entry.slot] ?? entry.slot;
        }
        return next;
      });
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
      return;
    }
    setStatusMessage(null);
    void refreshSaves();
  }, [isSaveManagerOpen, refreshSaves, romTitle]);

  useEffect(() => {
    if (loadTarget?.type) {
      setLastConfirmationType(loadTarget.type);
    }
  }, [loadTarget]);

  useEffect(() => {
    if (editingSlot) {
      inputRefs.current[editingSlot]?.focus();
    }
  }, [editingSlot]);

  const resetFilePicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const validateName = useCallback(
    (name: string, currentSlot?: string) =>
      validateSaveName(name, saves, currentSlot),
    [saves],
  );

  const handleDelete = useCallback(
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

  const handleRename = useCallback(
    async (slot: string) => {
      if (!saveStorage || !romTitle) {
        setError("Cannot rename saves without storage.");
        return;
      }
      setError(null);
      setStatusMessage(null);
      const draft = draftNames[slot] ?? slot;
      const trimmed = resolveSaveSlot(draft);
      const validationError = validateName(trimmed, slot);
      if (validationError) {
        setError(validationError);
        return;
      }

      if (trimmed === slot) {
        setStatusMessage("Name unchanged.");
        setEditingSlot(null);
        return;
      }

      const existingPayload = await saveStorage.read(
        createSaveStorageKey(romTitle, slot),
      );
      if (!existingPayload) {
        setError("Save payload could not be loaded for renaming.");
        return;
      }

      await saveStorage.write(
        createSaveStorageKey(romTitle, trimmed),
        existingPayload,
      );
      await saveStorage.clear(createSaveStorageKey(romTitle, slot));
      setStatusMessage(`Renamed "${slot}" to "${trimmed}".`);
      setEditingSlot(null);
      void refreshSaves();
    },
    [draftNames, refreshSaves, romTitle, saveStorage, validateName],
  );

  const handleExport = useCallback(
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

  const untitledName = useCallback(() => nextUntitledName(saves), [saves]);

  const getImportSlotName = useCallback(
    (fileName: string): string => deriveImportSlotName(fileName, saves),
    [saves],
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.target.files ?? []);
      resetFilePicker();
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
    [getImportSlotName, refreshSaves, resetFilePicker, romTitle, saveStorage],
  );

  const handleLoadConfirm = useCallback(async () => {
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

  return (
    <>
      <Dialog
        open={isSaveManagerOpen}
        onOpenChange={(next) => (!next ? closeSaveManager() : null)}
      >
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Saves</DialogTitle>
            <DialogDescription>
              Load, rename, delete, import, and export saves stored in your
              browser for this ROM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {statusMessage ? (
              <p className="border-[3px] border-(--success-border) bg-(--success) px-3 py-2 text-xs font-semibold uppercase tracking-wide text-(--success-foreground)">
                {statusMessage}
              </p>
            ) : null}
            {error ? (
              <p className="border-[3px] border-destructive bg-destructive/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                {error}
              </p>
            ) : null}
            <SaveList
              hasStorage={hasStorage}
              isLoading={isLoading}
              saves={sortedSaves}
              draftNames={draftNames}
              editingSlot={editingSlot}
              isImporting={isImporting}
              inputRefs={inputRefs}
              onDraftNameChange={(slot, value) =>
                setDraftNames((prev) => ({ ...prev, [slot]: value }))
              }
              onRename={(slot) => void handleRename(slot)}
              onStartEditing={(slot) => setEditingSlot(slot)}
              onCancelEditing={() => setEditingSlot(null)}
              onExport={(entry) => void handleExport(entry)}
              onLoad={(entry) => setLoadTarget({ type: "load", entry })}
              onDelete={(entry) => setDeleteTarget(entry)}
            />
            <div className="pt-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center sm:flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!hasStorage || isImporting}
                >
                  <FolderInput className="mr-2 h-4 w-4" /> Import .sav
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sav"
                  className="hidden"
                  onChange={handleImport}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center sm:flex-1"
                  disabled={!hasStorage || isImporting}
                  onClick={() =>
                    setLoadTarget({
                      type: "start-new",
                      slot: untitledName(),
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> New Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NewSaveDialog
        open={Boolean(loadTarget)}
        confirmationType={loadTarget?.type ?? lastConfirmationType}
        onCancel={() => setLoadTarget(null)}
        onConfirm={() => void handleLoadConfirm()}
      />

      <DeleteSaveDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDelete(deleteTarget.slot);
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
