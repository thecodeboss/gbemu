import { disassembleInstruction } from "./rom/disassemble.js";
import type { InstructionOperand, OpcodeInstruction } from "./rom/types.js";

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

const MEMORY_SIZE = 0x10000;
const MAX_PREFETCH_BYTES = 3;

export class Cpu {
  state: CpuState = createDefaultCpuState();
  #doubleSpeed = false;
  #bus: CpuBusPort | null = null;
  #instructionView = new Uint8Array(MEMORY_SIZE);

  reset(): void {
    this.state = createDefaultCpuState();
    this.#doubleSpeed = false;
    if (this.#instructionView.length !== MEMORY_SIZE) {
      this.#instructionView = new Uint8Array(MEMORY_SIZE);
    } else {
      this.#instructionView.fill(0);
    }
  }

  step(): number {
    const bus = this.#requireBus();
    if (this.state.halted) {
      return this.#consumeCycles();
    }

    const pc = this.state.registers.pc & 0xffff;
    this.#prefetchInstructionBytes(bus, pc);
    const instruction = disassembleInstruction(this.#instructionView, pc);
    if (instruction.type !== "opcode") {
      throw new Error(
        `Encountered non-opcode data at 0x${pc.toString(16).padStart(4, "0")}`,
      );
    }

    this.#executeInstruction(instruction, pc);
    return this.#consumeCycles();
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
    this.#instructionView.fill(0);
  }

  #prefetchInstructionBytes(bus: CpuBusPort, pc: number): void {
    for (let offset = 0; offset < MAX_PREFETCH_BYTES; offset += 1) {
      const address = pc + offset;
      if (address >= MEMORY_SIZE) {
        break;
      }
      this.#instructionView[address] = bus.readByte(address);
    }
  }

  #executeInstruction(instruction: OpcodeInstruction, currentPc: number): void {
    const nextPc = (currentPc + instruction.length) & 0xffff;

    switch (instruction.mnemonic) {
      case "nop":
        this.#setProgramCounter(nextPc);
        return;
      case "call":
        this.#executeCall(instruction, nextPc);
        return;
      case "jp":
        this.#executeJump(instruction, nextPc);
        return;
      case "jr":
        this.#executeRelativeJump(instruction, nextPc);
        return;
      case "ret":
        this.#executeReturn(instruction, nextPc);
        return;
      case "reti":
        this.#executeReti();
        return;
      case "rst":
        this.#executeRst(instruction, nextPc);
        return;
      default:
        throw new Error(
          `Instruction ${instruction.mnemonic} (0x${instruction.opcode.toString(16)}) not implemented`,
        );
    }
  }

  #executeCall(instruction: OpcodeInstruction, nextPc: number): void {
    const [first, second] = instruction.operands;
    let conditionName: string | null = null;
    let targetOperand: InstructionOperand | undefined = first;

    if (instruction.operands.length === 2) {
      conditionName = first?.meta.name ?? null;
      targetOperand = second;
    }

    if (conditionName && !this.#evaluateCondition(conditionName)) {
      this.#setProgramCounter(nextPc);
      return;
    }

    const target = this.#readImmediateOperand(targetOperand, "call target");
    this.#pushWord(nextPc);
    this.#setProgramCounter(target);
  }

  #executeJump(instruction: OpcodeInstruction, nextPc: number): void {
    const { operands } = instruction;
    if (operands.length === 1 && operands[0]?.meta.name === "HL") {
      this.#setProgramCounter(this.#readRegisterPairHL());
      return;
    }

    let conditionName: string | null = null;
    let targetOperand: InstructionOperand | undefined = operands[0];

    if (operands.length === 2) {
      conditionName = operands[0]?.meta.name ?? null;
      targetOperand = operands[1];
    }

    if (conditionName && !this.#evaluateCondition(conditionName)) {
      this.#setProgramCounter(nextPc);
      return;
    }

    const target = this.#readImmediateOperand(targetOperand, "jump target");
    this.#setProgramCounter(target);
  }

  #executeRelativeJump(instruction: OpcodeInstruction, nextPc: number): void {
    const operands = instruction.operands;
    const offsetOperand = operands[operands.length - 1];

    if (!offsetOperand || offsetOperand.meta.name !== "e8") {
      throw new Error("JR instruction missing 8-bit signed offset operand");
    }

    let conditionName: string | null = null;
    if (operands.length === 2) {
      conditionName = operands[0]?.meta.name ?? null;
    }

    if (conditionName && !this.#evaluateCondition(conditionName)) {
      this.#setProgramCounter(nextPc);
      return;
    }

    const target = offsetOperand.relativeTarget ?? null;
    if (target === null) {
      throw new Error("JR instruction missing relative target");
    }

    this.#setProgramCounter(target);
  }

  #executeReturn(instruction: OpcodeInstruction, nextPc: number): void {
    const conditionOperand = instruction.operands[0];
    if (conditionOperand) {
      const conditionName = conditionOperand.meta.name;
      if (!this.#evaluateCondition(conditionName)) {
        this.#setProgramCounter(nextPc);
        return;
      }
    }

    const address = this.#popWord();
    this.#setProgramCounter(address);
  }

  #executeReti(): void {
    const address = this.#popWord();
    this.state.ime = true;
    this.#setProgramCounter(address);
  }

  #executeRst(instruction: OpcodeInstruction, nextPc: number): void {
    const vectorOperand = instruction.operands[0];
    if (!vectorOperand) {
      throw new Error("RST instruction missing target vector");
    }

    const target = this.#parseRstVector(vectorOperand.meta.name);
    this.#pushWord(nextPc);
    this.#setProgramCounter(target);
  }

  #parseRstVector(name: string): number {
    if (!name.startsWith("$")) {
      throw new Error(`Unexpected RST vector operand "${name}"`);
    }
    const value = Number.parseInt(name.slice(1), 16);
    if (Number.isNaN(value)) {
      throw new Error(`Unable to parse RST vector "${name}"`);
    }
    return value & 0xffff;
  }

  #readImmediateOperand(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand || operand.rawValue === null) {
      throw new Error(`Missing ${description}`);
    }
    return operand.rawValue & 0xffff;
  }

  #evaluateCondition(name: string): boolean {
    switch (name) {
      case "Z":
        return this.state.flags.zero;
      case "NZ":
        return !this.state.flags.zero;
      case "C":
        return this.state.flags.carry;
      case "NC":
        return !this.state.flags.carry;
      default:
        throw new Error(`Unsupported condition "${name}"`);
    }
  }

  #pushWord(value: number): void {
    const bus = this.#requireBus();
    const registers = this.state.registers;
    registers.sp = (registers.sp - 1) & 0xffff;
    bus.writeByte(registers.sp, (value >> 8) & 0xff);
    registers.sp = (registers.sp - 1) & 0xffff;
    bus.writeByte(registers.sp, value & 0xff);
  }

  #popWord(): number {
    const bus = this.#requireBus();
    const registers = this.state.registers;
    const low = bus.readByte(registers.sp);
    registers.sp = (registers.sp + 1) & 0xffff;
    const high = bus.readByte(registers.sp);
    registers.sp = (registers.sp + 1) & 0xffff;
    return ((high << 8) | low) & 0xffff;
  }

  #readRegisterPairHL(): number {
    const { h, l } = this.state.registers;
    return ((h << 8) | l) & 0xffff;
  }

  #setProgramCounter(value: number): void {
    this.state.registers.pc = value & 0xffff;
  }

  #consumeCycles(): number {
    const cycles = this.#doubleSpeed ? 8 : 4;
    this.state.cycles += cycles;
    return cycles;
  }

  #requireBus(): CpuBusPort {
    if (!this.#bus) {
      throw new Error("CPU is not connected to a bus");
    }
    return this.#bus;
  }
}
