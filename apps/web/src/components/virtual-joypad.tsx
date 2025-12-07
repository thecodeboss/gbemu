import { useCallback, useEffect, useRef, useState } from "react";
import { PointerEvent } from "react";

import { createEmptyJoypadState } from "@gbemu/core/input";
import { JoypadButton, JoypadInputState } from "@gbemu/core/input";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";

interface VirtualJoypadProps {
  onChange: (state: JoypadInputState) => void;
}

type DpadDirection = "up" | "down" | "left" | "right";

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
  const dpadRef = useRef<HTMLDivElement | null>(null);
  const dpadPointerId = useRef<number | null>(null);
  const dpadButtonSize = 52;
  const dpadGap = 0;
  const dpadContainer = dpadButtonSize * 3 + dpadGap * 2;

  const setButtonState = useCallback(
    (button: JoypadButton, pressed: boolean) => {
      setState((prev: JoypadInputState) => {
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
  const selectHandlers = usePressHandlers((pressed) =>
    setButtonState("select", pressed),
  );
  const startHandlers = usePressHandlers((pressed) =>
    setButtonState("start", pressed),
  );
  const aHandlers = usePressHandlers((pressed) => setButtonState("a", pressed));
  const bHandlers = usePressHandlers((pressed) => setButtonState("b", pressed));

  const setActiveDirection = useCallback((direction: DpadDirection | null) => {
    setState((prev: JoypadInputState) => {
      const nextState = { ...prev };
      const directions: DpadDirection[] = ["up", "down", "left", "right"];
      let changed = false;

      for (const dir of directions) {
        const shouldPress = direction === dir;
        if (prev[dir] !== shouldPress) {
          nextState[dir] = shouldPress;
          changed = true;
        }
      }

      return changed ? nextState : prev;
    });
  }, []);

  const updateDpadFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rect = dpadRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        setActiveDirection(null);
        return;
      }

      const dx = x - rect.width / 2;
      const dy = y - rect.height / 2;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      const nextDirection: DpadDirection =
        absDx > absDy ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";

      setActiveDirection(nextDirection);
    },
    [setActiveDirection],
  );

  const handleDpadPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (dpadPointerId.current !== null) {
        return;
      }

      dpadPointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateDpadFromPointer(event);
    },
    [updateDpadFromPointer],
  );

  const handleDpadPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== dpadPointerId.current) {
        return;
      }
      event.preventDefault();
      updateDpadFromPointer(event);
    },
    [updateDpadFromPointer],
  );

  const releaseDpadPointer = useCallback(() => {
    if (dpadPointerId.current !== null && dpadRef.current) {
      try {
        dpadRef.current.releasePointerCapture(dpadPointerId.current);
      } catch {
        // Ignore if the capture was already released or never applied.
      }
    }
    dpadPointerId.current = null;
    setActiveDirection(null);
  }, [setActiveDirection]);

  const handleDpadPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerId !== dpadPointerId.current) {
        return;
      }
      event.preventDefault();
      releaseDpadPointer();
    },
    [releaseDpadPointer],
  );

  const handleDpadPointerCancel = useCallback(() => {
    releaseDpadPointer();
  }, [releaseDpadPointer]);

  return (
    <div className="flex flex-col h-full grow justify-around">
      <div className="flex flex-col pointer-events-none sm:hidden">
        {/* Top half of joypad */}
        <div className="flex justify-between mx-4 mb-10">
          <div
            ref={dpadRef}
            className="grid touch-none pointer-events-auto"
            onPointerDown={handleDpadPointerDown}
            onPointerMove={handleDpadPointerMove}
            onPointerUp={handleDpadPointerUp}
            onPointerCancel={handleDpadPointerCancel}
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
              className="relative bg-accent"
              style={{ width: dpadButtonSize, height: dpadButtonSize }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute block bg-foreground"
                style={{ width: 3, height: 3, left: 0, top: 0 }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute block bg-foreground"
                style={{ width: 3, height: 3, right: 0, top: 0 }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute block bg-foreground"
                style={{ width: 3, height: 3, left: 0, bottom: 0 }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute block bg-foreground"
                style={{ width: 3, height: 3, right: 0, bottom: 0 }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              className="min-h-0 min-w-0 border-l-0 p-0 leading-none"
              aria-label="Right"
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

          <div className="flex gap-6 pointer-events-auto touch-none mr-10 mt-6">
            <div className="translate-y-6">
              <Button
                type="button"
                variant="default"
                size="icon-lg"
                className="text-sm rounded-full"
                aria-label="B"
                {...bHandlers}
              >
                B
              </Button>
            </div>
            <Button
              type="button"
              variant="default"
              size="icon-lg"
              className="text-sm rounded-full"
              aria-label="A"
              {...aHandlers}
            >
              A
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto flex justify-center gap-3 touch-none">
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
      <div className="" />
    </div>
  );
}
