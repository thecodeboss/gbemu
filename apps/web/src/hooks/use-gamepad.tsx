import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";

import { JOYPAD_BUTTONS, createEmptyJoypadState } from "@gbemu/core/input";
import { JoypadButton, JoypadInputState } from "@gbemu/core/input";
import { VirtualJoypad } from "@/components/virtual-joypad";

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

const dualShockProfile: GamepadProfile = {
  matches(gamepad: Gamepad) {
    const id = gamepad.id.toLowerCase();
    return id.includes("dualshock") || id.includes("ps4");
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

const xboxProfile: GamepadProfile = {
  matches(gamepad: Gamepad) {
    const id = gamepad.id.toLowerCase();
    return id.includes("xbox") || id.includes("xinput");
  },
  buttonMap: {
    0: "a",
    1: "b",
    8: "select",
    9: "start",
    12: "up",
    13: "down",
    14: "left",
    15: "right",
  },
};

const switchProProfile: GamepadProfile = {
  matches(gamepad: Gamepad) {
    const id = gamepad.id.toLowerCase();
    return id.includes("pro controller") || id.includes("switch");
  },
  buttonMap: {
    1: "a",
    0: "b",
    8: "select",
    9: "start",
    12: "up",
    13: "down",
    14: "left",
    15: "right",
  },
};

const genericXinputProfile: GamepadProfile = {
  matches(gamepad: Gamepad) {
    const id = gamepad.id.toLowerCase();
    return id.includes("generic") || id.includes("gamepad");
  },
  buttonMap: {
    0: "a",
    1: "b",
    8: "select",
    9: "start",
    12: "up",
    13: "down",
    14: "left",
    15: "right",
  },
};

const profiles: GamepadProfile[] = [
  dualSenseProfile,
  dualShockProfile,
  xboxProfile,
  switchProProfile,
  genericXinputProfile,
];

function getProfile(gamepad: Gamepad): GamepadProfile | null {
  return profiles.find((profile) => profile.matches(gamepad)) ?? null;
}

function mapKeyboardKeyToButton(key: string): JoypadButton | null {
  switch (key) {
    case "a":
      return "b";
    case "s":
      return "a";
    case "backspace":
      return "select";
    case "enter":
      return "start";
    case "arrowup":
      return "up";
    case "arrowdown":
      return "down";
    case "arrowleft":
      return "left";
    case "arrowright":
      return "right";
    default:
      return null;
  }
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
  return JOYPAD_BUTTONS.every(
    (button: JoypadButton) => left[button] === right[button],
  );
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

type UseGamepadOptions = {
  onChange: InputSink;
};

export function useGamepad({ onChange }: UseGamepadOptions): {
  virtualGamepad: ReactNode;
  getCurrentState: () => JoypadInputState;
} {
  const onChangeRef = useRef<InputSink>(onChange);
  const frameRef = useRef<number | null>(null);
  const keyboardStateRef = useRef<JoypadInputState>(createEmptyJoypadState());
  const hardwareStateRef = useRef<JoypadInputState>(createEmptyJoypadState());
  const virtualStateRef = useRef<JoypadInputState>(createEmptyJoypadState());
  const mergedStateRef = useRef<JoypadInputState>(createEmptyJoypadState());

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const mergeInputStates = useCallback(
    (hardware: JoypadInputState, virtual: JoypadInputState) =>
      mergeInputState(hardware, virtual),
    [],
  );

  const applyInputState = useCallback(
    (partial: { hardware?: JoypadInputState; virtual?: JoypadInputState }) => {
      if (partial.hardware) {
        hardwareStateRef.current = partial.hardware;
      }
      if (partial.virtual) {
        virtualStateRef.current = partial.virtual;
      }
      const merged = mergeInputStates(
        hardwareStateRef.current,
        virtualStateRef.current,
      );
      if (areStatesEqual(mergedStateRef.current, merged)) {
        return;
      }
      mergedStateRef.current = merged;
      void onChangeRef.current(merged);
    },
    [mergeInputStates],
  );

  const handleVirtualInputStateChange = useCallback(
    (state: JoypadInputState) => {
      applyInputState({ virtual: state });
    },
    [applyInputState],
  );

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.getGamepads !== "function"
    ) {
      return;
    }

    let cancelled = false;

    const tick = (): void => {
      const snapshot = mergeInputState(
        collectInputSnapshot(),
        keyboardStateRef.current,
      );
      if (!areStatesEqual(hardwareStateRef.current, snapshot)) {
        applyInputState({ hardware: snapshot });
      }

      if (!cancelled) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);

    const handleKeyEvent = (event: KeyboardEvent, pressed: boolean): void => {
      const key = event.key.toLowerCase();
      const mapped = mapKeyboardKeyToButton(key);
      if (!mapped) {
        return;
      }
      if (keyboardStateRef.current[mapped] === pressed) {
        return;
      }
      keyboardStateRef.current = {
        ...keyboardStateRef.current,
        [mapped]: pressed,
      };
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) {
        return;
      }
      handleKeyEvent(event, true);
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      handleKeyEvent(event, false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      keyboardStateRef.current = createEmptyJoypadState();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      const neutral = createEmptyJoypadState();
      applyInputState({ hardware: neutral, virtual: createEmptyJoypadState() });
    };
  }, [applyInputState]);

  const virtualGamepad = useMemo(
    () => <VirtualJoypad onChange={handleVirtualInputStateChange} />,
    [handleVirtualInputStateChange],
  );

  return {
    virtualGamepad,
    getCurrentState: () => mergedStateRef.current,
  };
}
