import { ControlCpu } from "./control.js";
import { OpcodeInstruction } from "../../rom/types.js";

export abstract class LoadCpu extends ControlCpu {
  protected executeLd(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operands = instruction.operands;
    if (operands.length === 3) {
      const [destination, firstSource, secondSource] = operands;
      if (
        destination?.meta?.name === "HL" &&
        firstSource?.meta?.name === "SP" &&
        secondSource?.meta?.name === "e8"
      ) {
        const offset = this.readSignedImmediateOperand(
          secondSource,
          "LD HL,SP+e8 offset",
        );
        this.loadHlWithSpOffset(offset);
        this.setProgramCounter(nextPc);
        return;
      }
      throw new Error("LD instruction pattern not implemented");
    }

    if (operands.length !== 2) {
      throw new Error("LD instruction pattern not implemented");
    }

    const [destination, source] = operands;
    if (!destination || !source) {
      throw new Error("LD instruction missing operands");
    }

    if (destination.meta?.name === "a16" && source.meta?.name === "SP") {
      const address = destination.rawValue;
      if (address === null) {
        throw new Error("LD [a16],SP missing target address");
      }
      const value = this.state.registers.sp & 0xffff;
      this.writeWordToAddress(address, value);
      this.setProgramCounter(nextPc);
      return;
    }

    if (this.isEightBitRegisterOperand(destination)) {
      const value = this.readEightBitValue(source, "LD source");
      this.writeRegister8(destination.meta.name, value);
      this.setProgramCounter(nextPc);
      return;
    }

    if (this.isMemoryOperand(destination)) {
      const value = this.readEightBitValue(source, "LD source");
      this.writeEightBitValue(destination, value);
      this.setProgramCounter(nextPc);
      return;
    }

    if (
      this.is16BitRegisterOperand(destination) &&
      this.isImmediate16Operand(source)
    ) {
      const value = this.readImmediateOperand(source, "LD immediate value");
      this.writeRegisterPairByName(destination.meta.name, value);
      this.setProgramCounter(nextPc);
      return;
    }

    if (
      this.is16BitRegisterOperand(destination) &&
      this.is16BitRegisterOperand(source)
    ) {
      const value = this.readRegisterPairByName(source.meta.name);
      this.writeRegisterPairByName(destination.meta.name, value);
      this.setProgramCounter(nextPc);
      return;
    }

    throw new Error(
      `LD operands not implemented: ${destination.meta?.name ?? "unknown"}, ${
        source.meta?.name ?? "unknown"
      }`,
    );
  }

  protected executePop(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    if (!operand) {
      throw new Error("POP instruction missing register operand");
    }
    const registerName = this.resolveStackRegister(operand);
    const value = this.popWord();
    this.writeRegisterPairByName(registerName, value);
    this.setProgramCounter(nextPc);
  }

  protected executePush(
    instruction: OpcodeInstruction,
    nextPc: number,
  ): void {
    const operand = instruction.operands[0];
    if (!operand) {
      throw new Error("PUSH instruction missing register operand");
    }
    const registerName = this.resolveStackRegister(operand);
    const value = this.readRegisterPairByName(registerName);
    this.pushWord(value);
    this.setProgramCounter(nextPc);
  }
}
