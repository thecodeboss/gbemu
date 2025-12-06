import { useCallback, useEffect, useRef, useState } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { useEmulator } from "@/hooks/use-emulator";
import { useSaveStorage } from "@/hooks/use-save-storage";
import { createEmptyJoypadState, JoypadInputState } from "@gbemu/core";
import { ManageSavesDialog } from "@/components/manage-saves/manage-saves-dialog";
import { ReturnToMenuDialog } from "@/components/return-to-menu-dialog";
import { useGamepad } from "@/hooks/use-gamepad";
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from "@gbemu/runtime";
import { useNavigate } from "react-router";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void> | void;
};

const canvasDimensions = {
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
};

export function EmulatorPage() {
  const { canvasRef, runtime } = useEmulator();
  const { rom, setCurrentRom } = useCurrentRom();
  const romName = rom?.name ?? null;
  const { openSaveManager } = useSaveStorage();
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
  const resolveFullscreenTarget = useCallback((): FullscreenElement | null => {
    if (typeof document === "undefined") {
      return fullscreenContainerRef.current;
    }
    // Use the document root so overlays (like the virtual joypad) stay visible in fullscreen.
    return (
      (document.documentElement as FullscreenElement | null) ??
      fullscreenContainerRef.current
    );
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!rom) navigate("/");
  }, [navigate, rom]);

  const handleReturnToMenu = useCallback(() => {
    if (!runtime) {
      setCurrentRom(null);
      setShowReturnConfirm(false);
      return;
    }
    void (async () => {
      try {
        await runtime.pause();
        await runtime.reset({ hard: true });
        runtime.renderer.clear("#000000");
        await runtime.setInputState(createEmptyJoypadState());
      } catch (err) {
        console.error(err);
      } finally {
        setCurrentRom(null);
        setShowReturnConfirm(false);
        navigate("/");
      }
    })();
  }, [navigate, runtime, setCurrentRom]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const doc = document as FullscreenDocument;
    const detectSupport = (): void => {
      const host = resolveFullscreenTarget();
      if (!host) {
        setIsFullscreenSupported(false);
        return;
      }
      const canRequest =
        typeof host.requestFullscreen === "function" ||
        typeof host.webkitRequestFullscreen === "function" ||
        typeof host.msRequestFullscreen === "function";
      setIsFullscreenSupported(canRequest);
    };

    const handleFullscreenChange = (): void => {
      const activeElement =
        doc.fullscreenElement ??
        doc.webkitFullscreenElement ??
        doc.msFullscreenElement ??
        null;
      const target = resolveFullscreenTarget();
      const container = fullscreenContainerRef.current;
      const isTargetFullscreen =
        activeElement !== null &&
        (activeElement === target ||
          activeElement === container ||
          activeElement === document.documentElement);
      setIsFullscreen(isTargetFullscreen);
    };

    detectSupport();
    handleFullscreenChange();

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [resolveFullscreenTarget]);

  const requestFullscreen = useCallback(async () => {
    const target = resolveFullscreenTarget();
    if (!target) {
      return;
    }
    const request =
      target.requestFullscreen ??
      target.webkitRequestFullscreen ??
      target.msRequestFullscreen;
    if (!request) {
      return;
    }
    try {
      const result = request.call(target);
      if (result instanceof Promise) {
        await result;
      }
    } catch (err) {
      console.error(err);
    }
  }, [resolveFullscreenTarget]);

  const exitFullscreen = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }
    const doc = document as FullscreenDocument;
    const exit =
      doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen;
    if (!exit) {
      return;
    }
    try {
      const result = exit.call(doc);
      if (result instanceof Promise) {
        await result;
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      void exitFullscreen();
    } else {
      void requestFullscreen();
    }
  }, [exitFullscreen, isFullscreen, requestFullscreen]);

  const { virtualGamepad } = useGamepad({
    onChange: (state: JoypadInputState) => {
      if (!runtime) {
        return;
      }
      return runtime.setInputState(state);
    },
  });

  return (
    <div ref={fullscreenContainerRef}>
      <Card className="min-h-dvh sm:min-h-0 px-0 py-0 sm:px-5 sm:py-6 gap-2 sm:gap-6">
        <CardHeader className="hidden sm:block">
          <CardTitle>{romName?.replace(/.gbc?/gi, "") ?? "Untitled"}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <canvas
            ref={canvasRef}
            className="mx-auto block sm:border-4 border-foreground bg-black [image-rendering:pixelated] aspect-square w-full sm:w-120"
            width={canvasDimensions.width}
            height={canvasDimensions.height}
          />
        </CardContent>
        <CardFooter className="gap-2">
          <CardAction>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReturnConfirm(true)}
            >
              Menu
            </Button>
          </CardAction>
          <CardAction>
            <Button type="button" variant="outline" onClick={openSaveManager}>
              Saves
            </Button>
          </CardAction>
          {isFullscreenSupported ? (
            <div className="sm:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </Button>
            </div>
          ) : null}
        </CardFooter>
        {virtualGamepad}
      </Card>

      <ReturnToMenuDialog
        open={showReturnConfirm}
        onOpenChange={(next) => setShowReturnConfirm(next)}
        onConfirm={handleReturnToMenu}
      />

      <ManageSavesDialog />
    </div>
  );
}
