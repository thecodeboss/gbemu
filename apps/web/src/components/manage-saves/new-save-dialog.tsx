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

type ConfirmationType = "load" | "start-new";

interface NewSaveDialogProps {
  open: boolean;
  confirmationType: ConfirmationType;
  onCancel: () => void;
  onConfirm: () => void;
}

export function NewSaveDialog({
  open,
  confirmationType,
  onCancel,
  onConfirm,
}: NewSaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
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
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm()}>
            {confirmationType === "start-new" ? "Start New Save" : "Load Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
