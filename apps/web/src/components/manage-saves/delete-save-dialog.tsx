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

interface DeleteSaveDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSaveDialog({
  open,
  onCancel,
  onConfirm,
}: DeleteSaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Delete this save?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the save from your browser. Export a copy first if
            you might need it later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="border-foreground bg-destructive text-primary-foreground shadow-[4px_4px_0_var(--color-destructive)] hover:-translate-y-px hover:-translate-x-px hover:shadow-[5px_5px_0_var(--color-destructive)] focus-visible:ring-destructive/60"
            onClick={() => onConfirm()}
          >
            Delete Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
