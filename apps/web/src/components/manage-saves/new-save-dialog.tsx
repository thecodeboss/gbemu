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

import { useManageSavesContext } from "./use-manage-saves";

export function NewSaveDialog() {
  const {
    loadTarget,
    confirmationType,
    actions: { confirmLoad, cancelLoad },
  } = useManageSavesContext();
  const open = Boolean(loadTarget);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && cancelLoad()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            {confirmationType === "start-new"
              ? "Start a new save?"
              : "Load this save?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Loading or starting a save will replace your current in-game
            progress. Export or back up anything you want to keep first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelLoad}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirmLoad()}>
            {confirmationType === "start-new" ? "Start New Save" : "Load Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
