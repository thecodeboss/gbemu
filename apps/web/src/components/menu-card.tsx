import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface MenuCardProps {
  hidden: boolean;
  onSelectRom: () => void;
  mode: "dmg" | "cgb";
  onModeChange: (mode: "dmg" | "cgb") => void;
}

export function MenuCard({
  hidden,
  onSelectRom,
  mode,
  onModeChange,
}: MenuCardProps) {
  return (
    <Card hidden={hidden}>
      <CardHeader>
        <CardTitle>Game Boy Emulator</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p>
          Load a Game Boy or Game Boy Color ROM to boot the placeholder system.
        </p>
        <div className="flex items-center justify-between border-[3px] border-border bg-secondary px-3 py-3 text-xs shadow-[4px_4px_0_var(--color-accent)]">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Mode
            </span>
            <span className="text-muted-foreground">
              Toggle between DMG and CGB before loading a ROM.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              DMG
            </span>
            <Switch
              checked={mode === "cgb"}
              onCheckedChange={(checked) =>
                onModeChange(checked ? "cgb" : "dmg")
              }
              aria-label="Toggle between DMG and CGB modes"
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              CGB
            </span>
          </div>
        </div>
        <Button type="button" variant="default" onClick={onSelectRom}>
          Select ROM
        </Button>
      </CardContent>
    </Card>
  );
}
