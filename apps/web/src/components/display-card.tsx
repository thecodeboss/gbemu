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
  isBreakMode: boolean;
  isStepping: boolean;
  romName: string | null;
  isDebugVisible: boolean;
  onBreak: () => void;
  onResume: () => void;
  onStep: () => void;
  onChangeRom: () => void;
  onToggleDebug: () => void;
  canvasDimensions: { width: number; height: number };
}

export function DisplayCard({
  hidden,
  canvasRef,
  isBreakMode,
  isStepping,
  romName,
  isDebugVisible,
  onBreak,
  onResume,
  onStep,
  onChangeRom,
  onToggleDebug,
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
          {isBreakMode ? (
            <Button
              type="button"
              variant="outline"
              onClick={onStep}
              disabled={isStepping}
            >
              {isStepping ? "Stepping..." : "Step"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onBreak}
              disabled={isStepping}
            >
              Break
            </Button>
          )}
        </CardAction>
        {isBreakMode ? (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              onClick={onResume}
              disabled={isStepping}
            >
              Resume
            </Button>
          </CardAction>
        ) : null}
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
    </Card>
  );
}
