import { useCallback, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecentlyPlayedTable } from "@/components/recently-played-table";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { loadSupabaseAuthClient } from "@/lib/supabase-loader";
import { RecentRomRecord } from "@/lib/recently-played";
import { createRomId } from "@/lib/utils";
import { storeRecentRom } from "@/lib/recently-played";
import { useLocation } from "preact-iso";
import { TargetedInputEvent } from "preact";

export function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setCurrentRom } = useCurrentRom();
  const { session, loading: isAuthLoading } = useAuth();
  const [recentlyPlayedRevision, setRecentlyPlayedRevision] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleFileInputChange = useCallback(
    async (event: TargetedInputEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
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

  const { route } = useLocation();
  const isSignedIn = !!session;

  const handleSelectRecentRom = useCallback(
    async (rom: RecentRomRecord) => {
      const lastPlayed = Date.now();
      route("/emulator");
      setCurrentRom({
        id: rom.id,
        name: rom.name,
        lastPlayed,
        data: rom.data,
      });
      await storeRecentRom({
        id: rom.id,
        name: rom.name,
        data: rom.data,
      });
      setRecentlyPlayedRevision((prev: number) => prev + 1);
    },
    [route, setCurrentRom],
  );

  const handleSignOut = useCallback(() => {
    setIsSigningOut(true);
    void loadSupabaseAuthClient()
      .then((client) => {
        client.signOut();
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setIsSigningOut(false);
      });
  }, []);

  return (
    <Card className="min-h-dvh sm:min-h-0">
      <CardHeader>
        <CardTitle>Game Boy Emulator</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-1 sm:px-5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".gb,.gbc,.bin,application/octet-stream"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="space-y-3">
          <p>Load a Game Boy or Game Boy Color ROM.</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="default"
              onClick={handleOpenFilePicker}
            >
              Select ROM
            </Button>
            {isSignedIn ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                disabled={isSigningOut || isAuthLoading}
              >
                {isAuthLoading
                  ? "Loading..."
                  : isSigningOut
                    ? "Signing out..."
                    : "Sign out"}
              </Button>
            ) : (
              <Button
                asChild={!isAuthLoading}
                variant="secondary"
                disabled={isAuthLoading}
              >
                {isAuthLoading ? (
                  "Loading..."
                ) : (
                  <a href="/login">Sign in</a>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 pt-4">
          <RecentlyPlayedTable
            refreshToken={recentlyPlayedRevision}
            onSelectRom={handleSelectRecentRom}
          />
        </div>
      </CardContent>
    </Card>
  );
}
