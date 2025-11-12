import type { CpuBase } from "../base.js";
import { InstructionOperand, OpcodeInstruction } from "../../rom/types.js";

export function executeCall(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [first, second] = instruction.operands;
  let conditionName: string | null = null;
  let targetOperand: InstructionOperand | undefined = first;

  if (instruction.operands.length === 2) {
    conditionName = first?.meta?.name ?? null;
    targetOperand = second;
  }

  if (conditionName && !cpu.evaluateCondition(conditionName)) {
    cpu.setProgramCounter(nextPc);
    return;
  }

  const target = cpu.readImmediateOperand(targetOperand, "call target");
  cpu.pushWord(nextPc);
  cpu.setProgramCounter(target);
}

export function executeJump(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const { operands } = instruction;
  if (operands.length === 1 && operands[0]?.meta?.name === "HL") {
    cpu.setProgramCounter(cpu.readRegisterPairHL());
    return;
  }

  let conditionName: string | null = null;
  let targetOperand: InstructionOperand | undefined = operands[0];

  if (operands.length === 2) {
    conditionName = operands[0]?.meta?.name ?? null;
    targetOperand = operands[1];
  }

  if (conditionName && !cpu.evaluateCondition(conditionName)) {
    cpu.setProgramCounter(nextPc);
    return;
  }

  const target = cpu.readImmediateOperand(targetOperand, "jump target");
  cpu.setProgramCounter(target);
}

export function executeRelativeJump(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operands = instruction.operands;
  const offsetOperand = operands[operands.length - 1];

  if (!offsetOperand || offsetOperand.meta?.name !== "e8") {
    throw new Error("JR instruction missing 8-bit signed offset operand");
  }

  let conditionName: string | null = null;
  if (operands.length === 2) {
    conditionName = operands[0]?.meta?.name ?? null;
  }

  if (conditionName && !cpu.evaluateCondition(conditionName)) {
    cpu.setProgramCounter(nextPc);
    return;
  }

  const target = offsetOperand.relativeTarget ?? null;
  if (target === null) {
    throw new Error("JR instruction missing relative target");
  }

  cpu.setProgramCounter(target);
}

export function executeReturn(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const conditionOperand = instruction.operands[0];
  if (conditionOperand) {
    const conditionName = conditionOperand.meta?.name;
    if (!conditionName) {
      throw new Error("RET condition operand missing metadata");
    }
    if (!cpu.evaluateCondition(conditionName)) {
      cpu.setProgramCounter(nextPc);
      return;
    }
  }

  const address = cpu.popWord();
  cpu.setProgramCounter(address);
}

export function executeReti(cpu: CpuBase): void {
  const address = cpu.popWord();
  cpu.state.ime = true;
  cpu.setProgramCounter(address);
}

export function executeRst(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const vectorOperand = instruction.operands[0];
  if (!vectorOperand) {
    throw new Error("RST instruction missing target vector");
  }
  const vectorName = vectorOperand.meta?.name;
  if (!vectorName) {
    throw new Error("RST vector operand missing metadata");
  }
  const vector = cpu.parseRstVector(vectorName);
  cpu.pushWord(nextPc);
  cpu.setProgramCounter(vector);
}

export function executeStop(cpu: CpuBase, nextPc: number): void {
  cpu.state.stopped = true;
  cpu.state.halted = true;
  cpu.setProgramCounter(nextPc);
}

export function executeHalt(cpu: CpuBase, nextPc: number): void {
  cpu.state.halted = true;
  cpu.state.stopped = false;
  cpu.setProgramCounter(nextPc);
}

export function executeDi(cpu: CpuBase, nextPc: number): void {
  cpu.state.ime = false;
  cpu.setProgramCounter(nextPc);
}

export function executeEi(cpu: CpuBase, nextPc: number): void {
  cpu.state.ime = true;
  cpu.setProgramCounter(nextPc);
}
