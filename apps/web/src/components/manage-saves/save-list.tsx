import { useEffect, useRef, useState } from "react";
import { Check, Download, Pencil, Play, Trash2 } from "lucide-react";

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
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeEditingName = useRef<string | null>(null);

  useEffect(() => {
    activeEditingName.current = saves.some(
      (entry) => entry.name === editingName,
    )
      ? editingName
      : null;
  }, [editingName, saves]);

  useEffect(() => {
    if (activeEditingName.current) {
      inputRefs.current[activeEditingName.current]?.focus();
    }
  }, [editingName]);

  const handleRename = async (name: string) => {
    const draftValue = draftNames[name] ?? name;
    const success = await renameSave(name, draftValue);
    if (success) {
      setEditingName(null);
    }
  };

  const startEditing = (name: string) => {
    setDraftNames((prev) => ({
      ...prev,
      [name]: prev[name] ?? name,
    }));
    setEditingName(name);
  };

  const cancelEditing = () => {
    setEditingName(null);
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
        const displayName = entry.name;
        const draftValue = draftNames[entry.name] ?? displayName;
        const isEditing = editingName === entry.name;
        const preview = formatUpdatedAt(entry.updatedAt);
        return (
          <div key={entry.id} className="flex flex-col gap-1.5 px-3 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-1.5">
                {isEditing ? (
                  <Input
                    ref={(node) => {
                      inputRefs.current[entry.name] = node;
                    }}
                    value={draftValue}
                    onChange={(event) =>
                      setDraftNames((prev) => ({
                        ...prev,
                        [entry.name]: event.target.value,
                      }))
                    }
                    className="h-8"
                    maxLength={MAX_SAVE_NAME_LENGTH}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleRename(entry.name);
                      }
                      if (event.key === "Escape") {
                        cancelEditing();
                      }
                    }}
                    aria-label={`Rename ${entry.name}`}
                    disabled={isImporting}
                  />
                ) : (
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    {displayName}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isEditing ? (
                  <Button
                    variant="default"
                    size="sm"
                    type="button"
                    onClick={() => void handleRename(entry.name)}
                    disabled={isImporting}
                  >
                    <Check />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => startEditing(entry.name)}
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
                  aria-label={`Delete ${displayName}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Updated {preview}</p>
          </div>
        );
      })}
    </div>
  );
}
