import { ChangeEvent, useRef } from "react";
import { FolderInput, Plus } from "lucide-react";

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
import { useManageSaves } from "./use-manage-saves";

export function ManageSavesDialog() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    dialogOpen,
    closeDialog,
    saves,
    loadTarget,
    deleteTarget,
    confirmationType,
    state: { statusMessage, error, isLoading, isImporting, hasStorage },
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
  } = useManageSaves();

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (event.target.value) {
      event.target.value = "";
    }
    void importSave(file);
  };

  return (
    <>
      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => (!next ? closeDialog() : null)}
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
              isImporting={isImporting}
              saves={saves}
              onRename={renameSave}
              onExport={(entry) => void exportSave(entry)}
              onLoad={queueLoad}
              onDelete={requestDelete}
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
                  onClick={queueStartNew}
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
        confirmationType={confirmationType}
        onCancel={cancelLoad}
        onConfirm={() => void confirmLoad()}
      />

      <DeleteSaveDialog
        open={Boolean(deleteTarget)}
        onCancel={cancelDelete}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
