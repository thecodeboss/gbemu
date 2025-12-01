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

type ReturnToMenuDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ReturnToMenuDialog({
  open,
  onOpenChange,
  onConfirm,
}: ReturnToMenuDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Return to the menu?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The emulator will stop and any current progress will be lost. Saves
            stored in your browser will remain available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Stay Here
          </AlertDialogCancel>
          <AlertDialogAction
            className="border-foreground bg-destructive text-primary-foreground shadow-[4px_4px_0_var(--color-destructive)] hover:-translate-y-px hover:-translate-x-px hover:shadow-[5px_5px_0_var(--color-destructive)] focus-visible:ring-destructive/60"
            onClick={onConfirm}
          >
            Return to Menu
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
