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
            className="border-foreground bg-destructive text-primary-foreground shadow-[4px_4px_0_var(--color-destructive)] hover:-translate-y-px hover:-translate-x-px hover:shadow-[5px_5px_0_var(--color-destructive)] focus-visible:ring-destructive/60"
            onClick={() => void confirmDelete()}
          >
            Delete Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
