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
import { cn } from "@/lib/utils";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { useEmulator } from "@/hooks/use-emulator";
import { useSaveStorage } from "@/hooks/use-save-storage";
import { createEmptyJoypadState, JoypadInputState } from "@gbemu/core";
import { ManageSavesDialog } from "@/components/manage-saves/manage-saves-dialog";
import { ReturnToMenuDialog } from "@/components/return-to-menu-dialog";
import { useGamepad } from "@/hooks/use-gamepad";
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from "@gbemu/runtime";
import { useIsMobileViewport } from "@/hooks/viewport";
import { useNavigate } from "react-router";

const DEFAULT_CANVAS_SCALE = 3;
const MOBILE_RESERVED_VERTICAL_SPACE = 200;
const MOBILE_HORIZONTAL_BUFFER = 16;

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
  const isMobileViewport = useIsMobileViewport();
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
  const computeScaledSize = useCallback((useMobileRules: boolean) => {
    if (useMobileRules && typeof window !== "undefined") {
      const availableWidth = Math.max(
        canvasDimensions.width,
        window.innerWidth - MOBILE_HORIZONTAL_BUFFER,
      );
      const availableHeight = Math.max(
        canvasDimensions.height,
        window.innerHeight - MOBILE_RESERVED_VERTICAL_SPACE,
      );
      const maxScaleByWidth = Math.max(
        1,
        Math.floor(availableWidth / canvasDimensions.width),
      );
      const maxScaleByHeight = Math.max(
        1,
        Math.floor(availableHeight / canvasDimensions.height),
      );
      const nextScale = Math.max(
        1,
        Math.min(maxScaleByWidth, maxScaleByHeight, DEFAULT_CANVAS_SCALE),
      );
      return {
        width: canvasDimensions.width * nextScale,
        height: canvasDimensions.height * nextScale,
      };
    }

    return {
      width: canvasDimensions.width * DEFAULT_CANVAS_SCALE,
      height: canvasDimensions.height * DEFAULT_CANVAS_SCALE,
    };
  }, []);

  const [scaledCanvasSize, setScaledCanvasSize] = useState(() =>
    computeScaledSize(isMobileViewport),
  );
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

  const updateCanvasScale = useCallback((): void => {
    setScaledCanvasSize(computeScaledSize(isMobileViewport));
  }, [computeScaledSize, isMobileViewport]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("resize", updateCanvasScale);
    window.addEventListener("orientationchange", updateCanvasScale);
    return () => {
      window.removeEventListener("resize", updateCanvasScale);
      window.removeEventListener("orientationchange", updateCanvasScale);
    };
  }, [updateCanvasScale]);

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
      updateCanvasScale();
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
  }, [resolveFullscreenTarget, updateCanvasScale]);

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
    enableVirtual: isMobileViewport,
    onChange: (state: JoypadInputState) => {
      if (!runtime) {
        return;
      }
      return runtime.setInputState(state);
    },
  });

  return (
    <div ref={fullscreenContainerRef}>
      <Card
        className={cn(
          "w-full sm:w-auto",
          isMobileViewport
            ? "gap-3! border-none! px-0! py-0! shadow-none!"
            : undefined,
        )}
        style={
          isMobileViewport
            ? {
                minHeight: "var(--app-viewport-height, 100vh)",
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0,
                gap: "0.75rem",
              }
            : undefined
        }
      >
        <CardHeader
          className={cn(isMobileViewport ? "px-4 pb-1" : undefined)}
          style={
            isMobileViewport
              ? {
                  paddingTop: "calc(env(safe-area-inset-top, 0px) + 4px)",
                }
              : undefined
          }
        >
          <CardTitle>{romName?.replace(/.gbc?/gi, "") ?? "Untitled"}</CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "flex justify-center",
            isMobileViewport ? "px-0" : undefined,
          )}
        >
          <canvas
            ref={canvasRef}
            className={cn(
              "mx-auto block border-4 border-foreground bg-black [image-rendering:pixelated]",
              isMobileViewport
                ? "max-w-full shadow-none"
                : "shadow-[8px_8px_0_var(--color-accent)]",
            )}
            style={{
              width: `${scaledCanvasSize.width}px`,
              height: `${scaledCanvasSize.height}px`,
            }}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
          />
        </CardContent>
        <CardFooter
          className={cn(
            "gap-2",
            isMobileViewport ? "flex-wrap justify-center px-4 pb-2" : undefined,
          )}
        >
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
      </Card>

      <ReturnToMenuDialog
        open={showReturnConfirm}
        onOpenChange={(next) => setShowReturnConfirm(next)}
        onConfirm={handleReturnToMenu}
      />

      {virtualGamepad}
      <ManageSavesDialog />
    </div>
  );
}
