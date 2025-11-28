import { useCallback, useEffect, useState } from "react";
import { PointerEvent } from "react";

import {
  JoypadButton,
  JoypadInputState,
  createEmptyJoypadState,
} from "@gbemu/core";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VirtualJoypadProps {
  onChange: (state: JoypadInputState) => void;
}

function usePressHandlers(onPressChange: (next: boolean) => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onPressChange(true);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.releasePointerCapture(event.pointerId);
      onPressChange(false);
    },
    onPointerCancel: () => {
      onPressChange(false);
    },
    onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.buttons === 0) {
        onPressChange(false);
      }
    },
  };
}

export function VirtualJoypad({ onChange }: VirtualJoypadProps) {
  const [state, setState] = useState<JoypadInputState>(() =>
    createEmptyJoypadState(),
  );
  const dpadButtonSize = 52;
  const dpadGap = 0;
  const dpadContainer = dpadButtonSize * 3 + dpadGap * 2;

  const setButtonState = useCallback(
    (button: JoypadButton, pressed: boolean) => {
      setState((prev) => {
        if (prev[button] === pressed) {
          return prev;
        }
        return { ...prev, [button]: pressed };
      });
    },
    [],
  );

  useEffect(() => {
    onChange(state);
  }, [onChange, state]);

  useEffect(() => {
    return () => {
      onChange(createEmptyJoypadState());
    };
  }, [onChange]);

  const upHandlers = usePressHandlers((pressed) =>
    setButtonState("up", pressed),
  );
  const downHandlers = usePressHandlers((pressed) =>
    setButtonState("down", pressed),
  );
  const leftHandlers = usePressHandlers((pressed) =>
    setButtonState("left", pressed),
  );
  const rightHandlers = usePressHandlers((pressed) =>
    setButtonState("right", pressed),
  );
  const selectHandlers = usePressHandlers((pressed) =>
    setButtonState("select", pressed),
  );
  const startHandlers = usePressHandlers((pressed) =>
    setButtonState("start", pressed),
  );
  const aHandlers = usePressHandlers((pressed) => setButtonState("a", pressed));
  const bHandlers = usePressHandlers((pressed) => setButtonState("b", pressed));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 sm:hidden">
      <div className="relative mx-auto max-w-5xl px-4 pb-4">
        <div className="pointer-events-auto absolute bottom-24 left-4 right-[58%] flex justify-end">
          <div
            className="grid -translate-y-6"
            style={{
              width: dpadContainer,
              height: dpadContainer,
              gridTemplateColumns: `repeat(3, ${dpadButtonSize}px)`,
              gridTemplateRows: `repeat(3, ${dpadButtonSize}px)`,
              gap: dpadGap,
            }}
          >
            <div />
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              className="min-h-0 min-w-0 border-b-0 p-0 leading-none"
              aria-label="Up"
              {...upHandlers}
              style={{ width: dpadButtonSize, height: dpadButtonSize }}
            >
              <Play
                aria-hidden="true"
                className="size-4 text-accent-foreground"
                style={{ transform: "rotate(-90deg)" }}
              />
              <span className="sr-only">Up</span>
            </Button>
            <div />
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              className="min-h-0 min-w-0 border-r-0 p-0 leading-none"
              aria-label="Left"
              {...leftHandlers}
              style={{ width: dpadButtonSize, height: dpadButtonSize }}
            >
              <Play
                aria-hidden="true"
                className="size-4 text-accent-foreground"
                style={{ transform: "rotate(180deg)" }}
              />
              <span className="sr-only">Left</span>
            </Button>
            <div
              className="bg-accent"
              style={{ width: dpadButtonSize, height: dpadButtonSize }}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              className="min-h-0 min-w-0 border-l-0 p-0 leading-none"
              aria-label="Right"
              {...rightHandlers}
              style={{ width: dpadButtonSize, height: dpadButtonSize }}
            >
              <Play
                aria-hidden="true"
                className="size-4 text-accent-foreground"
                style={{ transform: "rotate(0deg)" }}
              />
              <span className="sr-only">Right</span>
            </Button>
            <div />
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              className="min-h-0 min-w-0 border-t-0 p-0 leading-none"
              aria-label="Down"
              {...downHandlers}
              style={{ width: dpadButtonSize, height: dpadButtonSize }}
            >
              <Play
                aria-hidden="true"
                className="size-4 text-accent-foreground"
                style={{ transform: "rotate(90deg)" }}
              />
              <span className="sr-only">Down</span>
            </Button>
            <div />
          </div>
        </div>

        <div className="pointer-events-auto absolute bottom-24 left-[52%] right-4 flex justify-start">
          <div className="relative h-32 w-32 -translate-y-8 translate-x-4">
            <Button
              type="button"
              variant="default"
              size="icon-lg"
              className="absolute bottom-3 left-2 text-sm"
              aria-label="B"
              {...bHandlers}
            >
              B
            </Button>
            <Button
              type="button"
              variant="default"
              size="icon-lg"
              className={cn("absolute right-2 text-sm", "top-2 translate-x-2")}
              aria-label="A"
              {...aHandlers}
            >
              A
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto flex justify-center gap-3 pb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-16"
            aria-label="Select"
            {...selectHandlers}
          >
            Select
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-16"
            aria-label="Start"
            {...startHandlers}
          >
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}
