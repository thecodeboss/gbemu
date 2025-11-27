import { Cpu } from "../cpu.js";
import { InstructionOperand, OpcodeInstruction } from "../rom/types.js";
import { addSignedImmediateToSp } from "./sp-offset.js";
import { assertAccumulatorDestination } from "./utils.js";

export function executeAdd(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  if (!destination || !source) {
    throw new Error("ADD instruction missing operands");
  }

  if (destination.meta.name === "A") {
    const value = cpu.readEightBitValue(source, "ADD source");
    addToAccumulator(cpu, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (destination.meta.name === "HL") {
    const value = readRegisterPairOperand(cpu, source, "ADD HL source");
    addToRegisterHl(cpu, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (destination.meta.name === "SP" && source.meta.name === "e8") {
    const offset = cpu.readSignedImmediateOperand(source, "ADD SP,e8 offset");
    addSignedImmediateToSp(cpu, offset);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(`ADD destination ${destination.meta.name} not implemented`);
}

export function executeAdc(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  assertAccumulatorDestination(destination, "ADC");
  const value = cpu.readEightBitValue(source, "ADC source");
  addToAccumulatorWithCarry(cpu, value);
  cpu.setProgramCounter(nextPc);
}

export function executeSub(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  assertAccumulatorDestination(destination, "SUB");
  const value = cpu.readEightBitValue(source, "SUB source");
  subtractFromAccumulator(cpu, value);
  cpu.setProgramCounter(nextPc);
}

export function executeSbc(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  assertAccumulatorDestination(destination, "SBC");
  const value = cpu.readEightBitValue(source, "SBC source");
  subtractFromAccumulatorWithCarry(cpu, value);
  cpu.setProgramCounter(nextPc);
}

export function executeCp(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  assertAccumulatorDestination(destination, "CP");
  const value = cpu.readEightBitValue(source, "CP source");
  compareWithAccumulator(cpu, value);
  cpu.setProgramCounter(nextPc);
}

export function executeInc(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("INC instruction missing operand");
  }

  if (cpu.isMemoryOperand(operand) || cpu.isEightBitRegisterOperand(operand)) {
    increment8(cpu, operand);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (cpu.is16BitRegisterOperand(operand)) {
    increment16(cpu, operand.meta.name);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(`INC operand ${operand.meta.name} not implemented`);
}

export function executeDec(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("DEC instruction missing operand");
  }

  if (cpu.isMemoryOperand(operand) || cpu.isEightBitRegisterOperand(operand)) {
    decrement8(cpu, operand);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (cpu.is16BitRegisterOperand(operand)) {
    decrement16(cpu, operand.meta.name);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(`DEC operand ${operand.meta.name} not implemented`);
}

export function executeDaa(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const flags = cpu.state.flags;
  let correction = 0;
  let carry = flags.carry;

  if (!flags.subtract) {
    if (flags.carry || registers.a > 0x99) {
      correction |= 0x60;
      carry = true;
    }
    if (flags.halfCarry || (registers.a & 0x0f) > 0x09) {
      correction |= 0x06;
    }
    registers.a = (registers.a + correction) & 0xff;
  } else {
    if (flags.carry) {
      correction |= 0x60;
    }
    if (flags.halfCarry) {
      correction |= 0x06;
    }
    registers.a = (registers.a - correction) & 0xff;
  }

  cpu.updateFlags({
    zero: (registers.a & 0xff) === 0,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

const REGISTER_PAIR_NAMES = new Set(["AF", "BC", "DE", "HL", "SP"]);

function readRegisterPairOperand(
  cpu: Cpu,
  operand: InstructionOperand | undefined,
  description: string,
): number {
  if (!operand) {
    throw new Error(`Missing ${description}`);
  }
  const name = operand.meta.name;
  if (!REGISTER_PAIR_NAMES.has(name)) {
    throw new Error(`Unsupported ${description}: ${name}`);
  }
  return cpu.readRegisterPairByName(name);
}

function increment8(cpu: Cpu, operand: InstructionOperand): void {
  const current = cpu.readEightBitValue(operand, "INC operand");
  const result = (current + 1) & 0xff;
  cpu.writeEightBitValue(operand, result);
  const halfCarry = (current & 0x0f) + 1 > 0x0f;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry,
  });
}

function decrement8(cpu: Cpu, operand: InstructionOperand): void {
  const current = cpu.readEightBitValue(operand, "DEC operand");
  const result = (current - 1) & 0xff;
  cpu.writeEightBitValue(operand, result);
  const halfCarry = (current & 0x0f) === 0;
  cpu.updateFlags({
    zero: result === 0,
    subtract: true,
    halfCarry,
  });
}

function increment16(cpu: Cpu, registerName: string): void {
  const value = cpu.readRegisterPairByName(registerName);
  cpu.writeRegisterPairByName(registerName, (value + 1) & 0xffff);
}

function decrement16(cpu: Cpu, registerName: string): void {
  const value = cpu.readRegisterPairByName(registerName);
  cpu.writeRegisterPairByName(registerName, (value - 1) & 0xffff);
}

function addToAccumulator(cpu: Cpu, value: number): void {
  const operand = value & 0xff;
  const registers = cpu.state.registers;
  const current = registers.a & 0xff;
  const sum = current + operand;
  const result = sum & 0xff;
  const halfCarry = (current & 0x0f) + (operand & 0x0f) > 0x0f;
  const carry = sum > 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry,
    carry,
  });
}

function addToAccumulatorWithCarry(cpu: Cpu, value: number): void {
  const operand = value & 0xff;
  const registers = cpu.state.registers;
  const current = registers.a & 0xff;
  const carryIn = cpu.state.flags.carry ? 1 : 0;
  const sum = current + operand + carryIn;
  const result = sum & 0xff;
  const halfCarry = (current & 0x0f) + (operand & 0x0f) + carryIn > 0x0f;
  const carry = sum > 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry,
    carry,
  });
}

function subtractFromAccumulator(cpu: Cpu, value: number): void {
  const operand = value & 0xff;
  const registers = cpu.state.registers;
  const current = registers.a & 0xff;
  const result = (current - operand) & 0xff;
  const borrow = current < operand;
  const halfBorrow = (current & 0x0f) < (operand & 0x0f);
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: true,
    halfCarry: halfBorrow,
    carry: borrow,
  });
}

function subtractFromAccumulatorWithCarry(cpu: Cpu, value: number): void {
  const operand = value & 0xff;
  const registers = cpu.state.registers;
  const current = registers.a & 0xff;
  const carryIn = cpu.state.flags.carry ? 1 : 0;
  const subtrahend = operand + carryIn;
  const result = (current - subtrahend) & 0xff;
  const borrow = current < subtrahend;
  const halfBorrow = (current & 0x0f) < (operand & 0x0f) + carryIn;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: true,
    halfCarry: halfBorrow,
    carry: borrow,
  });
}

function compareWithAccumulator(cpu: Cpu, value: number): void {
  const operand = value & 0xff;
  const current = cpu.state.registers.a & 0xff;
  const result = (current - operand) & 0xff;
  const borrow = current < operand;
  const halfBorrow = (current & 0x0f) < (operand & 0x0f);
  cpu.updateFlags({
    zero: result === 0,
    subtract: true,
    halfCarry: halfBorrow,
    carry: borrow,
  });
}

function addToRegisterHl(cpu: Cpu, value: number): void {
  const operand = value & 0xffff;
  const current = cpu.readRegisterPairByName("HL");
  const sum = current + operand;
  const result = sum & 0xffff;
  const halfCarry = (current & 0x0fff) + (operand & 0x0fff) > 0x0fff;
  const carry = sum > 0xffff;
  cpu.writeRegisterPairByName("HL", result);
  cpu.updateFlags({
    subtract: false,
    halfCarry,
    carry,
  });
}
