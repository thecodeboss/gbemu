import type { CpuBase } from "../base.js";
import { OpcodeInstruction } from "../../rom/types.js";

export function executeBit(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = cpu.parseBitIndex(bitOperand, "BIT index");
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = cpu.parseBitIndex(bitOperand, "RES index");
  if (!targetOperand) {
    throw new Error("RES instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "RES target");
  const result = value & ~(1 << bitIndex);
  cpu.writeEightBitValue(targetOperand, result);
  cpu.setProgramCounter(nextPc);
}

export function executeSet(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = cpu.parseBitIndex(bitOperand, "SET index");
  if (!targetOperand) {
    throw new Error("SET instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "SET target");
  const result = value | (1 << bitIndex);
  cpu.writeEightBitValue(targetOperand, result);
  cpu.setProgramCounter(nextPc);
}
