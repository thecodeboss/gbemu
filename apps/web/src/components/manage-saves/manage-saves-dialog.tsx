import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FolderInput, Plus } from "lucide-react";
import { SavePayload } from "@gbemu/core";
import {
  DEFAULT_SAVE_SLOT,
  SaveStorageAdapter,
  createSaveStorageKey,
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
  applyLoadTarget,
  deriveImportSlotName,
  exportSaveEntry,
  importSaveFile,
  nextUntitledName,
  sortSaves,
  validateSaveName,
} from "./utils";

interface ManageSavesDialogProps {
  open: boolean;
  romTitle: string | null;
  saveStorage: SaveStorageAdapter | null;
  onClose: () => void;
  onLoadSave: (payload: SavePayload, slot: string) => Promise<void>;
  onStartFresh: (slot: string) => Promise<void>;
}

export function ManageSavesDialog({
  open,
  romTitle,
  saveStorage,
  onClose,
  onLoadSave,
  onStartFresh,
}: ManageSavesDialogProps) {
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
    if (!open) {
      setLoadTarget(null);
      return;
    }
    setStatusMessage(null);
    void refreshSaves();
  }, [open, refreshSaves, romTitle]);

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
      const message = await applyLoadTarget(loadTarget, {
        romTitle,
        saveStorage,
        onLoadSave,
        onStartFresh,
      });
      setStatusMessage(message);
      setLoadTarget(null);
      void refreshSaves();
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to apply the requested save action.",
      );
    }
  }, [
    loadTarget,
    onClose,
    onLoadSave,
    onStartFresh,
    refreshSaves,
    romTitle,
    saveStorage,
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
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
              <p className="border-[3px] border-[var(--success-border)] bg-[var(--success)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--success-foreground)]">
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
