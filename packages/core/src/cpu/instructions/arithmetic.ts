import { RotateCpu } from "./rotate.js";
import { OpcodeInstruction } from "../../rom/types.js";

export abstract class ArithmeticCpu extends RotateCpu {
  protected executeAdd(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    if (!destination || !source) {
      throw new Error("ADD instruction missing operands");
    }

    if (destination.meta?.name === "A") {
      const value = this.readEightBitValue(source, "ADD source");
      this.addToAccumulator(value);
      this.setProgramCounter(nextPc);
      return;
    }

    if (destination.meta?.name === "HL") {
      const value = this.readRegisterPairOperand(source, "ADD HL source");
      this.addToRegisterHl(value);
      this.setProgramCounter(nextPc);
      return;
    }

    if (destination.meta?.name === "SP" && source.meta?.name === "e8") {
      const offset = this.readSignedImmediateOperand(
        source,
        "ADD SP,e8 offset",
      );
      this.addSignedImmediateToSp(offset);
      this.setProgramCounter(nextPc);
      return;
    }

    throw new Error(`ADD destination ${destination.meta?.name ?? "unknown"} not implemented`);
  }

  protected executeAdc(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    this.assertAccumulatorDestination(destination, "ADC");
    const value = this.readEightBitValue(source, "ADC source");
    this.addToAccumulatorWithCarry(value);
    this.setProgramCounter(nextPc);
  }

  protected executeSub(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    this.assertAccumulatorDestination(destination, "SUB");
    const value = this.readEightBitValue(source, "SUB source");
    this.subtractFromAccumulator(value);
    this.setProgramCounter(nextPc);
  }

  protected executeSbc(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    this.assertAccumulatorDestination(destination, "SBC");
    const value = this.readEightBitValue(source, "SBC source");
    this.subtractFromAccumulatorWithCarry(value);
    this.setProgramCounter(nextPc);
  }

  protected executeCp(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    this.assertAccumulatorDestination(destination, "CP");
    const value = this.readEightBitValue(source, "CP source");
    this.compareWithAccumulator(value);
    this.setProgramCounter(nextPc);
  }

  protected executeInc(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    if (!operand) {
      throw new Error("INC instruction missing operand");
    }

    if (this.isMemoryOperand(operand) || this.isEightBitRegisterOperand(operand)) {
      this.increment8(operand);
      this.setProgramCounter(nextPc);
      return;
    }

    if (this.is16BitRegisterOperand(operand)) {
      this.increment16(operand.meta.name);
      this.setProgramCounter(nextPc);
      return;
    }

    throw new Error(`INC operand ${operand.meta?.name ?? "unknown"} not implemented`);
  }

  protected executeDec(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    if (!operand) {
      throw new Error("DEC instruction missing operand");
    }

    if (this.isMemoryOperand(operand) || this.isEightBitRegisterOperand(operand)) {
      this.decrement8(operand);
      this.setProgramCounter(nextPc);
      return;
    }

    if (this.is16BitRegisterOperand(operand)) {
      this.decrement16(operand.meta.name);
      this.setProgramCounter(nextPc);
      return;
    }

    throw new Error(`DEC operand ${operand.meta?.name ?? "unknown"} not implemented`);
  }

  protected executeAnd(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    this.assertAccumulatorDestination(destination, "AND");
    const value = this.readEightBitValue(source, "AND source");
    const registers = this.state.registers;
    const result = registers.a & value & 0xff;
    registers.a = result;
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: true,
      carry: false,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeOr(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    this.assertAccumulatorDestination(destination, "OR");
    const value = this.readEightBitValue(source, "OR source");
    const registers = this.state.registers;
    const result = (registers.a | value) & 0xff;
    registers.a = result;
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry: false,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeXor(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const [destination, source] = instruction.operands;
    this.assertAccumulatorDestination(destination, "XOR");
    const value = this.readEightBitValue(source, "XOR source");
    const registers = this.state.registers;
    const result = (registers.a ^ value) & 0xff;
    registers.a = result;
    this.updateFlags({
      zero: result === 0,
      subtract: false,
      halfCarry: false,
      carry: false,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeCpl(nextPc: number): void {
    const registers = this.state.registers;
    registers.a = ~registers.a & 0xff;
    this.updateFlags({
      subtract: true,
      halfCarry: true,
    });
    this.setProgramCounter(nextPc);
  }

  protected executeDaa(nextPc: number): void {
    const registers = this.state.registers;
    const flags = this.state.flags;
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

    this.updateFlags({
      zero: (registers.a & 0xff) === 0,
      halfCarry: false,
      carry,
    });
    this.setProgramCounter(nextPc);
  }
}
