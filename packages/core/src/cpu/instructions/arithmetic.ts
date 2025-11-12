import type { CpuBase } from "../base.js";
import { OpcodeInstruction } from "../../rom/types.js";

export function executeAdd(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  if (!destination || !source) {
    throw new Error("ADD instruction missing operands");
  }

  if (destination.meta?.name === "A") {
    const value = cpu.readEightBitValue(source, "ADD source");
    cpu.addToAccumulator(value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (destination.meta?.name === "HL") {
    const value = cpu.readRegisterPairOperand(source, "ADD HL source");
    cpu.addToRegisterHl(value);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (destination.meta?.name === "SP" && source.meta?.name === "e8") {
    const offset = cpu.readSignedImmediateOperand(
      source,
      "ADD SP,e8 offset",
    );
    cpu.addSignedImmediateToSp(offset);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(`ADD destination ${destination.meta?.name ?? "unknown"} not implemented`);
}

export function executeAdc(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  cpu.assertAccumulatorDestination(destination, "ADC");
  const value = cpu.readEightBitValue(source, "ADC source");
  cpu.addToAccumulatorWithCarry(value);
  cpu.setProgramCounter(nextPc);
}

export function executeSub(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  cpu.assertAccumulatorDestination(destination, "SUB");
  const value = cpu.readEightBitValue(source, "SUB source");
  cpu.subtractFromAccumulator(value);
  cpu.setProgramCounter(nextPc);
}

export function executeSbc(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  cpu.assertAccumulatorDestination(destination, "SBC");
  const value = cpu.readEightBitValue(source, "SBC source");
  cpu.subtractFromAccumulatorWithCarry(value);
  cpu.setProgramCounter(nextPc);
}

export function executeCp(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  cpu.assertAccumulatorDestination(destination, "CP");
  const value = cpu.readEightBitValue(source, "CP source");
  cpu.compareWithAccumulator(value);
  cpu.setProgramCounter(nextPc);
}

export function executeInc(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("INC instruction missing operand");
  }

  if (cpu.isMemoryOperand(operand) || cpu.isEightBitRegisterOperand(operand)) {
    cpu.increment8(operand);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (cpu.is16BitRegisterOperand(operand)) {
    cpu.increment16(operand.meta.name);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(`INC operand ${operand.meta?.name ?? "unknown"} not implemented`);
}

export function executeDec(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  if (!operand) {
    throw new Error("DEC instruction missing operand");
  }

  if (cpu.isMemoryOperand(operand) || cpu.isEightBitRegisterOperand(operand)) {
    cpu.decrement8(operand);
    cpu.setProgramCounter(nextPc);
    return;
  }

  if (cpu.is16BitRegisterOperand(operand)) {
    cpu.decrement16(operand.meta.name);
    cpu.setProgramCounter(nextPc);
    return;
  }

  throw new Error(`DEC operand ${operand.meta?.name ?? "unknown"} not implemented`);
}

export function executeAnd(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  cpu.assertAccumulatorDestination(destination, "AND");
  const value = cpu.readEightBitValue(source, "AND source");
  const registers = cpu.state.registers;
  const result = registers.a & value & 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: true,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeOr(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  cpu.assertAccumulatorDestination(destination, "OR");
  const value = cpu.readEightBitValue(source, "OR source");
  const registers = cpu.state.registers;
  const result = (registers.a | value) & 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeXor(
  cpu: CpuBase,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [destination, source] = instruction.operands;
  cpu.assertAccumulatorDestination(destination, "XOR");
  const value = cpu.readEightBitValue(source, "XOR source");
  const registers = cpu.state.registers;
  const result = (registers.a ^ value) & 0xff;
  registers.a = result;
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeCpl(cpu: CpuBase, nextPc: number): void {
  const registers = cpu.state.registers;
  registers.a = ~registers.a & 0xff;
  cpu.updateFlags({
    subtract: true,
    halfCarry: true,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeDaa(cpu: CpuBase, nextPc: number): void {
  const registers = cpu.state.registers;
  const flags = cpu.state.flags;
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

  cpu.updateFlags({
    zero: (registers.a & 0xff) === 0,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}
