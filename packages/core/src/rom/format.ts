import { OpcodeMeta } from "../opcode-tables.js";
import { HeaderInstruction, Instruction, InstructionOperand } from "./types.js";

export function formatDisassembledRom(
  disassembly: Record<number, Instruction>,
): Record<number, string> {
  const formattedEntries = Object.entries(disassembly).map(
    ([offsetText, instruction]) => {
      const offset = Number(offsetText);
      return [offset, formatInstruction(offset, instruction)] as const;
    },
  );
  return Object.fromEntries(formattedEntries);
}

function formatInstruction(offset: number, instruction: Instruction): string {
  switch (instruction.type) {
    case "opcode": {
      const operands = formatOperands(instruction.meta, instruction.operands);
      return operands.length > 0
        ? `${instruction.mnemonic} ${operands.join(",")}`
        : instruction.mnemonic;
    }
    case "data":
      return `db ${formatByte(instruction.value)}`;
    case "header":
      return formatHeaderInstruction(offset, instruction);
    case "annotation":
      return instruction.description;
    default:
      return "";
  }
}

function formatOperands(
  meta: OpcodeMeta,
  operands: InstructionOperand[],
): string[] {
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

function formatOperand(meta: OpcodeMeta, operand: InstructionOperand): string {
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

function formatHeaderInstruction(
  offset: number,
  instruction: HeaderInstruction,
): string {
  const directive =
    instruction.dataType === "string"
      ? `db ${formatStringLiteral(instruction.bytes)}`
      : `db ${Array.from(instruction.bytes, (byte) => formatByte(byte)).join(
          ",",
        )}`;

  const end = offset + instruction.length - 1;
  const commentRange = formatRangeBounds(offset, end);
  const detail = instruction.detail;
  const comment =
    detail !== null
      ? `${commentRange} - ${instruction.description} (${detail})`
      : `${commentRange} - ${instruction.description}`;

  return `${directive} ; ${comment}`;
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
