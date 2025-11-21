import { useEffect, useRef } from "react";

import {
  JOYPAD_BUTTONS,
  JoypadButton,
  JoypadInputState,
  createEmptyJoypadState,
} from "@gbemu/core";

type InputSink = (state: JoypadInputState) => Promise<void> | void;

interface GamepadProfile {
  matches(gamepad: Gamepad): boolean;
  buttonMap: Record<number, JoypadButton>;
}

const dualSenseProfile: GamepadProfile = {
  matches(gamepad: Gamepad) {
    const id = gamepad.id.toLowerCase();
    return id.includes("dualsense") || id.includes("wireless controller");
  },
  buttonMap: {
    0: "a",
    2: "b",
    8: "select",
    9: "start",
    12: "up",
    13: "down",
    14: "left",
    15: "right",
  },
};

const profiles: GamepadProfile[] = [dualSenseProfile];

function getProfile(gamepad: Gamepad): GamepadProfile | null {
  return profiles.find((profile) => profile.matches(gamepad)) ?? null;
}

function mergeInputState(
  target: JoypadInputState,
  partial: JoypadInputState,
): JoypadInputState {
  const merged = { ...target };
  for (const button of JOYPAD_BUTTONS) {
    merged[button] = merged[button] || partial[button];
  }
  return merged;
}

function mapGamepadToState(
  gamepad: Gamepad,
  profile: GamepadProfile,
): JoypadInputState {
  const state = createEmptyJoypadState();
  for (const [indexString, button] of Object.entries(profile.buttonMap)) {
    const index = Number(indexString);
    const pressed = Boolean(gamepad.buttons[index]?.pressed);
    if (pressed) {
      state[button] = true;
    }
  }
  return state;
}

function collectInputSnapshot(): JoypadInputState {
  const gamepads = navigator.getGamepads?.() ?? [];
  let snapshot = createEmptyJoypadState();
  for (const gamepad of gamepads) {
    if (!gamepad) {
      continue;
    }
    const profile = getProfile(gamepad);
    if (!profile) {
      continue;
    }
    const inputState = mapGamepadToState(gamepad, profile);
    snapshot = mergeInputState(snapshot, inputState);
  }
  return snapshot;
}

function areStatesEqual(
  left: JoypadInputState,
  right: JoypadInputState,
): boolean {
  return JOYPAD_BUTTONS.every((button) => left[button] === right[button]);
}

export function useGamepad(options: {
  enabled: boolean;
  onInputState: InputSink;
}): void {
  const { enabled, onInputState } = options;
  const callbackRef = useRef<InputSink>(onInputState);
  const frameRef = useRef<number | null>(null);
  const lastStateRef = useRef<JoypadInputState>(createEmptyJoypadState());

  useEffect(() => {
    callbackRef.current = onInputState;
  }, [onInputState]);

  useEffect(() => {
    if (
      !enabled ||
      typeof navigator === "undefined" ||
      typeof navigator.getGamepads !== "function"
    ) {
      return;
    }

    let cancelled = false;

    const tick = (): void => {
      const snapshot = collectInputSnapshot();
      if (!areStatesEqual(lastStateRef.current, snapshot)) {
        lastStateRef.current = snapshot;
        void callbackRef.current(snapshot);
      }

      if (!cancelled) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      const neutral = createEmptyJoypadState();
      if (!areStatesEqual(lastStateRef.current, neutral)) {
        lastStateRef.current = neutral;
        void callbackRef.current(neutral);
      }
    };
  }, [enabled]);
}
