import { disassembleInstruction } from "../rom/disassemble.js";
import { InstructionOperand, OpcodeInstruction } from "../rom/types.js";
import {
  EIGHT_BIT_REGISTERS,
  INTERRUPT_BITS,
  INTERRUPT_ENABLE_ADDRESS,
  INTERRUPT_FLAG_ADDRESS,
  INTERRUPT_PRIORITY_ORDER,
  INTERRUPT_VECTORS,
  MAX_PREFETCH_BYTES,
  MEMORY_SIZE,
  SIXTEEN_BIT_REGISTERS,
  STACK_REGISTER_NAMES,
} from "./constants.js";
import { createDefaultCpuState } from "./state.js";
import {
  CpuBusPort,
  CpuFlags,
  CpuState,
  InstructionOperandWithMeta,
  InterruptType,
} from "./types.js";

export type Constructor<T = {}> = new (...args: any[]) => T;

export abstract class CpuBase {
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

    const interruptServiced = this.serviceInterruptIfNeeded(bus);
    if (interruptServiced) {
      return this.consumeCycles();
    }

    if (this.state.halted || this.state.stopped) {
      return this.consumeCycles();
    }

    const pc = this.state.registers.pc & 0xffff;
    this.prefetchInstructionBytes(bus, pc);
    const instruction = disassembleInstruction(this.#instructionView, pc);
    if (instruction.type !== "opcode") {
      throw new Error(
        `Encountered non-opcode data at 0x${pc.toString(16).padStart(4, "0")}`,
      );
    }

    this.executeInstruction(instruction, pc);
    return this.consumeCycles();
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

  protected abstract executeInstruction(
    instruction: OpcodeInstruction,
    currentPc: number,
  ): void;

  protected serviceInterruptIfNeeded(bus: CpuBusPort): boolean {
    const interruptEnable = bus.readByte(INTERRUPT_ENABLE_ADDRESS) & 0xff;
    const interruptFlags = bus.readByte(INTERRUPT_FLAG_ADDRESS) & 0xff;
    const pendingMask = (interruptEnable & interruptFlags) & 0x1f;

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
    this.pushWord(this.state.registers.pc);
    const clearedFlags = interruptFlags & ~INTERRUPT_BITS[pendingType];
    bus.writeByte(INTERRUPT_FLAG_ADDRESS, clearedFlags);
    this.setProgramCounter(INTERRUPT_VECTORS[pendingType]);
    return true;
  }

  protected prefetchInstructionBytes(bus: CpuBusPort, pc: number): void {
    for (let offset = 0; offset < MAX_PREFETCH_BYTES; offset += 1) {
      const address = pc + offset;
      if (address >= MEMORY_SIZE) {
        break;
      }
      this.#instructionView[address] = bus.readByte(address);
    }
  }

  protected assertAccumulatorDestination(
    operand: InstructionOperand | undefined,
    mnemonic: string,
  ): void {
    if (!operand || operand.meta?.name !== "A") {
      throw new Error(
        `${mnemonic} instruction expects accumulator destination`,
      );
    }
  }

  protected readRegisterPairOperand(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand || !operand.meta) {
      throw new Error(`Missing ${description}`);
    }
    const name = operand.meta.name;
    if (!this.is16BitRegister(name)) {
      throw new Error(`Unsupported ${description}: ${name}`);
    }
    return this.readRegisterPairByName(name);
  }

  protected isEightBitRegisterOperand(
    operand: InstructionOperand | undefined,
  ): operand is InstructionOperandWithMeta {
    return Boolean(
      operand &&
        operand.meta &&
        operand.meta.immediate &&
        this.is8BitRegister(operand.meta.name),
    );
  }

  protected is16BitRegisterOperand(
    operand: InstructionOperand | undefined,
  ): operand is InstructionOperandWithMeta {
    return Boolean(
      operand &&
        operand.meta &&
        operand.meta.immediate &&
        this.is16BitRegister(operand.meta.name),
    );
  }

  protected isMemoryOperand(
    operand: InstructionOperand | undefined,
  ): operand is InstructionOperandWithMeta {
    if (!operand || !operand.meta) {
      return false;
    }
    const { meta } = operand;
    if (meta.name === "HL" && meta.immediate === false) {
      return true;
    }
    if (!meta.immediate && this.is16BitRegister(meta.name)) {
      return true;
    }
    if (!meta.immediate && meta.name === "C") {
      return true;
    }
    if (meta.name === "a16" || meta.name === "a8") {
      return true;
    }
    return false;
  }

  protected isImmediate16Operand(
    operand: InstructionOperand | undefined,
  ): operand is InstructionOperandWithMeta {
    return Boolean(operand && operand.meta?.name === "n16");
  }

  protected transformMutableOperand(
    operand: InstructionOperand | undefined,
    description: string,
    transform: (value: number) => { result: number; carry: boolean },
  ): { result: number; carry: boolean } {
    if (!operand) {
      throw new Error(`Missing ${description}`);
    }
    const currentValue = this.readEightBitValue(operand, description);
    const outcome = transform(currentValue & 0xff);
    const result = outcome.result & 0xff;
    this.writeEightBitValue(operand, result);
    return { result, carry: outcome.carry };
  }

  protected parseBitIndex(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand || operand.meta?.name !== "u3") {
      throw new Error(`Missing ${description}`);
    }
    if (operand.rawValue === null) {
      throw new Error(`Missing immediate for ${description}`);
    }
    const bitIndex = operand.rawValue & 0xff;
    if (bitIndex < 0 || bitIndex > 7) {
      throw new Error(`Invalid ${description}: ${bitIndex}`);
    }
    return bitIndex;
  }

  protected parseRstVector(name: string): number {
    if (!name.startsWith("$")) {
      throw new Error(`Unexpected RST vector operand "${name}"`);
    }
    const value = Number.parseInt(name.slice(1), 16);
    if (Number.isNaN(value)) {
      throw new Error(`Unable to parse RST vector "${name}"`);
    }
    return value & 0xffff;
  }

  protected readImmediateOperand(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand || operand.rawValue === null) {
      throw new Error(`Missing ${description}`);
    }
    return operand.rawValue & 0xffff;
  }

  protected readSignedImmediateOperand(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand) {
      throw new Error(`Missing ${description}`);
    }
    if (operand.meta?.name !== "e8") {
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

  protected evaluateCondition(name: string): boolean {
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

  protected readEightBitValue(
    operand: InstructionOperand | undefined,
    description: string,
  ): number {
    if (!operand || !operand.meta) {
      throw new Error(`Missing ${description}`);
    }

    if (this.isMemoryOperand(operand)) {
      const reference = this.resolveMemoryReference(operand, description);
      const value = this.#requireBus().readByte(reference.address) & 0xff;
      reference.postAccess?.();
      return value;
    }

    if (operand.meta.name === "n8") {
      if (operand.rawValue === null) {
        throw new Error(`Missing immediate for ${description}`);
      }
      return operand.rawValue & 0xff;
    }

    if (this.is8BitRegister(operand.meta.name)) {
      return this.readRegister8(operand.meta.name);
    }

    throw new Error(`Unsupported ${description}: ${operand.meta.name}`);
  }

  protected writeEightBitValue(
    operand: InstructionOperand,
    value: number,
  ): void {
    if (!operand.meta) {
      throw new Error("Operand metadata missing for write");
    }
    const maskedValue = value & 0xff;
    if (this.isMemoryOperand(operand)) {
      const reference = this.resolveMemoryReference(operand, "memory target");
      this.#requireBus().writeByte(reference.address, maskedValue);
      reference.postAccess?.();
      return;
    }

    if (this.is8BitRegister(operand.meta.name)) {
      this.writeRegister8(operand.meta.name, maskedValue);
      return;
    }

    throw new Error(`Cannot write to operand ${operand.meta.name}`);
  }

  protected increment8(operand: InstructionOperand): void {
    const current = this.readEightBitValue(operand, "INC operand");
    const result = (current + 1) & 0xff;
    this.writeEightBitValue(operand, result);
    const halfCarry = (current & 0x0f) + 1 > 0x0f;
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry,
    });
  }

  protected decrement8(operand: InstructionOperand): void {
    const current = this.readEightBitValue(operand, "DEC operand");
    const result = (current - 1) & 0xff;
    this.writeEightBitValue(operand, result);
    const halfCarry = (current & 0x0f) === 0;
    this.updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry,
    });
  }

  protected increment16(registerName: string): void {
    const value = this.readRegisterPairByName(registerName);
    this.writeRegisterPairByName(registerName, (value + 1) & 0xffff);
  }

  protected decrement16(registerName: string): void {
    const value = this.readRegisterPairByName(registerName);
    this.writeRegisterPairByName(registerName, (value - 1) & 0xffff);
  }

  protected addToAccumulator(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const sum = current + operand;
    const result = sum & 0xff;
    const halfCarry = (current & 0x0f) + (operand & 0x0f) > 0x0f;
    const carry = sum > 0xff;
    registers.a = result;
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry,
      carry,
    });
  }

  protected addToAccumulatorWithCarry(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const carryIn = this.state.flags.carry ? 1 : 0;
    const sum = current + operand + carryIn;
    const result = sum & 0xff;
    const halfCarry = (current & 0x0f) + (operand & 0x0f) + carryIn > 0x0f;
    const carry = sum > 0xff;
    registers.a = result;
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry,
      carry,
    });
  }

  protected subtractFromAccumulator(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const result = (current - operand) & 0xff;
    const borrow = current < operand;
    const halfBorrow = (current & 0x0f) < (operand & 0x0f);
    registers.a = result;
    this.updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry: halfBorrow,
      carry: borrow,
    });
  }

  protected subtractFromAccumulatorWithCarry(value: number): void {
    const operand = value & 0xff;
    const registers = this.state.registers;
    const current = registers.a & 0xff;
    const carryIn = this.state.flags.carry ? 1 : 0;
    const subtrahend = operand + carryIn;
    const result = (current - subtrahend) & 0xff;
    const borrow = current < subtrahend;
    const halfBorrow = (current & 0x0f) < (operand & 0x0f) + carryIn;
    registers.a = result;
    this.updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry: halfBorrow,
      carry: borrow,
    });
  }

  protected compareWithAccumulator(value: number): void {
    const operand = value & 0xff;
    const current = this.state.registers.a & 0xff;
    const result = (current - operand) & 0xff;
    const borrow = current < operand;
    const halfBorrow = (current & 0x0f) < (operand & 0x0f);
    this.updateFlags({
      zero: result === 0,
      subtract: true,
      halfCarry: halfBorrow,
      carry: borrow,
    });
  }

  protected addToRegisterHl(value: number): void {
    const operand = value & 0xffff;
    const current = this.readRegisterPairHL();
    const sum = current + operand;
    const result = sum & 0xffff;
    const halfCarry = (current & 0x0fff) + (operand & 0x0fff) > 0x0fff;
    const carry = sum > 0xffff;
    this.writeRegisterPairHL(result);
    this.updateFlags({
      subtract: false,
      halfCarry,
      carry,
    });
  }

  protected computeSpOffsetResult(offset: number): {
    result: number;
    halfCarry: boolean;
    carry: boolean;
  } {
    const registers = this.state.registers;
    const sp = registers.sp & 0xffff;
    const signedOffset = (offset << 24) >> 24;
    const unsignedOffset = offset & 0xff;
    const result = (sp + signedOffset) & 0xffff;
    const halfCarry = ((sp & 0x0f) + (unsignedOffset & 0x0f)) > 0x0f;
    const carry = ((sp & 0xff) + unsignedOffset) > 0xff;
    return { result, halfCarry, carry };
  }

  protected addSignedImmediateToSp(offset: number): void {
    const { result, halfCarry, carry } = this.computeSpOffsetResult(offset);
    this.state.registers.sp = result;
    this.updateFlags({
      zero: false,
      subtract: false,
      halfCarry,
      carry,
    });
  }

  protected loadHlWithSpOffset(offset: number): void {
    const { result, halfCarry, carry } = this.computeSpOffsetResult(offset);
    this.writeRegisterPairHL(result);
    this.updateFlags({
      zero: false,
      subtract: false,
      halfCarry,
      carry,
    });
  }

  protected rotateLeftThroughCarry(
    value: number,
  ): { result: number; carry: boolean } {
    const carryIn = this.state.flags.carry ? 1 : 0;
    const carry = (value & 0x80) !== 0;
    const result = ((value << 1) | carryIn) & 0xff;
    return { result, carry };
  }

  protected rotateLeftCircular(
    value: number,
  ): { result: number; carry: boolean } {
    const carry = (value & 0x80) !== 0;
    const result = ((value << 1) | (carry ? 1 : 0)) & 0xff;
    return { result, carry };
  }

  protected rotateRightThroughCarry(
    value: number,
  ): { result: number; carry: boolean } {
    const carryIn = this.state.flags.carry ? 1 : 0;
    const carry = (value & 0x01) !== 0;
    const result = ((carryIn << 7) | (value >> 1)) & 0xff;
    return { result, carry };
  }

  protected rotateRightCircular(
    value: number,
  ): { result: number; carry: boolean } {
    const carry = (value & 0x01) !== 0;
    const result = ((carry ? 0x80 : 0) | (value >> 1)) & 0xff;
    return { result, carry };
  }

  protected shiftLeftArithmetic(
    value: number,
  ): { result: number; carry: boolean } {
    const carry = (value & 0x80) !== 0;
    const result = (value << 1) & 0xff;
    return { result, carry };
  }

  protected shiftRightArithmetic(
    value: number,
  ): { result: number; carry: boolean } {
    const carry = (value & 0x01) !== 0;
    const result = ((value & 0x80) | (value >> 1)) & 0xff;
    return { result, carry };
  }

  protected shiftRightLogical(
    value: number,
  ): { result: number; carry: boolean } {
    const carry = (value & 0x01) !== 0;
    const result = (value >> 1) & 0x7f;
    return { result, carry };
  }

  protected swapNibbles(value: number): number {
    const upper = (value & 0xf0) >> 4;
    const lower = value & 0x0f;
    return ((lower << 4) | upper) & 0xff;
  }

  protected is8BitRegister(name: string): boolean {
    return EIGHT_BIT_REGISTERS.has(name);
  }

  protected is16BitRegister(name: string): boolean {
    return SIXTEEN_BIT_REGISTERS.has(name);
  }

  protected updateFlags(flags: Partial<CpuFlags>): void {
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
    this.syncFlagRegister();
  }

  protected syncFlagRegister(): void {
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

  protected syncFlagsFromRegister(): void {
    const registers = this.state.registers;
    const value = registers.f & 0xf0;
    registers.f = value;
    this.state.flags.zero = (value & 0x80) !== 0;
    this.state.flags.subtract = (value & 0x40) !== 0;
    this.state.flags.halfCarry = (value & 0x20) !== 0;
    this.state.flags.carry = (value & 0x10) !== 0;
  }

  protected writeWordToAddress(address: number, value: number): void {
    const bus = this.#requireBus();
    const targetAddress = address & 0xffff;
    bus.writeByte(targetAddress, value & 0xff);
    bus.writeByte((targetAddress + 1) & 0xffff, (value >> 8) & 0xff);
  }

  protected pushWord(value: number): void {
    const bus = this.#requireBus();
    const registers = this.state.registers;
    registers.sp = (registers.sp - 1) & 0xffff;
    bus.writeByte(registers.sp, (value >> 8) & 0xff);
    registers.sp = (registers.sp - 1) & 0xffff;
    bus.writeByte(registers.sp, value & 0xff);
  }

  protected popWord(): number {
    const bus = this.#requireBus();
    const registers = this.state.registers;
    const low = bus.readByte(registers.sp);
    registers.sp = (registers.sp + 1) & 0xffff;
    const high = bus.readByte(registers.sp);
    registers.sp = (registers.sp + 1) & 0xffff;
    return ((high << 8) | low) & 0xffff;
  }

  protected readRegisterPairHL(): number {
    const { h, l } = this.state.registers;
    return ((h << 8) | l) & 0xffff;
  }

  protected setProgramCounter(value: number): void {
    this.state.registers.pc = value & 0xffff;
  }

  protected consumeCycles(): number {
    const cycles = this.#doubleSpeed ? 8 : 4;
    this.state.cycles += cycles;
    return cycles;
  }

  protected readRegisterPairByName(name: string): number {
    const registers = this.state.registers;
    switch (name) {
      case "AF":
        return ((registers.a << 8) | registers.f) & 0xffff;
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

  protected writeRegisterPairByName(name: string, value: number): void {
    const registers = this.state.registers;
    const masked = value & 0xffff;
    switch (name) {
      case "AF":
        registers.a = (masked >> 8) & 0xff;
        registers.f = masked & 0xf0;
        this.syncFlagsFromRegister();
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
        this.writeRegisterPairHL(masked);
        return;
      case "SP":
        registers.sp = masked;
        return;
      default:
        throw new Error(`Unsupported 16-bit register ${name}`);
    }
  }

  protected writeRegisterPairHL(value: number): void {
    const registers = this.state.registers;
    registers.h = (value >> 8) & 0xff;
    registers.l = value & 0xff;
  }

  protected readRegister8(name: string): number {
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

  protected writeRegister8(name: string, value: number): void {
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

  protected resolveMemoryReference(
    operand: InstructionOperand,
    description: string,
  ): { address: number; postAccess?: () => void } {
    if (!operand.meta) {
      throw new Error(`Missing metadata for ${description}`);
    }

    const { meta } = operand;
    if (meta.name === "HL" && meta.immediate === false) {
      return { address: this.readRegisterPairHL() };
    }

    if (!meta.immediate && meta.name === "C") {
      const base = 0xff00;
      return { address: (base + this.state.registers.c) & 0xffff };
    }

    if (meta.name === "a8") {
      if (operand.rawValue === null) {
        throw new Error(`Missing offset for ${description}`);
      }
      return { address: (0xff00 + operand.rawValue) & 0xffff };
    }

    if (meta.name === "a16") {
      if (operand.rawValue === null) {
        throw new Error(`Missing address for ${description}`);
      }
      return { address: operand.rawValue & 0xffff };
    }

    if (!meta.immediate && this.is16BitRegister(meta.name)) {
      const registerName = meta.name;
      return {
        address: this.readRegisterPairByName(registerName),
        postAccess:
          registerName === "HL"
            ? () => {
                if (meta.increment) {
                  this.writeRegisterPairHL((this.readRegisterPairHL() + 1) & 0xffff);
                }
                if (meta.decrement) {
                  this.writeRegisterPairHL((this.readRegisterPairHL() - 1) & 0xffff);
                }
              }
            : undefined,
      };
    }

    throw new Error(`Unsupported memory operand for ${description}`);
  }

  protected resolveStackRegister(operand: InstructionOperand): string {
    if (!operand.meta) {
      throw new Error("Stack operand missing metadata");
    }
    const registerName = operand.meta.name;
    if (!STACK_REGISTER_NAMES.has(registerName)) {
      throw new Error(`Unsupported stack register ${registerName}`);
    }
    return registerName;
  }

  #requireBus(): CpuBusPort {
    if (!this.#bus) {
      throw new Error("CPU is not connected to a bus");
    }
    return this.#bus;
  }
}
