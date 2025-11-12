import { CpuBase } from "../base.js";
import { InstructionOperand, OpcodeInstruction } from "../../rom/types.js";

export abstract class ControlCpu extends CpuBase {
  protected executeCall(
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

    if (conditionName && !this.evaluateCondition(conditionName)) {
      this.setProgramCounter(nextPc);
      return;
    }

    const target = this.readImmediateOperand(targetOperand, "call target");
    this.pushWord(nextPc);
    this.setProgramCounter(target);
  }

  protected executeJump(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const { operands } = instruction;
    if (operands.length === 1 && operands[0]?.meta?.name === "HL") {
      this.setProgramCounter(this.readRegisterPairHL());
      return;
    }

    let conditionName: string | null = null;
    let targetOperand: InstructionOperand | undefined = operands[0];

    if (operands.length === 2) {
      conditionName = operands[0]?.meta?.name ?? null;
      targetOperand = operands[1];
    }

    if (conditionName && !this.evaluateCondition(conditionName)) {
      this.setProgramCounter(nextPc);
      return;
    }

    const target = this.readImmediateOperand(targetOperand, "jump target");
    this.setProgramCounter(target);
  }

  protected executeRelativeJump(
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

    if (conditionName && !this.evaluateCondition(conditionName)) {
      this.setProgramCounter(nextPc);
      return;
    }

    const target = offsetOperand.relativeTarget ?? null;
    if (target === null) {
      throw new Error("JR instruction missing relative target");
    }

    this.setProgramCounter(target);
  }

  protected executeReturn(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const conditionOperand = instruction.operands[0];
    if (conditionOperand) {
      const conditionName = conditionOperand.meta?.name;
      if (!conditionName) {
        throw new Error("RET condition operand missing metadata");
      }
      if (!this.evaluateCondition(conditionName)) {
        this.setProgramCounter(nextPc);
        return;
      }
    }

    const address = this.popWord();
    this.setProgramCounter(address);
  }

  protected executeReti(): void {
    const address = this.popWord();
    this.state.ime = true;
    this.setProgramCounter(address);
  }

  protected executeRst(
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
    const vector = this.parseRstVector(vectorName);
    this.pushWord(nextPc);
    this.setProgramCounter(vector);
  }

  protected executeStop(nextPc: number): void {
    this.state.stopped = true;
    this.state.halted = true;
    this.setProgramCounter(nextPc);
  }

  protected executeHalt(nextPc: number): void {
    this.state.halted = true;
    this.state.stopped = false;
    this.setProgramCounter(nextPc);
  }

  protected executeDi(nextPc: number): void {
    this.state.ime = false;
    this.setProgramCounter(nextPc);
  }

  protected executeEi(nextPc: number): void {
    this.state.ime = true;
    this.setProgramCounter(nextPc);
  }
}
