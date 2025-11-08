import {
  CB_PREFIXED_OPCODE_TABLE,
  UNPREFIXED_OPCODE_TABLE,
  OpcodeMeta,
} from "../opcode-tables.js";
import {
  ENTRY_POINT,
  HEADER_FIELDS,
  HEADER_START,
  NINTENDO_LOGO_START,
  PROGRAM_START,
} from "./constants.js";
import {
  AnnotationInstruction,
  DataInstruction,
  HeaderInstruction,
  Instruction,
  InstructionOperand,
  OpcodeInstruction,
} from "./types.js";

export function disassembleRom(rom: Uint8Array): Record<number, Instruction> {
  if (rom.length <= ENTRY_POINT) {
    return {};
  }

  const listing = new Map<number, Instruction>();

  disassembleRange(
    rom,
    ENTRY_POINT,
    Math.min(rom.length, NINTENDO_LOGO_START),
    listing,
  );

  if (rom.length > NINTENDO_LOGO_START) {
    const logoAnnotation: AnnotationInstruction = {
      type: "annotation",
      length: 0,
      description: "<Nintendo logo>",
    };
    listing.set(NINTENDO_LOGO_START, logoAnnotation);
  }

  if (rom.length > HEADER_START) {
    addHeaderEntries(rom, listing);
  }

  if (rom.length > PROGRAM_START) {
    disassembleRange(rom, PROGRAM_START, rom.length, listing);
  }

  return Object.fromEntries(listing.entries());
}

function disassembleRange(
  rom: Uint8Array,
  start: number,
  endExclusive: number,
  target: Map<number, Instruction>,
): void {
  if (start >= endExclusive) {
    return;
  }

  let pc = start;

  while (pc < endExclusive) {
    const instruction = disassembleInstruction(rom, pc);
    const length = instruction.length > 0 ? instruction.length : 1;

    if (pc + length > endExclusive || instruction.length <= 0) {
      addDataBytes(rom, pc, endExclusive, target);
      break;
    }

    target.set(pc, instruction);
    pc += length;
  }
}

export function disassembleInstruction(
  rom: Uint8Array,
  pc: number,
): Instruction {
  const opcode = rom[pc];
  if (opcode === undefined) {
    return createDataInstruction(0);
  }

  if (opcode === 0xcb) {
    const next = rom[pc + 1];
    if (next === undefined) {
      return createDataInstruction(opcode);
    }

    const meta = CB_PREFIXED_OPCODE_TABLE[next] as OpcodeMeta | undefined;
    if (!meta || pc + meta.length > rom.length) {
      return createDataInstruction(opcode);
    }

    const operands = readOperandStates(meta, rom, pc + 2, pc);
    return createOpcodeInstruction(meta, operands, {
      opcode: next,
      prefixed: true,
      bytes: rom.slice(pc, pc + meta.length),
    });
  }

  const meta = UNPREFIXED_OPCODE_TABLE[opcode] as OpcodeMeta | undefined;
  if (!meta || pc + meta.length > rom.length) {
    return createDataInstruction(opcode);
  }

  const operands = readOperandStates(meta, rom, pc + 1, pc);
  return createOpcodeInstruction(meta, operands, {
    opcode,
    prefixed: false,
    bytes: rom.slice(pc, pc + meta.length),
  });
}

function readOperandStates(
  meta: OpcodeMeta,
  rom: Uint8Array,
  startOffset: number,
  pc: number,
): InstructionOperand[] {
  let cursor = startOffset;

  return meta.operands.map((operand) => {
    let rawValue: number | null = null;

    if (operand.bytes === 1) {
      rawValue = rom[cursor] ?? 0;
      cursor += 1;
    } else if (operand.bytes === 2) {
      const low = rom[cursor] ?? 0;
      const high = rom[cursor + 1] ?? 0;
      rawValue = low | (high << 8);
      cursor += 2;
    }

    if (operand.name === "e8" && rawValue !== null) {
      const signedValue = rawValue >= 0x80 ? rawValue - 0x100 : rawValue;
      const relativeTarget = (pc + meta.length + signedValue) & 0xffff;
      return {
        meta: operand,
        rawValue,
        signedValue,
        relativeTarget,
      };
    }

    return {
      meta: operand,
      rawValue,
    };
  });
}

function addHeaderEntries(
  rom: Uint8Array,
  target: Map<number, Instruction>,
): void {
  for (const field of HEADER_FIELDS) {
    if (field.start >= rom.length) {
      break;
    }

    const effectiveEnd = Math.min(field.end, rom.length - 1);
    const bytes = rom.subarray(field.start, effectiveEnd + 1);
    if (bytes.length === 0) {
      continue;
    }

    const detail = field.detail?.(bytes) ?? null;

    const headerInstruction: HeaderInstruction = {
      type: "header",
      length: bytes.length,
      bytes,
      dataType: field.type,
      description: field.description,
      detail,
    };

    target.set(field.start, headerInstruction);
  }
}

function addDataBytes(
  rom: Uint8Array,
  start: number,
  endExclusive: number,
  target: Map<number, Instruction>,
): void {
  for (let offset = start; offset < endExclusive; offset += 1) {
    const byte = rom[offset] ?? 0;
    target.set(offset, createDataInstruction(byte));
  }
}

function createDataInstruction(value: number): DataInstruction {
  return {
    type: "data",
    length: 1,
    value: value & 0xff,
  };
}

function createOpcodeInstruction(
  meta: OpcodeMeta,
  operands: InstructionOperand[],
  options: { opcode: number; prefixed: boolean; bytes: Uint8Array },
): OpcodeInstruction {
  return {
    type: "opcode",
    length: meta.length,
    opcode: options.opcode,
    prefixed: options.prefixed,
    mnemonic: meta.mnemonic,
    meta,
    operands,
    bytes: options.bytes,
  };
}
