import { useCallback, useEffect, useRef, useState } from "react";
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

  const computeControlOffset = useCallback((): string => {
    if (typeof window === "undefined") {
      return "clamp(3rem, 8vh, 5rem)";
    }

    const fallbackViewportHeight =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--app-viewport-height",
        ),
      ) || 0;
    const viewportHeight =
      window.visualViewport?.height ??
      window.innerHeight ??
      fallbackViewportHeight;

    if (viewportHeight >= 900) {
      return "clamp(4.5rem, 14vh, 7.5rem)";
    }
    if (viewportHeight >= 780) {
      return "clamp(3.75rem, 12vh, 6.25rem)";
    }
    return "clamp(3rem, 8vh, 5rem)";
  }, []);

  const [controlOffset, setControlOffset] = useState<string>(() =>
    computeControlOffset(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setControlOffset(computeControlOffset());
    };

    const viewport = window.visualViewport;

    viewport?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      viewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [computeControlOffset]);

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
  const selectHandlers = usePressHandlers((pressed) =>
    setButtonState("select", pressed),
  );
  const startHandlers = usePressHandlers((pressed) =>
    setButtonState("start", pressed),
  );
  const aHandlers = usePressHandlers((pressed) => setButtonState("a", pressed));
  const bHandlers = usePressHandlers((pressed) => setButtonState("b", pressed));

  const setActiveDirection = useCallback((direction: DpadDirection | null) => {
    setState((prev) => {
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 sm:hidden">
      <div
        className="relative mx-auto max-w-5xl px-4 pb-4"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
        }}
      >
        <div
          className="pointer-events-auto absolute left-4 flex justify-end"
          style={{ bottom: controlOffset }}
        >
          <div
            ref={dpadRef}
            className="grid -translate-y-6 touch-none"
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
        </div>

        <div
          className="pointer-events-auto absolute right-8 flex justify-start touch-none"
          style={{ bottom: controlOffset }}
        >
          <div className="relative h-32 w-32 -translate-y-8 translate-x-4">
            <Button
              type="button"
              variant="default"
              size="icon-lg"
              className="absolute bottom-3 left-2 text-sm rounded-full"
              aria-label="B"
              {...bHandlers}
            >
              B
            </Button>
            <Button
              type="button"
              variant="default"
              size="icon-lg"
              className={cn(
                "absolute right-2 text-sm rounded-full",
                "top-2 translate-x-2",
              )}
              aria-label="A"
              {...aHandlers}
            >
              A
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto flex justify-center gap-3 pb-2 touch-none">
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
