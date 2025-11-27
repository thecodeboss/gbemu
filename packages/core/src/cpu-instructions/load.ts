import { Cpu } from "../cpu.js";
import { OpcodeInstruction } from "../rom/types.js";
import { loadHlWithSpOffset } from "./sp-offset.js";
import {
  is16BitRegisterOperand,
  isEightBitRegisterOperand,
  isImmediate16Operand,
  isMemoryOperand,
  readImmediateOperand,
  readSignedImmediateOperand,
} from "./utils.js";

const STACK_REGISTER_NAMES = new Set(["AF", "BC", "DE", "HL"]);

export function executeLd(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operands = instruction.operands;
  if (operands.length === 3) {
    const [destination, firstSource, secondSource] = operands;
    if (
      destination?.meta.name === "HL" &&
      firstSource?.meta.name === "SP" &&
      secondSource?.meta.name === "e8"
    ) {
      const offset = readSignedImmediateOperand(
        secondSource,
        "LD HL,SP+e8 offset",
      );
      loadHlWithSpOffset(cpu, offset);
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

  if (destination.meta.name === "a16" && source.meta.name === "SP") {
    const address = destination.rawValue;
    if (address === null) {
      throw new Error("LD [a16],SP missing target address");
    }
    const value = cpu.state.registers.sp & 0xffff;
    cpu.writeWordToAddress(address, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (isEightBitRegisterOperand(destination)) {
    const value = cpu.readEightBitValue(source, "LD source");
    cpu.writeRegister8(destination.meta.name, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (isMemoryOperand(destination)) {
    const value = cpu.readEightBitValue(source, "LD source");
    cpu.writeEightBitValue(destination, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (is16BitRegisterOperand(destination) && isImmediate16Operand(source)) {
    const value = readImmediateOperand(source, "LD immediate value");
    cpu.writeRegisterPairByName(destination.meta.name, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (is16BitRegisterOperand(destination) && is16BitRegisterOperand(source)) {
    const value = cpu.readRegisterPairByName(source.meta.name);
    cpu.writeRegisterPairByName(destination.meta.name, value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(
    `LD operands not implemented: ${destination.meta.name}, ${source.meta.name}`,
  );
}

export function executePop(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("POP instruction missing register operand");
  }
  const registerName = operand.meta.name;
  if (!STACK_REGISTER_NAMES.has(registerName)) {
    throw new Error(`POP instruction unsupported register ${registerName}`);
  }
  const value = cpu.popWord(4);
  cpu.writeRegisterPairByName(registerName, value);
  cpu.setProgramCounter(nextPc);
}

export function executePush(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("PUSH instruction missing register operand");
  }
  const registerName = operand.meta.name;
  if (!STACK_REGISTER_NAMES.has(registerName)) {
    throw new Error(`PUSH instruction unsupported register ${registerName}`);
  }
  const value = cpu.readRegisterPairByName(registerName);
  cpu.pushWord(value, 8);
  cpu.setProgramCounter(nextPc);
}
