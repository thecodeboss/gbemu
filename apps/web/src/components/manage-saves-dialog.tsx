import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Download,
  FolderInput,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { SavePayload } from "@gbemu/core";
import {
  DEFAULT_SAVE_SLOT,
  SaveStorageAdapter,
  SerializedSavePayload,
  createSaveStorageKey,
  deserializeSavePayload,
  normalizeSaveGameId,
  resolveSaveSlot,
  serializeSavePayload,
} from "@gbemu/runtime";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SaveEntry {
  slot: string;
  payload: SerializedSavePayload;
}

interface ManageSavesDialogProps {
  open: boolean;
  romTitle: string | null;
  saveStorage: SaveStorageAdapter | null;
  onClose: () => void;
  onLoadSave: (payload: SavePayload, slot: string) => Promise<void>;
  onStartFresh: (slot: string) => Promise<void>;
}

const REQUIRED_BATTERY_SIZE = 32 * 1024;
const MAX_SAVE_NAME_LENGTH = 24;
const NAME_TRUNCATION_SUFFIX = "...";

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
  const [loadTarget, setLoadTarget] = useState<
    | { type: "load"; entry: SaveEntry }
    | { type: "start-new"; slot: string }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<SaveEntry | null>(null);
  const [lastConfirmationType, setLastConfirmationType] = useState<
    "load" | "start-new"
  >("load");
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasStorage = Boolean(saveStorage && romTitle);

  const sortedSaves = useMemo(
    () =>
      [...saves].sort(
        (a, b) =>
          b.payload.timestamp - a.payload.timestamp ||
          a.slot.localeCompare(b.slot),
      ),
    [saves],
  );

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

  const truncateSaveName = useCallback((name: string, suffix = ""): string => {
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
  }, []);

  const resetFilePicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const ensureNameIsUnique = useCallback(
    (name: string, currentSlot?: string): string | null => {
      const trimmed = resolveSaveSlot(name);
      if (trimmed.length > MAX_SAVE_NAME_LENGTH) {
        return `Name cannot exceed ${MAX_SAVE_NAME_LENGTH} characters.`;
      }
      if (!trimmed) {
        return "Name cannot be empty.";
      }
      const exists = saves.some(
        (entry) =>
          entry.slot.toLowerCase() === trimmed.toLowerCase() &&
          entry.slot !== currentSlot,
      );
      if (exists) {
        return "Another save already uses that name.";
      }
      return null;
    },
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
      const validationError = ensureNameIsUnique(trimmed, slot);
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
    [draftNames, ensureNameIsUnique, refreshSaves, romTitle, saveStorage],
  );

  const handleExport = useCallback(
    async (entry: SaveEntry) => {
      try {
        const payload = deserializeSavePayload(entry.payload);
        const batteryCopy = new Uint8Array(payload.battery.length);
        batteryCopy.set(payload.battery);
        const blob = new Blob([batteryCopy.buffer], {
          type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const safeTitle = romTitle ? normalizeSaveGameId(romTitle) : "gbemu";
        anchor.href = url;
        anchor.download = `${safeTitle}-${entry.slot}.sav`;
        anchor.click();
        URL.revokeObjectURL(url);
        setStatusMessage(`Exported ${entry.slot}.`);
      } catch (err) {
        console.error(err);
        setError("Export failed. Please try again.");
      }
    },
    [romTitle],
  );

  const nextUntitledName = useCallback((): string => {
    const usedNames = new Set(
      saves.map((entry) => entry.slot.toLowerCase().trim()),
    );
    let index = 1;
    while (usedNames.has(`untitled ${index}`)) {
      index += 1;
    }
    return `Untitled ${index}`;
  }, [saves]);

  const getImportSlotName = useCallback(
    (fileName: string): string => {
      const baseName = fileName.replace(/\.sav$/i, "").trim();
      const rawBase = resolveSaveSlot(baseName || nextUntitledName());
      const initial = truncateSaveName(rawBase);
      if (!ensureNameIsUnique(initial)) {
        return initial;
      }
      let attempt = 2;
      while (true) {
        const suffix = ` (${attempt})`;
        const candidate = truncateSaveName(rawBase, suffix);
        if (!ensureNameIsUnique(candidate)) {
          return candidate;
        }
        attempt += 1;
      }
    },
    [ensureNameIsUnique, nextUntitledName, truncateSaveName],
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.target.files ?? []);
      resetFilePicker();
      if (!file || !saveStorage || !romTitle) {
        return;
      }
      if (file.size !== REQUIRED_BATTERY_SIZE) {
        setError("Save files must be exactly 32 KiB.");
        return;
      }

      setIsImporting(true);
      setError(null);
      setStatusMessage(null);
      try {
        const buffer = await file.arrayBuffer();
        const battery = new Uint8Array(buffer);
        const payload = serializeSavePayload({ battery });
        const slot = getImportSlotName(file.name);

        await saveStorage.write(createSaveStorageKey(romTitle, slot), payload);
        setStatusMessage(`Imported save as “${slot}”.`);
        void refreshSaves();
      } catch (err) {
        console.error(err);
        setError("Import failed. Please try another file.");
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
      if (loadTarget.type === "load") {
        const payload = deserializeSavePayload(loadTarget.entry.payload);
        await onLoadSave(payload, loadTarget.entry.slot);
        setStatusMessage(`Loaded save “${loadTarget.entry.slot}”.`);
      } else if (loadTarget.type === "start-new") {
        if (!saveStorage || !romTitle) {
          throw new Error("Save storage is unavailable.");
        }
        const battery = new Uint8Array(REQUIRED_BATTERY_SIZE);
        const payload = serializeSavePayload({ battery });
        await saveStorage.write(
          createSaveStorageKey(romTitle, loadTarget.slot),
          payload,
        );
        await onStartFresh(loadTarget.slot);
        setStatusMessage(`Started new save “${loadTarget.slot}”.`);
      }
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

  const renderSaveList = () => {
    if (!hasStorage) {
      return (
        <p className="text-sm text-muted-foreground">
          No save system is available right now. Load a ROM first to manage
          saves.
        </p>
      );
    }
    if (isLoading) {
      return <p className="text-sm text-muted-foreground">Loading saves…</p>;
    }
    if (!sortedSaves.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No saves found yet. Import one or start a new save below.
        </p>
      );
    }

    return (
      <div className="divide-y divide-border rounded-lg border">
        {sortedSaves.map((entry) => {
          const lastUpdated = new Date(entry.payload.timestamp);
          const preview = new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(lastUpdated);
          const draftValue = draftNames[entry.slot] ?? entry.slot;
          const isEditing = editingSlot === entry.slot;
          const viewLabel =
            entry.slot === DEFAULT_SAVE_SLOT ? "Autosave" : draftValue;
          return (
            <div key={entry.slot} className="flex flex-col gap-1.5 p-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <Input
                      ref={(node) => {
                        inputRefs.current[entry.slot] = node;
                      }}
                      value={draftValue}
                      onChange={(event) =>
                        setDraftNames((prev) => ({
                          ...prev,
                          [entry.slot]: event.target.value,
                        }))
                      }
                      className="h-8"
                      maxLength={MAX_SAVE_NAME_LENGTH}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleRename(entry.slot);
                        }
                        if (event.key === "Escape") {
                          setEditingSlot(null);
                        }
                      }}
                      aria-label={`Rename ${entry.slot}`}
                      disabled={isImporting}
                    />
                  ) : (
                    <p className="text-base font-medium">{viewLabel}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <Button
                      variant="default"
                      size="sm"
                      type="button"
                      onClick={() => void handleRename(entry.slot)}
                      disabled={isImporting}
                    >
                      <Check />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setEditingSlot(entry.slot)}
                      disabled={isImporting}
                    >
                      <Pencil />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => void handleExport(entry)}
                    disabled={isImporting}
                  >
                    <Download />
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => setLoadTarget({ type: "load", entry })}
                    disabled={isImporting}
                  >
                    <Play />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    type="button"
                    onClick={() => setDeleteTarget(entry)}
                    disabled={isImporting}
                    aria-label={`Delete ${viewLabel}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Updated {preview} ·{" "}
                {entry.slot === DEFAULT_SAVE_SLOT ? "Autosave" : "Manual save"}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

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
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
                {statusMessage}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {renderSaveList()}
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
                      slot: nextUntitledName(),
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

      <AlertDialog
        open={Boolean(loadTarget)}
        onOpenChange={(next) => !next && setLoadTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {lastConfirmationType === "start-new"
                ? "Start a new save?"
                : "Load this save?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Loading or starting a save will replace your current in-game
              progress. Export or back up anything you want to keep first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLoadTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleLoadConfirm()}>
              {lastConfirmationType === "start-new"
                ? "Start New Save"
                : "Load Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete this save?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the save from your browser. Export a copy first
              if you might need it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/60"
              onClick={() => {
                if (deleteTarget) {
                  void handleDelete(deleteTarget.slot);
                }
                setDeleteTarget(null);
              }}
            >
              Delete Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
