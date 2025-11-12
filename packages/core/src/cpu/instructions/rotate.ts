import type { CpuBase } from "../base.js";
import { OpcodeInstruction } from "../../rom/types.js";

export function executeRl(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RL operand",
    (value) => cpu.rotateLeftThroughCarry(value),
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RLC operand",
    (value) => cpu.rotateLeftCircular(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRla(cpu: CpuBase, nextPc: number): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateLeftThroughCarry(registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRlca(cpu: CpuBase, nextPc: number): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateLeftCircular(registers.a);
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RR operand",
    (value) => cpu.rotateRightThroughCarry(value),
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RRC operand",
    (value) => cpu.rotateRightCircular(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRra(cpu: CpuBase, nextPc: number): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateRightThroughCarry(registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRrca(cpu: CpuBase, nextPc: number): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateRightCircular(registers.a);
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "SLA operand",
    (value) => cpu.shiftLeftArithmetic(value),
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "SRA operand",
    (value) => cpu.shiftRightArithmetic(value),
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "SRL operand",
    (value) => cpu.shiftRightLogical(value),
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
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result } = cpu.transformMutableOperand(
    operand,
    "SWAP operand",
    (value) => ({ result: cpu.swapNibbles(value), carry: false }),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}
