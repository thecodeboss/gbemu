import { RefObject, useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    const updateCanvasScale = (): void => {
      setScaledCanvasSize(computeScaledSize(isMobileViewport));
    };

    updateCanvasScale();

    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("resize", updateCanvasScale);
    window.addEventListener("orientationchange", updateCanvasScale);
    return () => {
      window.removeEventListener("resize", updateCanvasScale);
      window.removeEventListener("orientationchange", updateCanvasScale);
    };
  }, [computeScaledSize, isMobileViewport]);

  return (
    <Card
      hidden={hidden}
      className={cn(
        "w-full sm:w-auto",
        isMobileViewport
          ? "min-h-[100svh] gap-4 border-none px-0 py-0 shadow-none"
          : undefined,
      )}
    >
      <CardHeader className={cn(isMobileViewport ? "px-4 pt-4" : undefined)}>
        <CardTitle>ROM: {romName ?? "Untitled"}</CardTitle>
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
            "mx-auto block border-[4px] border-foreground bg-black [image-rendering:pixelated]",
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
            Change ROM
          </Button>
        </CardAction>
        <CardAction className="hidden sm:block">
          <Button type="button" variant="outline" onClick={onToggleDebug}>
            {isDebugVisible ? "Hide Debug Panel" : "Show Debug Panel"}
          </Button>
        </CardAction>
      </CardFooter>
      <CardFooter
        className={cn(
          "flex items-center justify-between border-t-[3px] border-border pt-4",
          isMobileViewport ? "flex-col gap-3 px-4" : undefined,
        )}
      >
        <div className="text-xs text-muted-foreground text-center sm:text-left">
          Manage browser saves for this ROM.
        </div>
        <Button
          type="button"
          variant="default"
          onClick={onManageSaves}
          disabled={disableSaveManager}
        >
          Manage Saves
        </Button>
      </CardFooter>
    </Card>
  );
}
