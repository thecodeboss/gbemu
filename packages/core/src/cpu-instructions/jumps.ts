import { Cpu } from "../cpu.js";
import { InstructionOperand, OpcodeInstruction } from "../rom/types.js";

export function executeCall(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [first, second] = instruction.operands;
  let conditionName: string | null = null;
  let targetOperand: InstructionOperand | undefined = first;

  if (instruction.operands.length === 2) {
    conditionName = first?.meta.name ?? null;
    targetOperand = second;
  }

  if (conditionName) {
    const conditionTaken = cpu.evaluateCondition(conditionName);
    cpu.setConditionalExtraCycles(instruction.opcode, conditionTaken);
    if (!conditionTaken) {
      cpu.setProgramCounter(nextPc);
      return;
    }
  }

  const target = cpu.readImmediateOperand(targetOperand, "call target");
  cpu.pushWord(nextPc, 16);
  cpu.setProgramCounter(target);
}

export function executeJump(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const { operands } = instruction;
  if (operands.length === 1 && operands[0]?.meta.name === "HL") {
    cpu.setProgramCounter(cpu.readRegisterPairHL());
    return;
  }

  let conditionName: string | null = null;
  let targetOperand: InstructionOperand | undefined = operands[0];

  if (operands.length === 2) {
    conditionName = operands[0]?.meta.name ?? null;
    targetOperand = operands[1];
  }

  if (conditionName) {
    const conditionTaken = cpu.evaluateCondition(conditionName);
    cpu.setConditionalExtraCycles(instruction.opcode, conditionTaken);
    if (!conditionTaken) {
      cpu.setProgramCounter(nextPc);
      return;
    }
  }

  const target = cpu.readImmediateOperand(targetOperand, "jump target");
  cpu.setProgramCounter(target);
}

export function executeRelativeJump(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operands = instruction.operands;
  const offsetOperand = operands[operands.length - 1];

  if (!offsetOperand || offsetOperand.meta.name !== "e8") {
    throw new Error("JR instruction missing 8-bit signed offset operand");
  }

  let conditionName: string | null = null;
  if (operands.length === 2) {
    conditionName = operands[0]?.meta.name ?? null;
  }

  if (conditionName) {
    const conditionTaken = cpu.evaluateCondition(conditionName);
    cpu.setConditionalExtraCycles(instruction.opcode, conditionTaken);
    if (!conditionTaken) {
      cpu.setProgramCounter(nextPc);
      return;
    }
  }

  const target = offsetOperand.relativeTarget ?? null;
  if (target === null) {
    throw new Error("JR instruction missing relative target");
  }

  cpu.setProgramCounter(target);
}

export function executeReturn(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const conditionOperand = instruction.operands[0];
  if (conditionOperand) {
    const conditionName = conditionOperand.meta.name;
    const conditionTaken = cpu.evaluateCondition(conditionName);
    cpu.setConditionalExtraCycles(instruction.opcode, conditionTaken);
    if (!conditionTaken) {
      cpu.setProgramCounter(nextPc);
      return;
    }
  }

  const firstReadTicksAhead = conditionOperand ? 8 : 4;
  const address = cpu.popWord(firstReadTicksAhead);
  cpu.setProgramCounter(address);
}

export function executeReti(cpu: Cpu): void {
  const address = cpu.popWord(4);
  cpu.state.ime = true;
  cpu.setProgramCounter(address);
}

export function executeRst(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const vectorOperand = instruction.operands[0];
  if (!vectorOperand) {
    throw new Error("RST instruction missing target vector");
  }

  const target = cpu.parseRstVector(vectorOperand.meta.name);
  cpu.pushWord(nextPc, 8);
  cpu.setProgramCounter(target);
}
