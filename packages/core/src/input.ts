export type JoypadButton =
  | "a"
  | "b"
  | "start"
  | "select"
  | "up"
  | "down"
  | "left"
  | "right";

export type JoypadInputState = Record<JoypadButton, boolean>;

export const JOYPAD_BUTTONS: JoypadButton[] = [
  "a",
  "b",
  "start",
  "select",
  "up",
  "down",
  "left",
  "right",
];

export function createEmptyJoypadState(): JoypadInputState {
  return {
    a: false,
    b: false,
    start: false,
    select: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };
}
