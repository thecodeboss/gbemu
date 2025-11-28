import { RefObject, useCallback, useEffect, useRef, useState } from "react";

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

interface DisplayCardProps {
  hidden: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  romName: string | null;
  isDebugVisible: boolean;
  onChangeRom: () => void;
  onToggleDebug: () => void;
  onManageSaves: () => void;
  disableSaveManager?: boolean;
  isMobileViewport: boolean;
  canvasDimensions: { width: number; height: number };
}

export function DisplayCard({
  hidden,
  canvasRef,
  romName,
  isDebugVisible,
  onChangeRom,
  onToggleDebug,
  onManageSaves,
  disableSaveManager,
  isMobileViewport,
  canvasDimensions,
}: DisplayCardProps) {
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
  const computeScaledSize = useCallback(
    (useMobileRules: boolean) => {
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
    },
    [canvasDimensions.height, canvasDimensions.width],
  );

  const [scaledCanvasSize, setScaledCanvasSize] = useState(() =>
    computeScaledSize(isMobileViewport),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);

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

  return (
    <div ref={fullscreenContainerRef} hidden={hidden}>
      <Card
        hidden={hidden}
        className={cn(
          "w-full sm:w-auto",
          isMobileViewport
            ? "min-h-svh gap-4 border-none px-0 py-0 shadow-none"
            : undefined,
        )}
      >
        <CardHeader className={cn(isMobileViewport ? "px-4 pt-4" : undefined)}>
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
            isMobileViewport ? "flex-wrap justify-center px-4" : undefined,
          )}
        >
          <CardAction>
            <Button type="button" variant="outline" onClick={onChangeRom}>
              ROM
            </Button>
          </CardAction>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              onClick={onManageSaves}
              disabled={disableSaveManager}
            >
              Saves
            </Button>
          </CardAction>
          <CardAction className="hidden sm:block">
            <Button type="button" variant="outline" onClick={onToggleDebug}>
              {isDebugVisible ? "Hide Debug Panel" : "Show Debug Panel"}
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
    </div>
  );
}
