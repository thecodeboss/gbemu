import { LoadCpu } from "./load.js";
import { OpcodeInstruction } from "../../rom/types.js";

export abstract class BitCpu extends LoadCpu {
  protected executeBit(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [bitOperand, targetOperand] = instruction.operands;
    const bitIndex = this.parseBitIndex(bitOperand, "BIT index");
    if (!targetOperand) {
      throw new Error("BIT instruction missing target operand");
    }
    const value = this.readEightBitValue(targetOperand, "BIT target");
    const bitIsZero = ((value >> bitIndex) & 0x01) === 0;
    this.updateFlags({
      zero: bitIsZero,
      subtract: false,
      halfCarry: true,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeRes(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [bitOperand, targetOperand] = instruction.operands;
    const bitIndex = this.parseBitIndex(bitOperand, "RES index");
    if (!targetOperand) {
      throw new Error("RES instruction missing target operand");
    }
    const value = this.readEightBitValue(targetOperand, "RES target");
    const result = value & ~(1 << bitIndex);
    this.writeEightBitValue(targetOperand, result);
    this.setProgramCounter(nextPc);
  }

  protected executeSet(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [bitOperand, targetOperand] = instruction.operands;
    const bitIndex = this.parseBitIndex(bitOperand, "SET index");
    if (!targetOperand) {
      throw new Error("SET instruction missing target operand");
    }
    const value = this.readEightBitValue(targetOperand, "SET target");
    const result = value | (1 << bitIndex);
    this.writeEightBitValue(targetOperand, result);
    this.setProgramCounter(nextPc);
  }
}
