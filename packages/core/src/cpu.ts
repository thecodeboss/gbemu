import { UNPREFIXED_OPCODE_TABLE } from "./opcode-tables.js";
import { disassembleInstruction } from "./rom/disassemble.js";
import {
  executeAdd,
  executeAdc,
  executeCp,
  executeDaa,
  executeDec,
  executeInc,
  executeSbc,
  executeSub,
} from "./cpu-instructions/arithmetic.js";
import {
  executeAnd,
  executeBit,
  executeCcf,
  executeCpl,
  executeOr,
  executeRes,
  executeRl,
  executeRla,
  executeRlca,
  executeRlc,
  executeRr,
  executeRra,
  executeRrc,
  executeRrca,
  executeScf,
  executeSet,
  executeSla,
  executeSra,
  executeSrl,
  executeSwap,
  executeXor,
} from "./cpu-instructions/bitwise.js";
import {
  executeDi,
  executeEi,
  executeHalt,
  executeStop,
} from "./cpu-instructions/control.js";
import {
  executeCall,
  executeJump,
  executeRelativeJump,
  executeReturn,
  executeReti,
  executeRst,
} from "./cpu-instructions/jumps.js";
import { executeLd, executePop, executePush } from "./cpu-instructions/load.js";
import { InstructionOperand, OpcodeInstruction } from "./rom/types.js";

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
  readByte(address: number, ticksAhead?: number): number;
  writeByte(address: number, value: number, ticksAhead?: number): void;
  readWord(address: number): number;
  writeWord(address: number, value: number): void;
  dmaTransfer(source: number): void;
}

function createDefaultCpuState(): CpuState {
  return {
    registers: {
      a: 0x01,
      f: 0xb0,
      b: 0x00,
      c: 0x13,
      d: 0x00,
      e: 0xd8,
      h: 0x01,
      l: 0x4d,
      sp: 0xfffe,
      pc: 0x0100,
    },
    flags: {
      zero: true,
      subtract: false,
      halfCarry: true,
      carry: true,
    },
    ime: false,
    halted: false,
    stopped: false,
    cycles: 0,
  };
}

const MEMORY_SIZE = 0x10000;
const MAX_PREFETCH_BYTES = 3;
const EIGHT_BIT_REGISTERS = new Set(["A", "B", "C", "D", "E", "H", "L"]);
const SIXTEEN_BIT_REGISTERS = new Set(["AF", "BC", "DE", "HL", "SP"]);
const INTERRUPT_FLAG_ADDRESS = 0xff0f;
const INTERRUPT_ENABLE_ADDRESS = 0xffff;
const INTERRUPT_PRIORITY_ORDER: InterruptType[] = [
  "vblank",
  "lcdStat",
  "timer",
  "serial",
  "joypad",
];
const INTERRUPT_VECTORS: Record<InterruptType, number> = {
  vblank: 0x40,
  lcdStat: 0x48,
  timer: 0x50,
  serial: 0x58,
  joypad: 0x60,
};
const INTERRUPT_BITS: Record<InterruptType, number> = {
  vblank: 0x01,
  lcdStat: 0x02,
  timer: 0x04,
  serial: 0x08,
  joypad: 0x10,
};

export class Cpu {
  state: CpuState = createDefaultCpuState();
  #doubleSpeed = false;
  #bus: CpuBusPort;
  #instructionView = new Uint8Array(MEMORY_SIZE);
  #pendingExtraCycles = 0;
  imeEnableDelay = 0;

  constructor(bus: CpuBusPort) {
    this.#bus = bus;
  }

  reset(): void {
    this.state = createDefaultCpuState();
    this.#doubleSpeed = false;
    this.imeEnableDelay = 0;
    if (this.#instructionView.length !== MEMORY_SIZE) {
      this.#instructionView = new Uint8Array(MEMORY_SIZE);
    } else {
      this.#instructionView.fill(0);
    }
  }

  step(): number {
    const interruptServiced = this.#serviceInterruptIfNeeded(this.#bus);
    if (interruptServiced) {
      const cycles = this.#consumeCycles(5);
      this.#advanceImeEnableDelay();
      return cycles;
    }

    if (this.state.halted || this.state.stopped) {
      return this.#consumeCycles(UNPREFIXED_OPCODE_TABLE[0].c);
    }

    const pc = this.state.registers.pc & 0xffff;
    this.#prefetchInstructionBytes(this.#bus, pc);
    const instruction = disassembleInstruction(this.#instructionView, pc);
    if (instruction.type !== "opcode") {
      throw new Error(
        `Encountered non-opcode data at 0x${pc.toString(16).padStart(4, "0")}`,
      );
    }

    this.#executeInstruction(instruction, pc);
    const cycles = this.#computeInstructionCycles(instruction);
    const consumed = this.#consumeCycles(cycles);
    this.#advanceImeEnableDelay();
    return consumed;
  }

  setDoubleSpeedMode(enabled: boolean): void {
    this.#doubleSpeed = enabled;
  }

  #serviceInterruptIfNeeded(bus: CpuBusPort): boolean {
    const interruptEnable = bus.readByte(INTERRUPT_ENABLE_ADDRESS) & 0xff;
    const interruptFlags = bus.readByte(INTERRUPT_FLAG_ADDRESS) & 0xff;
    const pendingMask = interruptEnable & interruptFlags & 0x1f;

    if (pendingMask === 0) {
      return false;
    }

    if (this.state.halted) {
      this.state.halted = false;
    }

    if (!this.state.ime) {
      return false;
    }

    this.state.stopped = false;

    const pendingType = INTERRUPT_PRIORITY_ORDER.find((type) => {
      return (pendingMask & INTERRUPT_BITS[type]) !== 0;
    });

    if (!pendingType) {
      return false;
    }

    this.state.ime = false;
    this.pushWord(this.state.registers.pc, 8);
    const clearedFlags = interruptFlags & ~INTERRUPT_BITS[pendingType];
    bus.writeByte(INTERRUPT_FLAG_ADDRESS, clearedFlags);
    this.setProgramCounter(INTERRUPT_VECTORS[pendingType]);
    return true;
  }

  #prefetchInstructionBytes(bus: CpuBusPort, pc: number): void {
    for (let offset = 0; offset < MAX_PREFETCH_BYTES; offset += 1) {
      const address = pc + offset;
      if (address >= MEMORY_SIZE) {
        break;
      }
      this.#instructionView[address] = bus.readByte(address, offset * 4);
    }
  }

  #executeInstruction(instruction: OpcodeInstruction, currentPc: number): void {
    this.#pendingExtraCycles = 0;
    const nextPc = (currentPc + instruction.length) & 0xffff;

    switch (instruction.mnemonic) {
      case "nop":
        this.setProgramCounter(nextPc);
        return;
      case "daa":
        executeDaa(this, instruction, nextPc);
        return;
      case "di":
        executeDi(this, instruction, nextPc);
        return;
      case "ei":
        executeEi(this, instruction, nextPc);
        return;
      case "halt":
        executeHalt(this, instruction, nextPc);
        return;
      case "ld":
      case "ldh":
        executeLd(this, instruction, nextPc);
        return;
      case "and":
        executeAnd(this, instruction, nextPc);
        return;
      case "add":
        executeAdd(this, instruction, nextPc);
        return;
      case "adc":
        executeAdc(this, instruction, nextPc);
        return;
      case "sub":
        executeSub(this, instruction, nextPc);
        return;
      case "sbc":
        executeSbc(this, instruction, nextPc);
        return;
      case "cp":
        executeCp(this, instruction, nextPc);
        return;
      case "cpl":
        executeCpl(this, instruction, nextPc);
        return;
      case "ccf":
        executeCcf(this, instruction, nextPc);
        return;
      case "scf":
        executeScf(this, instruction, nextPc);
        return;
      case "or":
        executeOr(this, instruction, nextPc);
        return;
      case "xor":
        executeXor(this, instruction, nextPc);
        return;
      case "inc":
        executeInc(this, instruction, nextPc);
        return;
      case "dec":
        executeDec(this, instruction, nextPc);
        return;
      case "bit":
        executeBit(this, instruction, nextPc);
        return;
      case "res":
        executeRes(this, instruction, nextPc);
        return;
      case "set":
        executeSet(this, instruction, nextPc);
        return;
      case "rl":
        executeRl(this, instruction, nextPc);
        return;
      case "rlc":
        executeRlc(this, instruction, nextPc);
        return;
      case "rla":
        executeRla(this, instruction, nextPc);
        return;
      case "rlca":
        executeRlca(this, instruction, nextPc);
        return;
      case "rr":
        executeRr(this, instruction, nextPc);
        return;
      case "rrc":
        executeRrc(this, instruction, nextPc);
        return;
      case "rra":
        executeRra(this, instruction, nextPc);
        return;
      case "rrca":
        executeRrca(this, instruction, nextPc);
        return;
      case "sla":
        executeSla(this, instruction, nextPc);
        return;
      case "sra":
        executeSra(this, instruction, nextPc);
        return;
      case "srl":
        executeSrl(this, instruction, nextPc);
        return;
      case "swap":
        executeSwap(this, instruction, nextPc);
        return;
      case "call":
        executeCall(this, instruction, nextPc);
        return;
      case "jp":
        executeJump(this, instruction, nextPc);
        return;
      case "jr":
        executeRelativeJump(this, instruction, nextPc);
        return;
      case "ret":
        executeReturn(this, instruction, nextPc);
        return;
      case "reti":
        executeReti(this);
        return;
      case "rst":
        executeRst(this, instruction, nextPc);
        return;
      case "stop":
        executeStop(this, instruction, nextPc);
        return;
      case "pop":
        executePop(this, instruction, nextPc);
        return;
      case "push":
        executePush(this, instruction, nextPc);
        return;
      default:
        throw new Error(
          `Instruction ${instruction.mnemonic} (0x${instruction.opcode.toString(16)}) not implemented`,
        );
    }
  }

  isEightBitRegisterOperand(operand: InstructionOperand | undefined): boolean {
    return Boolean(
      operand && operand.meta.imm && EIGHT_BIT_REGISTERS.has(operand.meta.name),
    );
  }

  is16BitRegisterOperand(operand: InstructionOperand | undefined): boolean {
    return Boolean(
      operand &&
        operand.meta.imm &&
        SIXTEEN_BIT_REGISTERS.has(operand.meta.name),
    );
  }

  isMemoryOperand(operand: InstructionOperand | undefined): boolean {
    if (!operand) {
      return false;
    }
    const { meta } = operand;
    if (meta.name === "HL" && !meta.imm) return true;
    if (!meta.imm && SIXTEEN_BIT_REGISTERS.has(meta.name)) return true;
    if (!meta.imm && meta.name === "C") return true;
    if (meta.name === "a16" || meta.name === "a8") return true;
    return false;
  }

  isImmediate16Operand(operand: InstructionOperand | undefined): boolean {
    return Boolean(operand && operand.meta.name === "n16");
  }

  #resolveMemoryReference(
    operand: InstructionOperand,
    description: string,
  ): { address: number; postAccess?: () => void } {
    const { meta, rawValue } = operand;
    const name = meta.name;

    if (name === "a16") {
      if (rawValue === null) {
        throw new Error(`Missing ${description}`);
      }
      return { address: rawValue & 0xffff };
    }

    if (name === "a8") {
      if (rawValue === null) {
        throw new Error(`Missing ${description}`);
      }
      return { address: (0xff00 + (rawValue & 0xff)) & 0xffff };
    }

    if (name === "C" && !meta.imm) {
      const address = (0xff00 + (this.state.registers.c & 0xff)) & 0xffff;
      return { address };
    }

    if (name === "HL" && !meta.imm) {
      const address = this.readRegisterPairHL();
      const delta = meta.inc ? 1 : meta.dec ? -1 : 0;
      if (delta === 0) {
        return { address };
      }
      return {
        address,
        postAccess: () => {
          const next = (address + delta) & 0xffff;
          this.#writeRegisterPairHL(next);
        },
      };
    }

    if (!meta.imm && SIXTEEN_BIT_REGISTERS.has(name)) {
      const address = this.readRegisterPairByName(name);
      return { address };
    }

    throw new Error(`Unsupported ${description}: ${name}`);
  }

  readImmediateOperand(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand || operand.rawValue === null) {
      throw new Error(`Missing ${description}`);
    }
    return operand.rawValue & 0xffff;
  }

  readSignedImmediateOperand(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand) {
      throw new Error(`Missing ${description}`);
    }
    if (operand.meta.name !== "e8") {
      throw new Error(`Expected signed 8-bit operand for ${description}`);
    }
    if (operand.signedValue !== undefined && operand.signedValue !== null) {
      return operand.signedValue;
    }
    if (operand.rawValue === null) {
      throw new Error(`Missing ${description}`);
    }
    const raw = operand.rawValue & 0xff;
    return raw >= 0x80 ? raw - 0x100 : raw;
  }

  setConditionalExtraCycles(opcode: number, conditionTaken: boolean): void {
    if (!conditionTaken) {
      this.#pendingExtraCycles = 0;
      return;
    }
    switch (opcode) {
      case 0x20:
      case 0x28:
      case 0x30:
      case 0x38:
      case 0xc2:
      case 0xca:
      case 0xd2:
      case 0xda:
        this.#pendingExtraCycles = 1;
        return;
      case 0xc0:
      case 0xc8:
      case 0xd0:
      case 0xd8:
      case 0xc4:
      case 0xcc:
      case 0xd4:
      case 0xdc:
        this.#pendingExtraCycles = 3;
        return;
      default:
        this.#pendingExtraCycles = 0;
    }
  }

  readEightBitValue(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand) {
      throw new Error(`Missing ${description}`);
    }

    if (this.isMemoryOperand(operand)) {
      const reference = this.#resolveMemoryReference(operand, description);
      const value = this.#bus.readByte(reference.address, 4) & 0xff;
      reference.postAccess?.();
      return value;
    }

    if (operand.meta.name === "n8") {
      if (operand.rawValue === null) {
        throw new Error(`Missing immediate for ${description}`);
      }
      return operand.rawValue & 0xff;
    }

    if (EIGHT_BIT_REGISTERS.has(operand.meta.name)) {
      return this.readRegister8(operand.meta.name);
    }

    throw new Error(`Unsupported ${description}: ${operand.meta.name}`);
  }

  writeEightBitValue(operand: InstructionOperand, value: number): void {
    const maskedValue = value & 0xff;
    if (this.isMemoryOperand(operand)) {
      const reference = this.#resolveMemoryReference(operand, "memory target");
      this.#bus.writeByte(reference.address, maskedValue, 4);
      reference.postAccess?.();
      return;
    }

    if (EIGHT_BIT_REGISTERS.has(operand.meta.name)) {
      this.writeRegister8(operand.meta.name, maskedValue);
      return;
    }

    throw new Error(`Cannot write to operand ${operand.meta.name}`);
  }

  readRegister8(name: string): number {
    if (!EIGHT_BIT_REGISTERS.has(name))
      throw new Error(`Unsupported 8-bit register ${name}`);
    return (
      this.state.registers[name.toLowerCase() as keyof CpuRegisters] & 0xff
    );
  }

  writeRegister8(name: string, value: number): void {
    const masked = value & 0xff;
    if (!EIGHT_BIT_REGISTERS.has(name))
      throw new Error(`Unsupported 8-bit register ${name}`);
    this.state.registers[name.toLowerCase() as keyof CpuRegisters] = masked;
  }

  readRegisterPairByName(name: string): number {
    const registers = this.state.registers;
    switch (name) {
      case "AF":
        return ((registers.a << 8) | (registers.f & 0xf0)) & 0xffff;
      case "BC":
        return ((registers.b << 8) | registers.c) & 0xffff;
      case "DE":
        return ((registers.d << 8) | registers.e) & 0xffff;
      case "HL":
        return this.readRegisterPairHL();
      case "SP":
        return registers.sp & 0xffff;
      default:
        throw new Error(`Unsupported 16-bit register ${name}`);
    }
  }

  writeRegisterPairByName(name: string, value: number): void {
    const registers = this.state.registers;
    const masked = value & 0xffff;
    switch (name) {
      case "AF":
        registers.a = (masked >> 8) & 0xff;
        registers.f = masked & 0xf0;
        this.#syncFlagsFromRegister();
        return;
      case "BC":
        registers.b = (masked >> 8) & 0xff;
        registers.c = masked & 0xff;
        return;
      case "DE":
        registers.d = (masked >> 8) & 0xff;
        registers.e = masked & 0xff;
        return;
      case "HL":
        this.#writeRegisterPairHL(masked);
        return;
      case "SP":
        registers.sp = masked;
        return;
      default:
        throw new Error(`Unsupported 16-bit register ${name}`);
    }
  }

  #writeRegisterPairHL(value: number): void {
    const registers = this.state.registers;
    registers.h = (value >> 8) & 0xff;
    registers.l = value & 0xff;
  }

  updateFlags(flags: Partial<CpuFlags>): void {
    if (flags.zero !== undefined) this.state.flags.zero = flags.zero;
    if (flags.subtract !== undefined)
      this.state.flags.subtract = flags.subtract;
    if (flags.halfCarry !== undefined)
      this.state.flags.halfCarry = flags.halfCarry;
    if (flags.carry !== undefined) this.state.flags.carry = flags.carry;
    this.#syncFlagRegister();
  }

  #syncFlagRegister(): void {
    const { flags, registers } = this.state;
    let value = 0;
    if (flags.zero) value |= 0x80;
    if (flags.subtract) value |= 0x40;
    if (flags.halfCarry) value |= 0x20;
    if (flags.carry) value |= 0x10;
    registers.f = value;
  }

  #syncFlagsFromRegister(): void {
    const registers = this.state.registers;
    const value = registers.f & 0xf0;
    registers.f = value;
    this.state.flags.zero = (value & 0x80) !== 0;
    this.state.flags.subtract = (value & 0x40) !== 0;
    this.state.flags.halfCarry = (value & 0x20) !== 0;
    this.state.flags.carry = (value & 0x10) !== 0;
  }

  writeWordToAddress(address: number, value: number): void {
    const targetAddress = address & 0xffff;
    this.#bus.writeByte(targetAddress, value & 0xff, 4);
    this.#bus.writeByte((targetAddress + 1) & 0xffff, (value >> 8) & 0xff, 8);
  }

  pushWord(value: number, firstWriteTicksAhead = 0): void {
    const registers = this.state.registers;
    registers.sp = (registers.sp - 1) & 0xffff;
    this.#bus.writeByte(
      registers.sp,
      (value >> 8) & 0xff,
      firstWriteTicksAhead,
    );
    registers.sp = (registers.sp - 1) & 0xffff;
    this.#bus.writeByte(registers.sp, value & 0xff, firstWriteTicksAhead + 4);
  }

  popWord(firstReadTicksAhead = 0): number {
    const registers = this.state.registers;
    const low = this.#bus.readByte(registers.sp, firstReadTicksAhead);
    registers.sp = (registers.sp + 1) & 0xffff;
    const high = this.#bus.readByte(registers.sp, firstReadTicksAhead + 4);
    registers.sp = (registers.sp + 1) & 0xffff;
    return ((high << 8) | low) & 0xffff;
  }

  readRegisterPairHL(): number {
    const { h, l } = this.state.registers;
    return ((h << 8) | l) & 0xffff;
  }

  setProgramCounter(value: number): void {
    this.state.registers.pc = value & 0xffff;
  }

  #computeInstructionCycles(instruction: OpcodeInstruction): number {
    const base = instruction.meta.c ?? 0;
    const total = base + this.#pendingExtraCycles;
    return Math.max(1, total);
  }

  #consumeCycles(cycles: number): number {
    const adjusted = this.#doubleSpeed ? cycles * 2 : cycles;
    this.state.cycles += adjusted;
    return adjusted;
  }

  #advanceImeEnableDelay(): void {
    if (this.imeEnableDelay === 0) {
      return;
    }
    this.imeEnableDelay -= 1;
    if (this.imeEnableDelay === 0) {
      this.state.ime = true;
    }
  }
}
