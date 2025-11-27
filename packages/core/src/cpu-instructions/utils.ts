import { InstructionOperand } from "../rom/types.js";
import { EIGHT_BIT_REGISTERS, SIXTEEN_BIT_REGISTERS } from "./constants.js";

export function assertAccumulatorDestination(
  operand: InstructionOperand | undefined,
  mnemonic: string,
): void {
  if (!operand || operand.meta.name !== "A") {
    throw new Error(`${mnemonic} instruction expects accumulator destination`);
  }
}

export function isEightBitRegisterOperand(
  operand: InstructionOperand | undefined,
): boolean {
  return Boolean(
    operand && operand.meta.imm && EIGHT_BIT_REGISTERS.has(operand.meta.name),
  );
}

export function is16BitRegisterOperand(
  operand: InstructionOperand | undefined,
): boolean {
  return Boolean(
    operand && operand.meta.imm && SIXTEEN_BIT_REGISTERS.has(operand.meta.name),
  );
}

export function isMemoryOperand(
  operand: InstructionOperand | undefined,
): boolean {
  if (!operand) {
    return false;
  }
  const { meta } = operand;
  if (meta.name === "HL" && !meta.imm) return true;
  if (!meta.imm && SIXTEEN_BIT_REGISTERS.has(meta.name)) return true;
  if (!meta.imm && meta.name === "C") return true;
  if (meta.name === "a16" || meta.name === "a8") return true;
  return false;
}

export function isImmediate16Operand(
  operand: InstructionOperand | undefined,
): boolean {
  return Boolean(operand && operand.meta.name === "n16");
}

export function readImmediateOperand(
  operand: InstructionOperand | undefined,
  description: string,
): number {
  if (!operand || operand.rawValue === null) {
    throw new Error(`Missing ${description}`);
  }
  return operand.rawValue & 0xffff;
}

export function readSignedImmediateOperand(
  operand: InstructionOperand | undefined,
  description: string,
): number {
  if (!operand) {
    throw new Error(`Missing ${description}`);
  }
  if (operand.meta.name !== "e8") {
    throw new Error(`Expected signed 8-bit operand for ${description}`);
  }
  if (operand.signedValue !== undefined && operand.signedValue !== null) {
    return operand.signedValue;
  }
  if (operand.rawValue === null) {
    throw new Error(`Missing ${description}`);
  }
  const raw = operand.rawValue & 0xff;
  return raw >= 0x80 ? raw - 0x100 : raw;
}
