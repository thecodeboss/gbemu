import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
import { useGameOptions } from "@/hooks/use-game-options";
import { useSaveStorage } from "@/hooks/use-save-storage";
import { preloadGameOptionsDialog } from "@/components/game-options-dialog.lazy";
import { createEmptyJoypadState } from "@gbemu/core/input";
import { JoypadInputState } from "@gbemu/core/input";
import { useGamepad } from "@/hooks/use-gamepad";
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from "@gbemu/runtime";
import { useLocation } from "preact-iso";

const ManageSavesDialog = lazy(() =>
  import("@/components/manage-saves/manage-saves-dialog").then((module) => ({
    default: module.ManageSavesDialog,
  })),
);

const ReturnToMenuDialog = lazy(() =>
  import("@/components/return-to-menu-dialog").then((module) => ({
    default: module.ReturnToMenuDialog,
  })),
);

const preloadManageSavesDialog = (): void => {
  void import("@/components/manage-saves/manage-saves-dialog");
};

const preloadReturnToMenuDialog = (): void => {
  void import("@/components/return-to-menu-dialog");
};

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
  const { isSaveManagerOpen, openSaveManager } = useSaveStorage();
  const { openOptions } = useGameOptions();
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
  const { route } = useLocation();

  useEffect(() => {
    let cancelled = false;
    const loadDialogs = (): void => {
      if (cancelled) return;
      preloadManageSavesDialog();
      preloadReturnToMenuDialog();
    };

    if ("requestIdleCallback" in window) {
      const idleId = (
        window as Window & {
          requestIdleCallback?: (cb: IdleRequestCallback) => number;
          cancelIdleCallback?: (id: number) => void;
        }
      ).requestIdleCallback?.(() => loadDialogs());
      return () => {
        cancelled = true;
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId as number);
      };
    }

    const timeoutId = (window as Window).setTimeout(loadDialogs, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!rom) route("/");
  }, [route, rom]);
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
        route("/");
      }
    })();
  }, [route, runtime, setCurrentRom]);

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
    <>
      <Card
        className="min-h-dvh sm:min-h-0 sm:px-5 sm:py-6 gap-2 sm:gap-6"
        ref={fullscreenContainerRef}
        noPadding
      >
        <CardHeader className="hidden sm:block">
          <CardTitle>{romName?.replace(/.gbc?/gi, "") ?? "Untitled"}</CardTitle>
        </CardHeader>
        <CardContent className="sm:px-5" noPadding>
          <canvas
            ref={canvasRef}
            className="mx-auto box-content block sm:border-4 border-foreground bg-black [image-rendering:pixelated] aspect-160/144 w-full sm:w-120 lg:w-160 xl:w-3xl"
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
              onMouseEnter={preloadReturnToMenuDialog}
              onFocus={preloadReturnToMenuDialog}
            >
              Menu
            </Button>
          </CardAction>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              onClick={openSaveManager}
              onMouseEnter={preloadManageSavesDialog}
              onFocus={preloadManageSavesDialog}
            >
              Saves
            </Button>
          </CardAction>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              onClick={openOptions}
              onMouseEnter={preloadGameOptionsDialog}
              onFocus={preloadGameOptionsDialog}
            >
              Options
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

      {showReturnConfirm ? (
        <Suspense fallback={null}>
          <ReturnToMenuDialog
            open={showReturnConfirm}
            onOpenChange={(next) => setShowReturnConfirm(next)}
            onConfirm={handleReturnToMenu}
          />
        </Suspense>
      ) : null}

      {isSaveManagerOpen ? (
        <Suspense fallback={null}>
          <ManageSavesDialog />
        </Suspense>
      ) : null}
    </>
  );
}
