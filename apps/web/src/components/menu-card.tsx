import { ChangeEvent, useCallback, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecentlyPlayedTable } from "@/components/recently-played-table";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { RecentRomRecord } from "@/lib/recently-played";
import { createRomId } from "@/lib/utils";
import { storeRecentRom } from "@/lib/recently-played";

interface MenuCardProps {
  hidden: boolean;
}

export function MenuCard({
  hidden,
}: MenuCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setCurrentRom } = useCurrentRom();
  const [recentlyPlayedRevision, setRecentlyPlayedRevision] = useState(0);

  const handleFileInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const [file] = Array.from(input.files ?? []);
      input.value = "";
      if (!file) {
        return;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        setCurrentRom({
          id: createRomId(file.name),
          name: file.name,
          lastPlayed: Date.now(),
          data,
        });
        await storeRecentRom({
          name: file.name,
          data,
          id: createRomId(file.name),
        });
        setRecentlyPlayedRevision((prev: number) => prev + 1);
      } catch (err) {
        console.error(err);
      }
    },
    [setCurrentRom],
  );

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSelectRecentRom = useCallback(
    async (rom: RecentRomRecord) => {
      setCurrentRom({
        id: rom.id,
        name: rom.name,
        lastPlayed: rom.lastPlayed,
        data: rom.data,
      });
      setRecentlyPlayedRevision((prev: number) => prev + 1);
    },
    [setCurrentRom],
  );

  return (
    <Card
      hidden={hidden}
      className="w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-5"
    >
      <CardHeader className="px-3 sm:px-4">
        <CardTitle>Game Boy Emulator</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-3 sm:px-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".gb,.gbc,.bin,application/octet-stream"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="space-y-3">
          <p>Load a Game Boy or Game Boy Color ROM.</p>
          <Button type="button" variant="default" onClick={handleOpenFilePicker}>
            Select ROM
          </Button>
        </div>

        <div className="border-t border-border/60 pt-4">
          <RecentlyPlayedTable
            active={!hidden}
            refreshToken={recentlyPlayedRevision}
            onSelectRom={handleSelectRecentRom}
          />
        </div>
      </CardContent>
    </Card>
  );
}
