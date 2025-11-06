import {
  CB_PREFIXED_OPCODE_TABLE,
  UNPREFIXED_OPCODE_TABLE,
  OpcodeMeta,
  OpcodeOperandMeta,
} from "./opcode-tables.js";

export interface EmulatorRomInfo {
  title: string;
  cartridgeType: number;
  romSize: number;
  ramSize: number;
  cgbFlag: number;
  sgbFlag: number;
  destinationCode: number;
}

export function parseRomInfo(rom: Uint8Array): EmulatorRomInfo | null {
  if (rom.length < 0x150) {
    return null;
  }

  const titleBytes = rom.slice(0x134, 0x144);
  const decoder = new TextDecoder("ascii");
  const rawTitle = decoder.decode(titleBytes);
  const title = rawTitle.replace(/\0+$/u, "").trim() || "Untitled";

  const cartridgeType = rom[0x147] ?? 0;
  const romSizeCode = rom[0x148] ?? 0;
  const ramSizeCode = rom[0x149] ?? 0;
  const destinationCode = rom[0x14a] ?? 0;
  const cgbFlag = rom[0x143] ?? 0;
  const sgbFlag = rom[0x146] ?? 0;

  return {
    title,
    cartridgeType,
    romSize: decodeRomSize(romSizeCode),
    ramSize: decodeRamSize(ramSizeCode),
    cgbFlag,
    sgbFlag,
    destinationCode,
  };
}

const ENTRY_POINT = 0x100;
const NINTENDO_LOGO_START = 0x104;
const HEADER_START = 0x134;
const PROGRAM_START = 0x150;

interface HeaderField {
  readonly start: number;
  readonly end: number;
  readonly type: "string" | "bytes";
  readonly description: string;
  readonly detail?: (bytes: Uint8Array) => string | null;
}

const HEADER_FIELDS: readonly HeaderField[] = [
  { start: 0x134, end: 0x143, type: "string", description: "title" },
  {
    start: 0x144,
    end: 0x145,
    type: "bytes",
    description: "new license code",
  },
  { start: 0x146, end: 0x146, type: "bytes", description: "sgb flag" },
  { start: 0x147, end: 0x147, type: "bytes", description: "cartridge type" },
  {
    start: 0x148,
    end: 0x148,
    type: "bytes",
    description: "rom size",
    detail: (bytes) => describeRomSize(bytes[0]),
  },
  {
    start: 0x149,
    end: 0x149,
    type: "bytes",
    description: "ram size",
    detail: (bytes) => describeRamSize(bytes[0]),
  },
  {
    start: 0x14a,
    end: 0x14a,
    type: "bytes",
    description: "destination code",
  },
  { start: 0x14b, end: 0x14b, type: "bytes", description: "old license code" },
  { start: 0x14c, end: 0x14c, type: "bytes", description: "mask rom version" },
  { start: 0x14d, end: 0x14d, type: "bytes", description: "header checksum" },
  {
    start: 0x14e,
    end: 0x14f,
    type: "bytes",
    description: "global checksum",
  },
];

interface OperandState {
  readonly meta: OpcodeOperandMeta;
  readonly rawValue: number | null;
  readonly signedValue?: number;
  readonly relativeTarget?: number;
}

interface DisassembledInstruction {
  readonly listing: string;
  readonly length: number;
}

export function decodeRomSize(code: number): number {
  switch (code) {
    case 0x00:
      return 32 * 1024;
    case 0x01:
      return 64 * 1024;
    case 0x02:
      return 128 * 1024;
    case 0x03:
      return 256 * 1024;
    case 0x04:
      return 512 * 1024;
    case 0x05:
      return 1 * 1024 * 1024;
    case 0x06:
      return 2 * 1024 * 1024;
    case 0x07:
      return 4 * 1024 * 1024;
    case 0x08:
      return 8 * 1024 * 1024;
    case 0x52:
      return 1_179_648;
    case 0x53:
      return 1_310_720;
    case 0x54:
      return 1_572_864;
    default:
      return 0;
  }
}

export function decodeRamSize(code: number): number {
  switch (code) {
    case 0x00:
      return 0;
    case 0x01:
      return 2 * 1024;
    case 0x02:
      return 8 * 1024;
    case 0x03:
      return 32 * 1024;
    case 0x04:
      return 128 * 1024;
    case 0x05:
      return 64 * 1024;
    default:
      return 0;
  }
}

export function disassembleRom(rom: Uint8Array): Record<number, string> {
  if (rom.length <= ENTRY_POINT) {
    return {};
  }

  const listing = new Map<number, string>();

  disassembleRange(
    rom,
    ENTRY_POINT,
    Math.min(rom.length, NINTENDO_LOGO_START),
    listing
  );

  if (rom.length > NINTENDO_LOGO_START) {
    if (rom.length > NINTENDO_LOGO_START) {
      listing.set(NINTENDO_LOGO_START, "<Nintendo logo>");
    }
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
  target: Map<number, string>
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

    target.set(pc, instruction.listing);
    pc += length;
  }
}

function disassembleInstruction(
  rom: Uint8Array,
  pc: number
): DisassembledInstruction {
  const opcode = rom[pc];
  if (opcode === undefined) {
    return { listing: "", length: 0 };
  }

  if (opcode === 0xcb) {
    const next = rom[pc + 1];
    if (next === undefined) {
      return { listing: `db ${formatByte(opcode)}`, length: 1 };
    }

    const meta = CB_PREFIXED_OPCODE_TABLE[next] as OpcodeMeta | undefined;
    if (!meta || pc + meta.length > rom.length) {
      return { listing: `db ${formatByte(opcode)}`, length: 1 };
    }

    const operands = readOperandStates(meta, rom, pc + 2, pc);
    const formattedOperands = formatOperands(meta, operands);
    const listing =
      formattedOperands.length > 0
        ? `${meta.mnemonic} ${formattedOperands.join(",")}`
        : meta.mnemonic;

    return { listing, length: meta.length };
  }

  const meta = UNPREFIXED_OPCODE_TABLE[opcode] as OpcodeMeta | undefined;
  if (!meta || pc + meta.length > rom.length) {
    return { listing: `db ${formatByte(opcode)}`, length: 1 };
  }

  const operands = readOperandStates(meta, rom, pc + 1, pc);
  const formattedOperands = formatOperands(meta, operands);
  const listing =
    formattedOperands.length > 0
      ? `${meta.mnemonic} ${formattedOperands.join(",")}`
      : meta.mnemonic;

  return { listing, length: meta.length };
}

function readOperandStates(
  meta: OpcodeMeta,
  rom: Uint8Array,
  startOffset: number,
  pc: number
): OperandState[] {
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

function formatOperands(meta: OpcodeMeta, operands: OperandState[]): string[] {
  if (meta.mnemonic === "stop") {
    return [];
  }

  if (
    meta.mnemonic === "ld" &&
    operands.length === 3 &&
    operands[0]?.meta.name === "HL" &&
    operands[1]?.meta.name === "SP" &&
    operands[2]?.meta.name === "e8" &&
    typeof operands[2]?.signedValue === "number"
  ) {
    const signed = operands[2].signedValue as number;
    const sign = signed >= 0 ? "+" : "-";
    const magnitude = formatByte(Math.abs(signed));
    return ["hl", `sp${sign}${magnitude}`];
  }

  if (
    meta.mnemonic === "add" &&
    operands.length === 2 &&
    operands[0]?.meta.name === "SP" &&
    operands[1]?.meta.name === "e8" &&
    typeof operands[1]?.signedValue === "number"
  ) {
    const signed = operands[1].signedValue as number;
    const sign = signed >= 0 ? "+" : "-";
    const magnitude = formatByte(Math.abs(signed));
    return ["sp", `${sign}${magnitude}`];
  }

  const formatted = operands.map((operand) => formatOperand(meta, operand));
  return simplifyOperands(meta.mnemonic, formatted);
}

function formatOperand(meta: OpcodeMeta, operand: OperandState): string {
  const { meta: descriptor, rawValue, signedValue, relativeTarget } = operand;
  const { name } = descriptor;

  switch (name) {
    case "n8":
      return formatByte(rawValue ?? 0);
    case "n16":
      return formatWord(rawValue ?? 0);
    case "a16":
      if (descriptor.immediate) {
        return formatWord(rawValue ?? 0);
      }
      return `[${formatWord(rawValue ?? 0)}]`;
    case "a8":
      return `[$FF${formatByte(rawValue ?? 0).slice(1)}]`;
    case "e8":
      if (meta.mnemonic === "jr" && typeof relativeTarget === "number") {
        return formatWord(relativeTarget);
      }
      if (typeof signedValue === "number") {
        const sign = signedValue >= 0 ? "+" : "-";
        return `${sign}${formatByte(Math.abs(signedValue))}`;
      }
      return formatByte(rawValue ?? 0);
    default:
      break;
  }

  if (name.startsWith("$")) {
    return name.toLowerCase();
  }

  const text = name.toLowerCase();

  if (!descriptor.immediate) {
    if (descriptor.increment) {
      return `(${text}+)`;
    }
    if (descriptor.decrement) {
      return `(${text}-)`;
    }
    return `(${text})`;
  }

  return text;
}

function addHeaderEntries(rom: Uint8Array, target: Map<number, string>): void {
  for (const field of HEADER_FIELDS) {
    if (field.start >= rom.length) {
      break;
    }

    const effectiveEnd = Math.min(field.end, rom.length - 1);
    const bytes = rom.subarray(field.start, effectiveEnd + 1);
    if (bytes.length === 0) {
      continue;
    }

    const directive =
      field.type === "string"
        ? `db ${formatStringLiteral(bytes)}`
        : `db ${Array.from(bytes, (byte) => formatByte(byte)).join(",")}`;

    const commentRange = formatRangeBounds(
      field.start,
      field.start + bytes.length - 1
    );
    const detail = field.detail?.(bytes) ?? null;
    const comment =
      detail !== null
        ? `${commentRange} - ${field.description} (${detail})`
        : `${commentRange} - ${field.description}`;

    target.set(field.start, `${directive} ; ${comment}`);
  }
}

function formatStringLiteral(bytes: Uint8Array): string {
  let result = '"';

  for (const byte of bytes) {
    if (byte === 0x22) {
      result += '\\"';
    } else if (byte === 0x5c) {
      result += "\\\\";
    } else if (byte === 0x0a) {
      result += "\\n";
    } else if (byte === 0x0d) {
      result += "\\r";
    } else if (byte === 0x09) {
      result += "\\t";
    } else if (byte === 0x00) {
      result += "\\0";
    } else if (byte >= 0x20 && byte <= 0x7e) {
      result += String.fromCharCode(byte);
    } else {
      result += `\\x${toHex(byte, 2)}`;
    }
  }

  result += '"';
  return result;
}

function describeRomSize(byte: number | undefined): string | null {
  if (typeof byte !== "number") {
    return null;
  }
  const size = decodeRomSize(byte);
  if (size <= 0) {
    return null;
  }
  return formatMemorySize(size);
}

function describeRamSize(byte: number | undefined): string | null {
  if (typeof byte !== "number") {
    return null;
  }
  const size = decodeRamSize(byte);
  if (size <= 0) {
    return null;
  }
  return formatMemorySize(size);
}

function formatMemorySize(size: number): string {
  const mebibyte = 1024 * 1024;
  if (size % mebibyte === 0) {
    return `${size / mebibyte} MiB`;
  }
  if (size % 1024 === 0) {
    return `${size / 1024} KiB`;
  }
  return `${size} bytes`;
}

function addDataBytes(
  rom: Uint8Array,
  start: number,
  endExclusive: number,
  target: Map<number, string>
): void {
  for (let offset = start; offset < endExclusive; offset += 1) {
    const byte = rom[offset] ?? 0;
    target.set(offset, `db ${formatByte(byte)}`);
  }
}

function formatRangeBounds(start: number, end: number): string {
  if (start === end) {
    return formatAddress(start);
  }
  return `${formatAddress(start)}-${formatAddress(end)}`;
}

function formatAddress(address: number): string {
  return `0x${toHex(address & 0xffff, 4)}`;
}

function formatByte(value: number): string {
  return `$${toHex(value & 0xff, 2)}`;
}

function formatWord(value: number): string {
  return `$${toHex(value & 0xffff, 4)}`;
}

function toHex(value: number, width: number): string {
  return value.toString(16).toUpperCase().padStart(width, "0");
}

function simplifyOperands(mnemonic: string, operands: string[]): string[] {
  if (operands.length >= 2 && operands[0] === "a") {
    switch (mnemonic) {
      case "xor":
      case "or":
      case "and":
        return operands.slice(1);
      default:
        break;
    }
  }

  return operands;
}
