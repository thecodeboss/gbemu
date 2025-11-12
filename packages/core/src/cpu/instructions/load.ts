import type { CpuBase } from "../base.js";
import { OpcodeInstruction } from "../../rom/types.js";

export function executeLd(
  cpu: CpuBase,
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
      const offset = cpu.readSignedImmediateOperand(
        secondSource,
        "LD HL,SP+e8 offset",
      );
      cpu.loadHlWithSpOffset(offset);
      cpu.setProgramCounter(nextPc);
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
    const value = cpu.state.registers.sp & 0xffff;
    cpu.writeWordToAddress(address, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (cpu.isEightBitRegisterOperand(destination)) {
    const value = cpu.readEightBitValue(source, "LD source");
    cpu.writeRegister8(destination.meta.name, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (cpu.isMemoryOperand(destination)) {
    const value = cpu.readEightBitValue(source, "LD source");
    cpu.writeEightBitValue(destination, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (
    cpu.is16BitRegisterOperand(destination) &&
    cpu.isImmediate16Operand(source)
  ) {
    const value = cpu.readImmediateOperand(source, "LD immediate value");
    cpu.writeRegisterPairByName(destination.meta.name, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (
    cpu.is16BitRegisterOperand(destination) &&
    cpu.is16BitRegisterOperand(source)
  ) {
    const value = cpu.readRegisterPairByName(source.meta.name);
    cpu.writeRegisterPairByName(destination.meta.name, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(
    `LD operands not implemented: ${destination.meta?.name ?? "unknown"}, ${
      source.meta?.name ?? "unknown"
    }`,
  );
}

export function executePop(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("POP instruction missing register operand");
  }
  const registerName = cpu.resolveStackRegister(operand);
  const value = cpu.popWord();
  cpu.writeRegisterPairByName(registerName, value);
  cpu.setProgramCounter(nextPc);
}

export function executePush(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("PUSH instruction missing register operand");
  }
  const registerName = cpu.resolveStackRegister(operand);
  const value = cpu.readRegisterPairByName(registerName);
  cpu.pushWord(value);
  cpu.setProgramCounter(nextPc);
}
