import { InterruptType } from "./types.js";

export const MEMORY_SIZE = 0x10000;
export const MAX_PREFETCH_BYTES = 3;

export const EIGHT_BIT_REGISTERS = new Set(["A", "B", "C", "D", "E", "H", "L"]);
export const SIXTEEN_BIT_REGISTERS = new Set(["AF", "BC", "DE", "HL", "SP"]);
export const STACK_REGISTER_NAMES = new Set(["AF", "BC", "DE", "HL"]);

export const INTERRUPT_FLAG_ADDRESS = 0xff0f;
export const INTERRUPT_ENABLE_ADDRESS = 0xffff;

export const INTERRUPT_PRIORITY_ORDER: InterruptType[] = [
  "vblank",
  "lcdStat",
  "timer",
  "serial",
  "joypad",
];

export const INTERRUPT_VECTORS: Record<InterruptType, number> = {
  vblank: 0x40,
  lcdStat: 0x48,
  timer: 0x50,
  serial: 0x58,
  joypad: 0x60,
};

export const INTERRUPT_BITS: Record<InterruptType, number> = {
  vblank: 0x01,
  lcdStat: 0x02,
  timer: 0x04,
  serial: 0x08,
  joypad: 0x10,
};
