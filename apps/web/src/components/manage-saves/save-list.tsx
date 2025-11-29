import { useEffect, useRef, useState } from "react";
import { Check, Download, Pencil, Play, Trash2 } from "lucide-react";
import { DEFAULT_SAVE_SLOT } from "@gbemu/runtime";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useManageSavesContext } from "./use-manage-saves";
import { MAX_SAVE_NAME_LENGTH, formatUpdatedAt } from "./utils";

export function SaveList() {
  const {
    saves,
    state: { hasStorage, isLoading, isImporting },
    actions: { renameSave, exportSave, queueLoad, requestDelete },
  } = useManageSavesContext();
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeEditingSlot = useRef<string | null>(null);

  useEffect(() => {
    activeEditingSlot.current = saves.some(
      (entry) => entry.slot === editingSlot,
    )
      ? editingSlot
      : null;
  }, [editingSlot, saves]);

  useEffect(() => {
    if (activeEditingSlot.current) {
      inputRefs.current[activeEditingSlot.current]?.focus();
    }
  }, [editingSlot]);

  const handleRename = async (slot: string) => {
    const draftValue = draftNames[slot] ?? slot;
    const success = await renameSave(slot, draftValue);
    if (success) {
      setEditingSlot(null);
    }
  };

  const startEditing = (slot: string) => {
    setDraftNames((prev) => ({ ...prev, [slot]: prev[slot] ?? slot }));
    setEditingSlot(slot);
  };

  const cancelEditing = () => {
    setEditingSlot(null);
  };

  if (!hasStorage) {
    return (
      <p className="text-sm text-muted-foreground">
        No save system is available right now. Load a ROM first to manage saves.
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading saves…</p>;
  }

  if (!saves.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No saves found yet. Import one or start a new save below.
      </p>
    );
  }

  return (
    <div className="divide-y-[3px] divide-border border-[3px] border-border bg-secondary shadow-[6px_6px_0_var(--color-accent)]">
      {saves.map((entry) => {
        const draftValue = draftNames[entry.slot] ?? entry.slot;
        const isEditing = editingSlot === entry.slot;
        const viewLabel =
          entry.slot === DEFAULT_SAVE_SLOT ? "Autosave" : draftValue;
        const preview = formatUpdatedAt(entry.payload.timestamp);
        return (
          <div key={entry.slot} className="flex flex-col gap-1.5 px-3 py-3">
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
                        cancelEditing();
                      }
                    }}
                    aria-label={`Rename ${entry.slot}`}
                    disabled={isImporting}
                  />
                ) : (
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    {viewLabel}
                  </p>
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
                    onClick={() => startEditing(entry.slot)}
                    disabled={isImporting}
                  >
                    <Pencil />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => exportSave(entry)}
                  disabled={isImporting}
                >
                  <Download />
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => queueLoad(entry)}
                  disabled={isImporting}
                >
                  <Play />
                </Button>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  type="button"
                  onClick={() => requestDelete(entry)}
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
}
