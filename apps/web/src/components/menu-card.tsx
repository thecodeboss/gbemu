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
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex flex-col">
            <span className="font-medium">Mode</span>
            <span className="text-muted-foreground">
              Toggle between DMG and CGB before loading a ROM.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              DMG
            </span>
            <Switch
              checked={mode === "cgb"}
              onCheckedChange={(checked) =>
                onModeChange(checked ? "cgb" : "dmg")
              }
              aria-label="Toggle between DMG and CGB modes"
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
