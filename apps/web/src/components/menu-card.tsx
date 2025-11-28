import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecentlyPlayedTable } from "@/components/recently-played-table";
import { RecentRomRecord } from "@/lib/recently-played";

interface MenuCardProps {
  hidden: boolean;
  onSelectRom: () => void;
  onSelectRecentRom: (rom: RecentRomRecord) => Promise<void> | void;
  recentlyPlayedRevision: number;
}

export function MenuCard({
  hidden,
  onSelectRom,
  onSelectRecentRom,
  recentlyPlayedRevision,
}: MenuCardProps) {
  return (
    <Card
      hidden={hidden}
      className="w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-5"
    >
      <CardHeader className="px-3 sm:px-4">
        <CardTitle>Game Boy Emulator</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-3 sm:px-4">
        <div className="space-y-3">
          <p>Load a Game Boy or Game Boy Color ROM.</p>
          <Button type="button" variant="default" onClick={onSelectRom}>
            Select ROM
          </Button>
        </div>

        <div className="border-t border-border/60 pt-4">
          <RecentlyPlayedTable
            active={!hidden}
            refreshToken={recentlyPlayedRevision}
            onSelectRom={onSelectRecentRom}
          />
        </div>
      </CardContent>
    </Card>
  );
}
