import { MutableRefObject } from "react";
import { Check, Download, Pencil, Play, Trash2 } from "lucide-react";
import { DEFAULT_SAVE_SLOT } from "@gbemu/runtime";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MAX_SAVE_NAME_LENGTH, SaveEntry, formatUpdatedAt } from "./utils";

interface SaveListProps {
  hasStorage: boolean;
  isLoading: boolean;
  saves: SaveEntry[];
  draftNames: Record<string, string>;
  editingSlot: string | null;
  isImporting: boolean;
  inputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onDraftNameChange: (slot: string, value: string) => void;
  onRename: (slot: string) => void;
  onStartEditing: (slot: string) => void;
  onCancelEditing: () => void;
  onExport: (entry: SaveEntry) => void;
  onLoad: (entry: SaveEntry) => void;
  onDelete: (entry: SaveEntry) => void;
}

export function SaveList({
  hasStorage,
  isLoading,
  saves,
  draftNames,
  editingSlot,
  isImporting,
  inputRefs,
  onDraftNameChange,
  onRename,
  onStartEditing,
  onCancelEditing,
  onExport,
  onLoad,
  onDelete,
}: SaveListProps) {
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
                      onDraftNameChange(entry.slot, event.target.value)
                    }
                    className="h-8"
                    maxLength={MAX_SAVE_NAME_LENGTH}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onRename(entry.slot);
                      }
                      if (event.key === "Escape") {
                        onCancelEditing();
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
                    onClick={() => onRename(entry.slot)}
                    disabled={isImporting}
                  >
                    <Check />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => onStartEditing(entry.slot)}
                    disabled={isImporting}
                  >
                    <Pencil />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => onExport(entry)}
                  disabled={isImporting}
                >
                  <Download />
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => onLoad(entry)}
                  disabled={isImporting}
                >
                  <Play />
                </Button>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  type="button"
                  onClick={() => onDelete(entry)}
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
