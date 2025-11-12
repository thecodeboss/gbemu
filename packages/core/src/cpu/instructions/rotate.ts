import { BitCpu } from "./bit.js";
import { OpcodeInstruction } from "../../rom/types.js";

export abstract class RotateCpu extends BitCpu {
  protected executeRl(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result, carry } = this.transformMutableOperand(
      operand,
      "RL operand",
      (value) => this.rotateLeftThroughCarry(value),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRlc(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result, carry } = this.transformMutableOperand(
      operand,
      "RLC operand",
      (value) => this.rotateLeftCircular(value),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRla(nextPc: number): void {
    const registers = this.state.registers;
    const { result, carry } = this.rotateLeftThroughCarry(registers.a);
    registers.a = result;
    this.updateFlags({
      zero: false,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRlca(nextPc: number): void {
    const registers = this.state.registers;
    const { result, carry } = this.rotateLeftCircular(registers.a);
    registers.a = result;
    this.updateFlags({
      zero: false,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRr(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result, carry } = this.transformMutableOperand(
      operand,
      "RR operand",
      (value) => this.rotateRightThroughCarry(value),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRrc(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result, carry } = this.transformMutableOperand(
      operand,
      "RRC operand",
      (value) => this.rotateRightCircular(value),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRra(nextPc: number): void {
    const registers = this.state.registers;
    const { result, carry } = this.rotateRightThroughCarry(registers.a);
    registers.a = result;
    this.updateFlags({
      zero: false,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRrca(nextPc: number): void {
    const registers = this.state.registers;
    const { result, carry } = this.rotateRightCircular(registers.a);
    registers.a = result;
    this.updateFlags({
      zero: false,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeSla(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result, carry } = this.transformMutableOperand(
      operand,
      "SLA operand",
      (value) => this.shiftLeftArithmetic(value),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeSra(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result, carry } = this.transformMutableOperand(
      operand,
      "SRA operand",
      (value) => this.shiftRightArithmetic(value),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeSrl(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result, carry } = this.transformMutableOperand(
      operand,
      "SRL operand",
      (value) => this.shiftRightLogical(value),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeSwap(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    const { result } = this.transformMutableOperand(
      operand,
      "SWAP operand",
      (value) => ({ result: this.swapNibbles(value), carry: false }),
    );
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry: false,
    });
    this.setProgramCounter(nextPc);
  }
}
