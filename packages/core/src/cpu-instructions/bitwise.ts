import { Cpu } from "../cpu.js";
import { OpcodeInstruction } from "../rom/types.js";

export function executeAnd(
  cpu: Cpu,
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
  cpu: Cpu,
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
  cpu: Cpu,
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

export function executeCpl(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  registers.a = ~registers.a & 0xff;
  cpu.updateFlags({
    subtract: true,
    halfCarry: true,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeCcf(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.updateFlags({
    subtract: false,
    halfCarry: false,
    carry: !cpu.state.flags.carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeScf(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.updateFlags({
    subtract: false,
    halfCarry: false,
    carry: true,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeBit(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = cpu.parseBitIndex(bitOperand, "BIT index");
  if (!targetOperand) {
    throw new Error("BIT instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "BIT target");
  const bitIsZero = ((value >> bitIndex) & 0x01) === 0;
  cpu.updateFlags({
    zero: bitIsZero,
    subtract: false,
    halfCarry: true,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRes(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = cpu.parseBitIndex(bitOperand, "RES index");
  if (!targetOperand) {
    throw new Error("RES instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "RES target");
  const result = value & ~(1 << bitIndex);
  cpu.writeEightBitValue(targetOperand, result);
  cpu.setProgramCounter(nextPc);
}

export function executeSet(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const [bitOperand, targetOperand] = instruction.operands;
  const bitIndex = cpu.parseBitIndex(bitOperand, "SET index");
  if (!targetOperand) {
    throw new Error("SET instruction missing target operand");
  }
  const value = cpu.readEightBitValue(targetOperand, "SET target");
  const result = value | (1 << bitIndex);
  cpu.writeEightBitValue(targetOperand, result);
  cpu.setProgramCounter(nextPc);
}

export function executeRl(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RL operand",
    (value) => cpu.rotateLeftThroughCarry(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRlc(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RLC operand",
    (value) => cpu.rotateLeftCircular(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRla(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateLeftThroughCarry(registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRlca(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateLeftCircular(registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRr(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RR operand",
    (value) => cpu.rotateRightThroughCarry(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRrc(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "RRC operand",
    (value) => cpu.rotateRightCircular(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRra(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateRightThroughCarry(registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeRrca(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const registers = cpu.state.registers;
  const { result, carry } = cpu.rotateRightCircular(registers.a);
  registers.a = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSla(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "SLA operand",
    (value) => cpu.shiftLeftArithmetic(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSra(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "SRA operand",
    (value) => cpu.shiftRightArithmetic(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSrl(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result, carry } = cpu.transformMutableOperand(
    operand,
    "SRL operand",
    (value) => cpu.shiftRightLogical(value),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry,
  });
  cpu.setProgramCounter(nextPc);
}

export function executeSwap(
  cpu: Cpu,
  instruction: OpcodeInstruction,
  nextPc: number,
): void {
  const operand = instruction.operands[0];
  const { result } = cpu.transformMutableOperand(
    operand,
    "SWAP operand",
    (value) => ({ result: cpu.swapNibbles(value), carry: false }),
  );
  cpu.updateFlags({
    zero: result === 0,
    subtract: false,
    halfCarry: false,
    carry: false,
  });
  cpu.setProgramCounter(nextPc);
}
