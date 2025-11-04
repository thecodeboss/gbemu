export type CpuFlag = "Z" | "N" | "H" | "C";

export interface CpuFlags {
  zero: boolean;
  subtract: boolean;
  halfCarry: boolean;
  carry: boolean;
}

export interface CpuRegisters {
  /** 8-bit accumulator register. */
  a: number;
  /** 8-bit flag register (bitset of CpuFlag). */
  f: number;
  b: number;
  c: number;
  d: number;
  e: number;
  h: number;
  l: number;
  /** 16-bit stack pointer. */
  sp: number;
  /** 16-bit program counter. */
  pc: number;
}

export interface CpuState {
  registers: CpuRegisters;
  flags: CpuFlags;
  ime: boolean;
  halted: boolean;
  stopped: boolean;
  cycles: number;
}

export type InterruptType =
  | "vblank"
  | "lcdStat"
  | "timer"
  | "serial"
  | "joypad";

export interface Cpu {
  readonly state: CpuState;
  reset(): void;
  step(): number;
  requestInterrupt(type: InterruptType): void;
  clearInterrupt(type: InterruptType): void;
  setDoubleSpeedMode(enabled: boolean): void;
  connectBus(bus: CpuBusPort): void;
}

export interface CpuBusPort {
  readByte(address: number): number;
  writeByte(address: number, value: number): void;
  readWord(address: number): number;
  writeWord(address: number, value: number): void;
  dmaTransfer(source: number): void;
}
