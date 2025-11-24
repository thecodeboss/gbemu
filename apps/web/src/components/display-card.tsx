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
          className="mx-auto block aspect-160/144 min-w-[480px] rounded-2xl border-2 border-white/10 bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.6)] [image-rendering:pixelated]"
          width={canvasDimensions.width}
          height={canvasDimensions.height}
        />
      </CardContent>
      <CardFooter className="gap-1">
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
      <CardFooter className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
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
