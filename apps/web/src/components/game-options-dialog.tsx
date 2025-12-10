import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ButtonsRadio } from "@/components/buttons-radio";
import { useGameOptions } from "@/hooks/use-game-options";

const SPEED_OPTIONS = [0.5, 1, 1.2, 1.5, 2, 3, 4, 5] as const;

export function GameOptionsDialog() {
  const {
    isOptionsOpen,
    closeOptions,
    openOptions,
    speedMultiplier,
    setSpeedMultiplier,
  } = useGameOptions();

  return (
    <Dialog
      open={isOptionsOpen}
      onOpenChange={(next) => (next ? openOptions() : closeOptions())}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Game Options</DialogTitle>
          <DialogDescription>
            Adjust emulator settings for the current session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide">
                  Speed Multiplier
                </p>
                <p className="text-xs text-muted-foreground">
                  Increase or slow down gameplay speed.
                </p>
              </div>
              <span className="rounded border border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {speedMultiplier}x
              </span>
            </div>
            <ButtonsRadio
              size="sm"
              value={speedMultiplier}
              onChange={setSpeedMultiplier}
              options={SPEED_OPTIONS.map((value) => ({
                value,
                label: `${value}x`,
              }))}
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
