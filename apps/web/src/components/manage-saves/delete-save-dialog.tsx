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

import { useAuth } from "@/hooks/use-auth";
import { useManageSavesContext } from "./use-manage-saves";

export function DeleteSaveDialog() {
  const { user } = useAuth();
  const {
    deleteTarget,
    actions: { confirmDelete, cancelDelete },
  } = useManageSavesContext();
  const open = Boolean(deleteTarget);
  const description = user
    ? "This will remove the save from your browser and your account, so it disappears from all devices. Export a copy first if you might need it later."
    : "This will remove the save from your browser. Export a copy first if you might need it later.";

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && cancelDelete()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Delete this save?
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void confirmDelete()}
          >
            Delete Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
