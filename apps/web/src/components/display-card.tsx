import { RefObject } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DisplayCardProps {
  hidden: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  romName: string | null;
  isDebugVisible: boolean;
  onChangeRom: () => void;
  onToggleDebug: () => void;
  onManageSaves: () => void;
  disableSaveManager?: boolean;
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
  canvasDimensions,
}: DisplayCardProps) {
  return (
    <Card hidden={hidden}>
      <CardHeader>
        <CardTitle>ROM: {romName ?? "Untitled"}</CardTitle>
      </CardHeader>
      <CardContent>
        <canvas
          ref={canvasRef}
          className="mx-auto block aspect-160/144 min-w-[480px] border-[4px] border-foreground bg-black shadow-[8px_8px_0_var(--color-accent)] [image-rendering:pixelated]"
          width={canvasDimensions.width}
          height={canvasDimensions.height}
        />
      </CardContent>
      <CardFooter className="gap-2">
        <CardAction>
          <Button type="button" variant="outline" onClick={onChangeRom}>
            Change ROM
          </Button>
        </CardAction>
        <CardAction>
          <Button type="button" variant="outline" onClick={onToggleDebug}>
            {isDebugVisible ? "Hide Debug Panel" : "Show Debug Panel"}
          </Button>
        </CardAction>
      </CardFooter>
      <CardFooter className="flex items-center justify-between border-t-[3px] border-border pt-4">
        <div className="text-xs text-muted-foreground">
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
