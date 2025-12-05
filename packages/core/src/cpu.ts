import {
  CB_PREFIXED_OPCODE_TABLE,
  UNPREFIXED_OPCODE_TABLE,
} from "./opcode-tables.js";
import { InstructionOperand, OpcodeInstruction } from "./rom/types.js";
import { executeFns } from "./cpu-instructions/index.js";
import * as constants from "./cpu-instructions/constants.js";
import { isMemoryOperand } from "./cpu-instructions/utils.js";

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

export interface CpuBusPort {
  readByte(address: number, ticksAhead?: number): number;
  writeByte(address: number, value: number, ticksAhead?: number): void;
  readWord(address: number): number;
  writeWord(address: number, value: number): void;
  readRomByte(address: number): number;
  dmaTransfer(source: number): void;
  handleStop(): boolean;
  isDoubleSpeed(): boolean;
  isCgbMode(): boolean;
  isCgbHardware(): boolean;
}

function flagsFromRegister(f: number): CpuFlags {
  return {
    zero: (f & 0x80) !== 0,
    subtract: (f & 0x40) !== 0,
    halfCarry: (f & 0x20) !== 0,
    carry: (f & 0x10) !== 0,
  };
}

function createDefaultCpuState(isCgb: boolean): CpuState {
  const registers: CpuRegisters = isCgb
    ? {
        a: 0x11,
        f: 0x80,
        b: 0x00,
        c: 0x00,
        d: 0xff,
        e: 0x56,
        h: 0x00,
        l: 0x0d,
        sp: 0xfffe,
        pc: 0x0100,
      }
    : {
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
      };

  return {
    registers,
    flags: flagsFromRegister(registers.f),
    ime: false,
    halted: false,
    stopped: false,
    cycles: 0,
  };
}

export class Cpu {
  state: CpuState = createDefaultCpuState(false);
  #bus: CpuBusPort;
  #instructionView = new Uint8Array(constants.MEMORY_SIZE);
  #pendingExtraCycles = 0;
  imeEnableDelay = 0;
  #operandBuffer: InstructionOperand[] = [];
  #powerOnRegisters: CpuRegisters = {
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
  };

  constructor(bus: CpuBusPort) {
    this.#bus = bus;
  }

  reset(): void {
    const useRegisters =
      this.#powerOnRegisters ??
      createDefaultCpuState(this.#bus.isCgbHardware()).registers;
    this.state = createDefaultCpuState(false);
    this.state.registers = { ...useRegisters };
    this.state.flags = flagsFromRegister(useRegisters.f);
    this.state.ime = false;
    this.state.halted = false;
    this.state.stopped = false;
    this.state.cycles = 0;
    this.imeEnableDelay = 0;
    if (this.#instructionView.length !== constants.MEMORY_SIZE) {
      this.#instructionView = new Uint8Array(constants.MEMORY_SIZE);
    } else {
      this.#instructionView.fill(0);
    }
  }

  setPowerOnState(registers: CpuRegisters): void {
    this.#powerOnRegisters = { ...registers };
    this.state.registers = { ...registers };
    this.state.flags = flagsFromRegister(registers.f);
    this.state.ime = false;
    this.state.halted = false;
    this.state.stopped = false;
    this.state.cycles = 0;
  }

  handleStop(nextPc: number): void {
    const switched = this.#bus.handleStop();
    if (switched) {
      this.state.stopped = false;
      this.state.halted = false;
      this.setProgramCounter(nextPc);
      return;
    }
    this.state.stopped = true;
    this.state.halted = true;
    this.setProgramCounter(nextPc);
  }

  step(): number {
    const interruptCycles = this.#serviceInterruptIfNeeded(this.#bus);
    if (interruptCycles > 0) {
      const cycles = this.#consumeCycles(interruptCycles);
      this.#advanceImeEnableDelay();
      return cycles;
    }

    if (this.state.halted || this.state.stopped) {
      return this.#consumeCycles(UNPREFIXED_OPCODE_TABLE[0].c);
    }

    const pc = this.state.registers.pc & 0xffff;
    this.#prefetchInstructionBytes(this.#bus, pc);
    const instruction = this.#decodeInstruction(pc);

    this.#executeInstruction(instruction, pc);
    const cycles = this.#computeInstructionCycles(instruction);
    const consumed = this.#consumeCycles(cycles);
    this.#advanceImeEnableDelay();
    return consumed;
  }

  #serviceInterruptIfNeeded(bus: CpuBusPort): number {
    const interruptEnable =
      bus.readByte(constants.INTERRUPT_ENABLE_ADDRESS) & 0xff;
    const interruptFlags =
      bus.readByte(constants.INTERRUPT_FLAG_ADDRESS) & 0xff;
    const pendingMask = interruptEnable & interruptFlags & 0x1f;

    if (pendingMask === 0) {
      return 0;
    }

    const wasHalted = this.state.halted;
    if (this.state.halted) {
      this.state.halted = false;
    }

    if (!this.state.ime) {
      return 0;
    }

    this.state.stopped = false;

    this.state.ime = false;
    const registers = this.state.registers;
    const pc = registers.pc & 0xffff;

    // Push the PC manually so we can react if the first write hits IE (SP=0)
    // and changes the pending interrupt mask mid-dispatch.
    registers.sp = (registers.sp - 1) & 0xffff;
    bus.writeByte(registers.sp, (pc >> 8) & 0xff, 8);

    const postHighInterruptEnable =
      bus.readByte(constants.INTERRUPT_ENABLE_ADDRESS, 8) & 0xff;
    const postHighInterruptFlags =
      bus.readByte(constants.INTERRUPT_FLAG_ADDRESS, 8) & 0xff;
    const postHighPendingMask =
      postHighInterruptEnable & postHighInterruptFlags & 0x1f;

    registers.sp = (registers.sp - 1) & 0xffff;
    bus.writeByte(registers.sp, pc & 0xff, 12);

    if (postHighPendingMask === 0) {
      this.setProgramCounter(0x0000);
      return this.#computeInterruptEntryCycles({
        wasHalted,
        type: null,
        bus,
      });
    }

    const postHighPendingType = constants.INTERRUPT_PRIORITY_ORDER.find(
      (type) => (postHighPendingMask & constants.INTERRUPT_BITS[type]) !== 0,
    );

    if (!postHighPendingType) {
      return 0;
    }

    const clearedFlags =
      postHighInterruptFlags & ~constants.INTERRUPT_BITS[postHighPendingType];
    bus.writeByte(constants.INTERRUPT_FLAG_ADDRESS, clearedFlags);
    this.setProgramCounter(constants.INTERRUPT_VECTORS[postHighPendingType]);
    return this.#computeInterruptEntryCycles({
      wasHalted,
      type: postHighPendingType,
      bus,
    });
  }

  #computeInterruptEntryCycles(params: {
    wasHalted: boolean;
    type: constants.InterruptType | null;
    bus: CpuBusPort;
  }): number {
    const { wasHalted, type, bus } = params;
    if (type === "lcdStat" && wasHalted) {
      const statMode = bus.readByte(0xff41) & 0x03;
      if (statMode === 0x02) {
        return 6;
      }
    }
    return 5;
  }

  #prefetchInstructionBytes(bus: CpuBusPort, pc: number): void {
    for (let offset = 0; offset < constants.MAX_PREFETCH_BYTES; offset += 1) {
      const address = pc + offset;
      if (address >= constants.MEMORY_SIZE) {
        break;
      }
      if (address < 0x8000) {
        this.#instructionView[address] = bus.readRomByte(address);
      } else {
        this.#instructionView[address] = bus.readByte(address, offset * 4);
      }
    }
  }

  #decodeInstruction(pc: number): OpcodeInstruction {
    const opcode = this.#instructionView[pc] ?? 0;
    if (opcode === 0xcb) {
      const cbOpcode = this.#instructionView[pc + 1] ?? 0;
      const meta = CB_PREFIXED_OPCODE_TABLE[cbOpcode];
      const operands = this.#readOperands(meta, pc + 2);
      const length = meta.len;
      const bytes = this.#instructionView.subarray(pc, pc + length);
      return {
        type: "opcode",
        length,
        opcode: cbOpcode,
        prefixed: true,
        mnemonic: meta.m,
        meta,
        operands,
        bytes,
      };
    }

    const meta = UNPREFIXED_OPCODE_TABLE[opcode];
    const operands = this.#readOperands(meta, pc + 1);
    const length = meta.len;
    const bytes = this.#instructionView.subarray(pc, pc + length);
    return {
      type: "opcode",
      length,
      opcode,
      prefixed: false,
      mnemonic: meta.m,
      meta,
      operands,
      bytes,
    };
  }

  #readOperands(
    meta: (typeof UNPREFIXED_OPCODE_TABLE)[number],
    start: number,
  ): InstructionOperand[] {
    let cursor = start;
    const ops: InstructionOperand[] = this.#operandBuffer;
    ops.length = meta.ops.length;

    for (let i = 0; i < meta.ops.length; i += 1) {
      const operandMeta = meta.ops[i];
      let rawValue: number | null = null;
      let signedValue: number | undefined;
      let relativeTarget: number | undefined;

      if (operandMeta.bytes === 1) {
        rawValue = this.#instructionView[cursor] ?? 0;
        cursor += 1;
      } else if (operandMeta.bytes === 2) {
        const lo = this.#instructionView[cursor] ?? 0;
        const hi = this.#instructionView[cursor + 1] ?? 0;
        rawValue = lo | (hi << 8);
        cursor += 2;
      }

      if (operandMeta.name === "e8" && rawValue !== null) {
        signedValue = rawValue >= 0x80 ? rawValue - 0x100 : rawValue;
      }
      if (operandMeta.name === "e8" && signedValue !== undefined) {
        relativeTarget = (start - 1 + meta.len + signedValue) & 0xffff;
      }

      const existing = ops[i];
      if (existing) {
        ops[i] = {
          meta: operandMeta,
          rawValue,
          signedValue,
          relativeTarget,
        };
      } else {
        ops[i] = { meta: operandMeta, rawValue, signedValue, relativeTarget };
      }
    }

    return ops;
  }

  #executeInstruction(instruction: OpcodeInstruction, currentPc: number): void {
    this.#pendingExtraCycles = 0;
    const nextPc = (currentPc + instruction.length) & 0xffff;
    const executeFn = executeFns[instruction.mnemonic];
    if (executeFn) {
      executeFn(this, instruction, nextPc);
    } else if (instruction.mnemonic === "nop") {
      this.setProgramCounter(nextPc);
    } else {
      throw new Error(
        `Instruction ${instruction.mnemonic} (0x${instruction.opcode.toString(16)}) not implemented`,
      );
    }
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

    if (!meta.imm && constants.SIXTEEN_BIT_REGISTERS.has(name)) {
      const address = this.readRegisterPairByName(name);
      return { address };
    }

    throw new Error(`Unsupported ${description}: ${name}`);
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

    if (isMemoryOperand(operand)) {
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

    if (constants.EIGHT_BIT_REGISTERS.has(operand.meta.name)) {
      return this.readRegister8(operand.meta.name);
    }

    throw new Error(`Unsupported ${description}: ${operand.meta.name}`);
  }

  writeEightBitValue(operand: InstructionOperand, value: number): void {
    const maskedValue = value & 0xff;
    if (isMemoryOperand(operand)) {
      const reference = this.#resolveMemoryReference(operand, "memory target");
      this.#bus.writeByte(reference.address, maskedValue, 4);
      reference.postAccess?.();
      return;
    }

    if (constants.EIGHT_BIT_REGISTERS.has(operand.meta.name)) {
      this.writeRegister8(operand.meta.name, maskedValue);
      return;
    }

    throw new Error(`Cannot write to operand ${operand.meta.name}`);
  }

  readRegister8(name: string): number {
    if (!constants.EIGHT_BIT_REGISTERS.has(name))
      throw new Error(`Unsupported 8-bit register ${name}`);
    return (
      this.state.registers[name.toLowerCase() as keyof CpuRegisters] & 0xff
    );
  }

  writeRegister8(name: string, value: number): void {
    const masked = value & 0xff;
    if (!constants.EIGHT_BIT_REGISTERS.has(name))
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
    const adjusted = Math.max(1, cycles);
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
