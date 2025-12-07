import { Cpu } from "../cpu.js";
import { InstructionOperand, OpcodeInstruction } from "../../rom/types.js";
import { assertAccumulatorDestination } from "./utils.js";

export function executeAnd(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  assertAccumulatorDestination(destination, "AND");
  const value = cpu.readEightBitValue(source, "AND source");
  const registers = cpu.state.registers;
  const result = registers.a & value & 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: true,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeOr(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  assertAccumulatorDestination(destination, "OR");
  const value = cpu.readEightBitValue(source, "OR source");
  const registers = cpu.state.registers;
  const result = (registers.a | value) & 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeXor(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  assertAccumulatorDestination(destination, "XOR");
  const value = cpu.readEightBitValue(source, "XOR source");
  const registers = cpu.state.registers;
  const result = (registers.a ^ value) & 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeCpl(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  registers.a = ~registers.a & 0xff;
  cpu.updateFlags({
    subtract: true,
    halfCarry: true,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeCcf(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.updateFlags({
    subtract: false,
    halfCarry: false,
    carry: !cpu.state.flags.carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeScf(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.updateFlags({
    subtract: false,
    halfCarry: false,
    carry: true,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeBit(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = parseBitIndex(bitOperand, "BIT index");
  if (!targetOperand) {
    throw new Error("BIT instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "BIT target");
  const bitIsZero = ((value >> bitIndex) & 0x01) === 0;
  cpu.updateFlags({
    zero: bitIsZero,
    subtract: false,
    halfCarry: true,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRes(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = parseBitIndex(bitOperand, "RES index");
  if (!targetOperand) {
    throw new Error("RES instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "RES target");
  const result = value & ~(1 << bitIndex);
  cpu.writeEightBitValue(targetOperand, result);
  cpu.setProgramCounter(nextPc);
}

export function executeSet(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = parseBitIndex(bitOperand, "SET index");
  if (!targetOperand) {
    throw new Error("SET instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "SET target");
  const result = value | (1 << bitIndex);
  cpu.writeEightBitValue(targetOperand, result);
  cpu.setProgramCounter(nextPc);
}

export function executeRl(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = transformMutableOperand(
    cpu,
    operand,
    "RL operand",
    (value) => rotateLeftThroughCarry(cpu, value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRlc(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = transformMutableOperand(
    cpu,
    operand,
    "RLC operand",
    (value) => rotateLeftCircular(cpu, value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRla(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = rotateLeftThroughCarry(cpu, registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRlca(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = rotateLeftCircular(cpu, registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRr(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = transformMutableOperand(
    cpu,
    operand,
    "RR operand",
    (value) => rotateRightThroughCarry(cpu, value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRrc(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = transformMutableOperand(
    cpu,
    operand,
    "RRC operand",
    (value) => rotateRightCircular(cpu, value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRra(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = rotateRightThroughCarry(cpu, registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRrca(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = rotateRightCircular(cpu, registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSla(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = transformMutableOperand(
    cpu,
    operand,
    "SLA operand",
    (value) => shiftLeftArithmetic(cpu, value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSra(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = transformMutableOperand(
    cpu,
    operand,
    "SRA operand",
    (value) => shiftRightArithmetic(cpu, value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSrl(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = transformMutableOperand(
    cpu,
    operand,
    "SRL operand",
    (value) => shiftRightLogical(cpu, value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSwap(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result } = transformMutableOperand(
    cpu,
    operand,
    "SWAP operand",
    (value) => ({ result: swapNibbles(cpu, value), carry: false }),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}

function parseBitIndex(
  operand: InstructionOperand | undefined,
  description: string,
): number {
  if (!operand) {
    throw new Error(`Missing ${description}`);
  }
  const index = Number.parseInt(operand.meta.name, 10);
  if (Number.isNaN(index) || index < 0 || index > 7) {
    throw new Error(`Invalid ${description}: ${operand.meta.name}`);
  }
  return index;
}

function transformMutableOperand(
  cpu: Cpu,
  operand: InstructionOperand | undefined,
  description: string,
  transform: (value: number) => { result: number; carry: boolean },
): { result: number; carry: boolean } {
  if (!operand) {
    throw new Error(`Missing ${description}`);
  }
  const currentValue = cpu.readEightBitValue(operand, description);
  const outcome = transform(currentValue & 0xff);
  const result = outcome.result & 0xff;
  cpu.writeEightBitValue(operand, result);
  return { result, carry: outcome.carry };
}

function rotateLeftThroughCarry(
  cpu: Cpu,
  value: number,
): { result: number; carry: boolean } {
  const carryIn = cpu.state.flags.carry ? 1 : 0;
  const carry = (value & 0x80) !== 0;
  const result = ((value << 1) | carryIn) & 0xff;
  return { result, carry };
}

function rotateLeftCircular(
  _cpu: Cpu,
  value: number,
): { result: number; carry: boolean } {
  const carry = (value & 0x80) !== 0;
  const result = ((value << 1) | (carry ? 1 : 0)) & 0xff;
  return { result, carry };
}

function rotateRightThroughCarry(
  cpu: Cpu,
  value: number,
): { result: number; carry: boolean } {
  const carryIn = cpu.state.flags.carry ? 1 : 0;
  const carry = (value & 0x01) !== 0;
  const result = ((carryIn << 7) | (value >> 1)) & 0xff;
  return { result, carry };
}

function rotateRightCircular(
  _cpu: Cpu,
  value: number,
): { result: number; carry: boolean } {
  const carry = (value & 0x01) !== 0;
  const result = ((carry ? 0x80 : 0) | (value >> 1)) & 0xff;
  return { result, carry };
}

function shiftLeftArithmetic(
  _cpu: Cpu,
  value: number,
): { result: number; carry: boolean } {
  const carry = (value & 0x80) !== 0;
  const result = (value << 1) & 0xff;
  return { result, carry };
}

function shiftRightArithmetic(
  _cpu: Cpu,
  value: number,
): { result: number; carry: boolean } {
  const carry = (value & 0x01) !== 0;
  const result = ((value & 0x80) | (value >> 1)) & 0xff;
  return { result, carry };
}

function shiftRightLogical(
  _cpu: Cpu,
  value: number,
): { result: number; carry: boolean } {
  const carry = (value & 0x01) !== 0;
  const result = (value >> 1) & 0x7f;
  return { result, carry };
}

function swapNibbles(_cpu: Cpu, value: number): number {
  const upper = (value & 0xf0) >> 4;
  const lower = value & 0x0f;
  return ((lower << 4) | upper) & 0xff;
}
