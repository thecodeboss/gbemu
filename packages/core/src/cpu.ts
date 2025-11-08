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
const EIGHT_BIT_REGISTERS = new Set(["A", "B", "C", "D", "E", "H", "L"]);
const SIXTEEN_BIT_REGISTERS = new Set(["BC", "DE", "HL", "SP"]);

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
      case "add":
        this.#executeAdd(instruction, nextPc);
        return;
      case "adc":
        this.#executeAdc(instruction, nextPc);
        return;
      case "sub":
        this.#executeSub(instruction, nextPc);
        return;
      case "sbc":
        this.#executeSbc(instruction, nextPc);
        return;
      case "cp":
        this.#executeCp(instruction, nextPc);
        return;
      case "inc":
        this.#executeInc(instruction, nextPc);
        return;
      case "dec":
        this.#executeDec(instruction, nextPc);
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

  #executeAdd(instruction: OpcodeInstruction, nextPc: number): void {
    const [destination, source] = instruction.operands;
    if (!destination || !source) {
      throw new Error("ADD instruction missing operands");
    }

    if (destination.meta.name === "A") {
      const value = this.#readEightBitValue(source, "ADD source");
      this.#addToAccumulator(value);
      this.#setProgramCounter(nextPc);
      return;
    }

    if (destination.meta.name === "HL") {
      const value = this.#readRegisterPairOperand(source, "ADD HL source");
      this.#addToRegisterHl(value);
      this.#setProgramCounter(nextPc);
      return;
    }

    throw new Error(`ADD destination ${destination.meta.name} not implemented`);
  }

  #executeAdc(instruction: OpcodeInstruction, nextPc: number): void {
    const [destination, source] = instruction.operands;
    this.#assertAccumulatorDestination(destination, "ADC");
    const value = this.#readEightBitValue(source, "ADC source");
    this.#addToAccumulatorWithCarry(value);
    this.#setProgramCounter(nextPc);
  }

  #executeSub(instruction: OpcodeInstruction, nextPc: number): void {
    const [destination, source] = instruction.operands;
    this.#assertAccumulatorDestination(destination, "SUB");
    const value = this.#readEightBitValue(source, "SUB source");
    this.#subtractFromAccumulator(value);
    this.#setProgramCounter(nextPc);
  }

  #executeSbc(instruction: OpcodeInstruction, nextPc: number): void {
    const [destination, source] = instruction.operands;
    this.#assertAccumulatorDestination(destination, "SBC");
    const value = this.#readEightBitValue(source, "SBC source");
    this.#subtractFromAccumulatorWithCarry(value);
    this.#setProgramCounter(nextPc);
  }

  #executeCp(instruction: OpcodeInstruction, nextPc: number): void {
    const [destination, source] = instruction.operands;
    this.#assertAccumulatorDestination(destination, "CP");
    const value = this.#readEightBitValue(source, "CP source");
    this.#compareWithAccumulator(value);
    this.#setProgramCounter(nextPc);
  }

  #executeInc(instruction: OpcodeInstruction, nextPc: number): void {
    const operand = instruction.operands[0];
    if (!operand) {
      throw new Error("INC instruction missing operand");
    }

    if (this.#isMemoryOperand(operand) || this.#isEightBitRegisterOperand(operand)) {
      this.#increment8(operand);
      this.#setProgramCounter(nextPc);
      return;
    }

    if (this.#is16BitRegisterOperand(operand)) {
      this.#increment16(operand.meta.name);
      this.#setProgramCounter(nextPc);
      return;
    }

    throw new Error(`INC operand ${operand.meta.name} not implemented`);
  }

  #executeDec(instruction: OpcodeInstruction, nextPc: number): void {
    const operand = instruction.operands[0];
    if (!operand) {
      throw new Error("DEC instruction missing operand");
    }

    if (this.#isMemoryOperand(operand) || this.#isEightBitRegisterOperand(operand)) {
      this.#decrement8(operand);
      this.#setProgramCounter(nextPc);
      return;
    }

    if (this.#is16BitRegisterOperand(operand)) {
      this.#decrement16(operand.meta.name);
      this.#setProgramCounter(nextPc);
      return;
    }

    throw new Error(`DEC operand ${operand.meta.name} not implemented`);
  }

  #assertAccumulatorDestination(
    operand: InstructionOperand | undefined,
    mnemonic: string,
  ): void {
    if (!operand || operand.meta.name !== "A") {
      throw new Error(`${mnemonic} instruction expects accumulator destination`);
    }
  }

  #readRegisterPairOperand(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand) {
      throw new Error(`Missing ${description}`);
    }
    const name = operand.meta.name;
    if (!this.#is16BitRegister(name)) {
      throw new Error(`Unsupported ${description}: ${name}`);
    }
    return this.#readRegisterPairByName(name);
  }

  #isEightBitRegisterOperand(
    operand: InstructionOperand | undefined,
  ): boolean {
    return Boolean(operand && this.#is8BitRegister(operand.meta.name));
  }

  #is16BitRegisterOperand(
    operand: InstructionOperand | undefined,
  ): boolean {
    return Boolean(operand && this.#is16BitRegister(operand.meta.name));
  }

  #isMemoryOperand(
    operand: InstructionOperand | undefined,
  ): boolean {
    return Boolean(
      operand && operand.meta.name === "HL" && operand.meta.immediate === false,
    );
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

  #readEightBitValue(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand) {
      throw new Error(`Missing ${description}`);
    }

    if (this.#isMemoryOperand(operand)) {
      const address = this.#readRegisterPairHL();
      return this.#requireBus().readByte(address) & 0xff;
    }

    if (operand.meta.name === "n8") {
      if (operand.rawValue === null) {
        throw new Error(`Missing immediate for ${description}`);
      }
      return operand.rawValue & 0xff;
    }

    if (this.#is8BitRegister(operand.meta.name)) {
      return this.#readRegister8(operand.meta.name);
    }

    throw new Error(`Unsupported ${description}: ${operand.meta.name}`);
  }

  #writeEightBitValue(
    operand: InstructionOperand,
    value: number,
  ): void {
    const maskedValue = value & 0xff;
    if (this.#isMemoryOperand(operand)) {
      const address = this.#readRegisterPairHL();
      this.#requireBus().writeByte(address, maskedValue);
      return;
    }

    if (this.#is8BitRegister(operand.meta.name)) {
      this.#writeRegister8(operand.meta.name, maskedValue);
      return;
    }

    throw new Error(`Cannot write to operand ${operand.meta.name}`);
  }

  #increment8(operand: InstructionOperand): void {
    const current = this.#readEightBitValue(operand, "INC operand");
    const result = (current + 1) & 0xff;
    this.#writeEightBitValue(operand, result);
    const halfCarry = (current & 0x0f) + 1 > 0x0f;
    this.#updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry,
    });
  }

  #decrement8(operand: InstructionOperand): void {
    const current = this.#readEightBitValue(operand, "DEC operand");
    const result = (current - 1) & 0xff;
    this.#writeEightBitValue(operand, result);
    const halfCarry = (current & 0x0f) === 0;
    this.#updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry,
    });
  }

  #increment16(registerName: string): void {
    const value = this.#readRegisterPairByName(registerName);
    this.#writeRegisterPairByName(registerName, (value + 1) & 0xffff);
  }

  #decrement16(registerName: string): void {
    const value = this.#readRegisterPairByName(registerName);
    this.#writeRegisterPairByName(registerName, (value - 1) & 0xffff);
  }

  #addToAccumulator(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const sum = current + operand;
    const result = sum & 0xff;
    const halfCarry = ((current & 0x0f) + (operand & 0x0f)) > 0x0f;
    const carry = sum > 0xff;
    registers.a = result;
    this.#updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry,
      carry,
    });
  }

  #addToAccumulatorWithCarry(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const carryIn = this.state.flags.carry ? 1 : 0;
    const sum = current + operand + carryIn;
    const result = sum & 0xff;
    const halfCarry =
      ((current & 0x0f) + (operand & 0x0f) + carryIn) > 0x0f;
    const carry = sum > 0xff;
    registers.a = result;
    this.#updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry,
      carry,
    });
  }

  #subtractFromAccumulator(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const result = (current - operand) & 0xff;
    const borrow = current < operand;
    const halfBorrow = (current & 0x0f) < (operand & 0x0f);
    registers.a = result;
    this.#updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry: halfBorrow,
      carry: borrow,
    });
  }

  #subtractFromAccumulatorWithCarry(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const carryIn = this.state.flags.carry ? 1 : 0;
    const subtrahend = operand + carryIn;
    const result = (current - subtrahend) & 0xff;
    const borrow = current < subtrahend;
    const halfBorrow = (current & 0x0f) < ((operand & 0x0f) + carryIn);
    registers.a = result;
    this.#updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry: halfBorrow,
      carry: borrow,
    });
  }

  #compareWithAccumulator(value: number): void {
    const operand = value & 0xff;
    const current = this.state.registers.a & 0xff;
    const result = (current - operand) & 0xff;
    const borrow = current < operand;
    const halfBorrow = (current & 0x0f) < (operand & 0x0f);
    this.#updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry: halfBorrow,
      carry: borrow,
    });
  }

  #addToRegisterHl(value: number): void {
    const operand = value & 0xffff;
    const current = this.#readRegisterPairHL();
    const sum = current + operand;
    const result = sum & 0xffff;
    const halfCarry = ((current & 0x0fff) + (operand & 0x0fff)) > 0x0fff;
    const carry = sum > 0xffff;
    this.#writeRegisterPairHL(result);
    this.#updateFlags({
      subtract: false,
      halfCarry,
      carry,
    });
  }

  #readRegister8(name: string): number {
    const registers = this.state.registers;
    switch (name) {
      case "A":
        return registers.a & 0xff;
      case "B":
        return registers.b & 0xff;
      case "C":
        return registers.c & 0xff;
      case "D":
        return registers.d & 0xff;
      case "E":
        return registers.e & 0xff;
      case "H":
        return registers.h & 0xff;
      case "L":
        return registers.l & 0xff;
      default:
        throw new Error(`Unsupported 8-bit register ${name}`);
    }
  }

  #writeRegister8(name: string, value: number): void {
    const registers = this.state.registers;
    const masked = value & 0xff;
    switch (name) {
      case "A":
        registers.a = masked;
        return;
      case "B":
        registers.b = masked;
        return;
      case "C":
        registers.c = masked;
        return;
      case "D":
        registers.d = masked;
        return;
      case "E":
        registers.e = masked;
        return;
      case "H":
        registers.h = masked;
        return;
      case "L":
        registers.l = masked;
        return;
      default:
        throw new Error(`Unsupported 8-bit register ${name}`);
    }
  }

  #readRegisterPairByName(name: string): number {
    const registers = this.state.registers;
    switch (name) {
      case "BC":
        return ((registers.b << 8) | registers.c) & 0xffff;
      case "DE":
        return ((registers.d << 8) | registers.e) & 0xffff;
      case "HL":
        return this.#readRegisterPairHL();
      case "SP":
        return registers.sp & 0xffff;
      default:
        throw new Error(`Unsupported 16-bit register ${name}`);
    }
  }

  #writeRegisterPairByName(name: string, value: number): void {
    const registers = this.state.registers;
    const masked = value & 0xffff;
    switch (name) {
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

  #is8BitRegister(name: string): boolean {
    return EIGHT_BIT_REGISTERS.has(name);
  }

  #is16BitRegister(name: string): boolean {
    return SIXTEEN_BIT_REGISTERS.has(name);
  }

  #updateFlags(flags: Partial<CpuFlags>): void {
    if (flags.zero !== undefined) {
      this.state.flags.zero = flags.zero;
    }
    if (flags.subtract !== undefined) {
      this.state.flags.subtract = flags.subtract;
    }
    if (flags.halfCarry !== undefined) {
      this.state.flags.halfCarry = flags.halfCarry;
    }
    if (flags.carry !== undefined) {
      this.state.flags.carry = flags.carry;
    }
    this.#syncFlagRegister();
  }

  #syncFlagRegister(): void {
    const { flags, registers } = this.state;
    let value = 0;
    if (flags.zero) {
      value |= 0x80;
    }
    if (flags.subtract) {
      value |= 0x40;
    }
    if (flags.halfCarry) {
      value |= 0x20;
    }
    if (flags.carry) {
      value |= 0x10;
    }
    registers.f = value;
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
