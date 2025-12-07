import { Cpu } from "../cpu.js";

function computeSpOffsetResult(
  cpu: Cpu,
  offset: number,
): {
  result: number;
  halfCarry: boolean;
  carry: boolean;
} {
  const registers = cpu.state.registers;
  const sp = registers.sp & 0xffff;
  const signedOffset = (offset << 24) >> 24;
  const unsignedOffset = offset & 0xff;
  const result = (sp + signedOffset) & 0xffff;
  const halfCarry = (sp & 0x0f) + (unsignedOffset & 0x0f) > 0x0f;
  const carry = (sp & 0xff) + unsignedOffset > 0xff;
  return { result, halfCarry, carry };
}

export function addSignedImmediateToSp(cpu: Cpu, offset: number): void {
  const { result, halfCarry, carry } = computeSpOffsetResult(cpu, offset);
  cpu.state.registers.sp = result;
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry,
    carry,
  });
}

export function loadHlWithSpOffset(cpu: Cpu, offset: number): void {
  const { result, halfCarry, carry } = computeSpOffsetResult(cpu, offset);
  cpu.writeRegisterPairByName("HL", result);
  cpu.updateFlags({
    zero: false,
    subtract: false,
    halfCarry,
    carry,
  });
}
