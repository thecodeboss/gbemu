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

export interface CpuBusPort {
  readByte(address: number): number;
  writeByte(address: number, value: number): void;
  readWord(address: number): number;
  writeWord(address: number, value: number): void;
  dmaTransfer(source: number): void;
}

function createDefaultCpuState(): CpuState {
  return {
    registers: {
      a: 0,
      f: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0,
      h: 0,
      l: 0,
      sp: 0xfffe,
      pc: 0x0100,
    },
    flags: {
      zero: false,
      subtract: false,
      halfCarry: false,
      carry: false,
    },
    ime: false,
    halted: false,
    stopped: false,
    cycles: 0,
  };
}

export class Cpu {
  state: CpuState = createDefaultCpuState();
  #doubleSpeed = false;
  #bus: CpuBusPort | null = null;

  reset(): void {
    this.state = createDefaultCpuState();
    this.#doubleSpeed = false;
  }

  step(): number {
    const cycles = this.#doubleSpeed ? 8 : 4;
    this.state.cycles += cycles;
    // TODO: Remove once instruction decoding updates the PC correctly.
    this.state.registers.pc = (this.state.registers.pc + 1) & 0xffff;
    return cycles;
  }

  requestInterrupt(_type: InterruptType): void {
    // Intentionally left blank for stub implementation.
  }

  clearInterrupt(_type: InterruptType): void {
    // Intentionally left blank for stub implementation.
  }

  setDoubleSpeedMode(enabled: boolean): void {
    this.#doubleSpeed = enabled;
  }

  connectBus(bus: CpuBusPort): void {
    this.#bus = bus;
  }
}
