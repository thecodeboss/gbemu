export interface OpcodeOperandMeta {
  readonly name: string;
  readonly bytes?: number | null;
  readonly imm?: boolean;
  readonly inc?: boolean;
  readonly dec?: boolean;
}

export interface OpcodeMeta {
  readonly m: string;
  readonly len: number;
  readonly c: number;
  readonly ops: readonly OpcodeOperandMeta[];
}

const HL_MEMORY: OpcodeOperandMeta = { name: "HL" };
const HL_INC_MEMORY: OpcodeOperandMeta = { name: "HL", inc: true };
const HL_DEC_MEMORY: OpcodeOperandMeta = { name: "HL", dec: true };

const REG8_OPERANDS: readonly OpcodeOperandMeta[] = [
  { name: "B", imm: true },
  { name: "C", imm: true },
  { name: "D", imm: true },
  { name: "E", imm: true },
  { name: "H", imm: true },
  { name: "L", imm: true },
  HL_MEMORY,
  { name: "A", imm: true },
];

const RP_OPERANDS: readonly OpcodeOperandMeta[] = [
  { name: "BC", imm: true },
  { name: "DE", imm: true },
  { name: "HL", imm: true },
  { name: "SP", imm: true },
];

const RP2_OPERANDS: readonly OpcodeOperandMeta[] = [
  { name: "BC", imm: true },
  { name: "DE", imm: true },
  { name: "HL", imm: true },
  { name: "AF", imm: true },
];

const CONDITION_OPERANDS: readonly OpcodeOperandMeta[] = [
  { name: "NZ", imm: true },
  { name: "Z", imm: true },
  { name: "NC", imm: true },
  { name: "C", imm: true },
];

const RST_OPERANDS: readonly OpcodeOperandMeta[] = [
  { name: "$00", imm: true },
  { name: "$08", imm: true },
  { name: "$10", imm: true },
  { name: "$18", imm: true },
  { name: "$20", imm: true },
  { name: "$28", imm: true },
  { name: "$30", imm: true },
  { name: "$38", imm: true },
];

const BIT_OPERANDS: readonly OpcodeOperandMeta[] = [
  { name: "0", imm: true },
  { name: "1", imm: true },
  { name: "2", imm: true },
  { name: "3", imm: true },
  { name: "4", imm: true },
  { name: "5", imm: true },
  { name: "6", imm: true },
  { name: "7", imm: true },
];

const ROTATE_MNEMONICS = [
  "rlc",
  "rrc",
  "rl",
  "rr",
  "sla",
  "sra",
  "swap",
  "srl",
] as const;

const ALU_MNEMONICS = [
  "add",
  "adc",
  "sub",
  "sbc",
  "and",
  "xor",
  "or",
  "cp",
] as const;

const IMM8: OpcodeOperandMeta = { name: "n8", bytes: 1, imm: true };
const IMM16: OpcodeOperandMeta = { name: "n16", bytes: 2, imm: true };
const SIGNED8: OpcodeOperandMeta = { name: "e8", bytes: 1, imm: true };
const ADDRESS_A8: OpcodeOperandMeta = { name: "a8", bytes: 1 };
const ADDRESS_A16: OpcodeOperandMeta = { name: "a16", bytes: 2 };
const ADDRESS_A16_IMM: OpcodeOperandMeta = { name: "a16", bytes: 2, imm: true };
const SP_REGISTER: OpcodeOperandMeta = { name: "SP", imm: true };
const SP_ADD_OPERAND: OpcodeOperandMeta = { name: "SP", imm: true, inc: true };
const HL_REGISTER: OpcodeOperandMeta = { name: "HL", imm: true };
const A_REGISTER: OpcodeOperandMeta = { name: "A", imm: true };
const BC_MEMORY: OpcodeOperandMeta = { name: "BC" };
const DE_MEMORY: OpcodeOperandMeta = { name: "DE" };
const C_MEMORY: OpcodeOperandMeta = { name: "C" };

const ILLEGAL_OPCODES = new Set([
  0xd3, 0xdb, 0xdd, 0xe3, 0xe4, 0xeb, 0xec, 0xed, 0xf4, 0xfc, 0xfd,
]);

const UNPREFIXED_CACHE: Array<OpcodeMeta | undefined> = new Array(0x100);
const CB_PREFIXED_CACHE: Array<OpcodeMeta | undefined> = new Array(0x100);

export function getUnprefixedOpcodeMeta(opcode: number): OpcodeMeta {
  const index = opcode & 0xff;
  const cached = UNPREFIXED_CACHE[index];
  if (cached) return cached;
  const meta = decodeUnprefixedOpcode(index);
  UNPREFIXED_CACHE[index] = meta;
  return meta;
}

export function getCbPrefixedOpcodeMeta(opcode: number): OpcodeMeta {
  const index = opcode & 0xff;
  const cached = CB_PREFIXED_CACHE[index];
  if (cached) return cached;
  const meta = decodeCbOpcode(index);
  CB_PREFIXED_CACHE[index] = meta;
  return meta;
}

function meta(
  mnemonic: string,
  length: number,
  cycles: number,
  operands: ReadonlyArray<OpcodeOperandMeta>,
): OpcodeMeta {
  return { m: mnemonic, len: length, c: cycles, ops: operands };
}

function illegalMeta(opcode: number): OpcodeMeta {
  const hex = opcode.toString(16).padStart(2, "0");
  return meta(`illegal_${hex}`, 1, 0, []);
}

function decodeUnprefixedOpcode(opcode: number): OpcodeMeta {
  if (ILLEGAL_OPCODES.has(opcode)) {
    return illegalMeta(opcode);
  }

  if (opcode === 0xcb) {
    return meta("prefix", 1, 0, []);
  }

  const x = opcode >> 6;
  const y = (opcode >> 3) & 0x07;
  const z = opcode & 0x07;
  const p = y >> 1;
  const q = y & 0x01;

  switch (x) {
    case 0:
      switch (z) {
        case 0:
          switch (y) {
            case 0:
              return meta("nop", 1, 1, []);
            case 1:
              return meta("ld", 3, 5, [ADDRESS_A16, SP_REGISTER]);
            case 2:
              return meta("stop", 2, 0, [IMM8]);
            case 3:
              return meta("jr", 2, 3, [SIGNED8]);
            default:
              return meta("jr", 2, 2, [CONDITION_OPERANDS[y - 4], SIGNED8]);
          }
        case 1:
          if (q === 0) {
            return meta("ld", 3, 3, [RP_OPERANDS[p], IMM16]);
          }
          return meta("add", 1, 2, [HL_REGISTER, RP_OPERANDS[p]]);
        case 2: {
          let target: OpcodeOperandMeta = HL_MEMORY;
          if (p === 0) target = BC_MEMORY;
          else if (p === 1) target = DE_MEMORY;
          else if (p === 2) target = HL_INC_MEMORY;
          else if (p === 3) target = HL_DEC_MEMORY;

          if (q === 0) {
            return meta("ld", 1, 2, [target, A_REGISTER]);
          }
          return meta("ld", 1, 2, [A_REGISTER, target]);
        }
        case 3:
          if (q === 0) {
            return meta("inc", 1, 2, [RP_OPERANDS[p]]);
          }
          return meta("dec", 1, 2, [RP_OPERANDS[p]]);
        case 4: {
          const operand = REG8_OPERANDS[y];
          const cycles = y === 6 ? 3 : 1;
          return meta("inc", 1, cycles, [operand]);
        }
        case 5: {
          const operand = REG8_OPERANDS[y];
          const cycles = y === 6 ? 3 : 1;
          return meta("dec", 1, cycles, [operand]);
        }
        case 6: {
          const operand = REG8_OPERANDS[y];
          const cycles = y === 6 ? 3 : 2;
          return meta("ld", 2, cycles, [operand, IMM8]);
        }
        case 7: {
          switch (y) {
            case 0:
              return meta("rlca", 1, 1, []);
            case 1:
              return meta("rrca", 1, 1, []);
            case 2:
              return meta("rla", 1, 1, []);
            case 3:
              return meta("rra", 1, 1, []);
            case 4:
              return meta("daa", 1, 1, []);
            case 5:
              return meta("cpl", 1, 1, []);
            case 6:
              return meta("scf", 1, 1, []);
            case 7:
              return meta("ccf", 1, 1, []);
          }
        }
      }
      break;
    case 1:
      if (y === 6 && z === 6) {
        return meta("halt", 1, 0, []);
      } else {
        const dest = REG8_OPERANDS[y];
        const source = REG8_OPERANDS[z];
        const cycles = y === 6 || z === 6 ? 2 : 1;
        return meta("ld", 1, cycles, [dest, source]);
      }
    case 2: {
      const source = REG8_OPERANDS[z];
      const cycles = z === 6 ? 2 : 1;
      return meta(ALU_MNEMONICS[y], 1, cycles, [A_REGISTER, source]);
    }
    case 3:
      switch (z) {
        case 0:
          if (y <= 3) {
            return meta("ret", 1, 2, [CONDITION_OPERANDS[y]]);
          }
          if (y === 4) return meta("ldh", 2, 3, [ADDRESS_A8, A_REGISTER]);
          if (y === 5) return meta("add", 2, 4, [SP_REGISTER, SIGNED8]);
          if (y === 6) return meta("ldh", 2, 3, [A_REGISTER, ADDRESS_A8]);
          return meta("ld", 2, 3, [HL_REGISTER, SP_ADD_OPERAND, SIGNED8]);
        case 1:
          if (q === 0) {
            return meta("pop", 1, 3, [RP2_OPERANDS[p]]);
          }
          if (y === 1) return meta("ret", 1, 4, []);
          if (y === 3) return meta("reti", 1, 4, []);
          if (y === 5) return meta("jp", 1, 1, [HL_REGISTER]);
          return meta("ld", 1, 2, [SP_REGISTER, HL_REGISTER]);
        case 2:
          if (y <= 3) {
            return meta("jp", 3, 3, [CONDITION_OPERANDS[y], ADDRESS_A16_IMM]);
          }
          if (y === 4) return meta("ldh", 1, 2, [C_MEMORY, A_REGISTER]);
          if (y === 5) return meta("ld", 3, 4, [ADDRESS_A16, A_REGISTER]);
          if (y === 6) return meta("ldh", 1, 2, [A_REGISTER, C_MEMORY]);
          return meta("ld", 3, 4, [A_REGISTER, ADDRESS_A16]);
        case 3:
          if (y === 0) return meta("jp", 3, 4, [ADDRESS_A16_IMM]);
          if (y === 6) return meta("di", 1, 1, []);
          if (y === 7) return meta("ei", 1, 1, []);
          return illegalMeta(opcode);
        case 4:
          if (y <= 3) {
            return meta("call", 3, 3, [CONDITION_OPERANDS[y], ADDRESS_A16_IMM]);
          }
          return illegalMeta(opcode);
        case 5:
          if (q === 0) {
            return meta("push", 1, 4, [RP2_OPERANDS[p]]);
          }
          if (y === 1) return meta("call", 3, 6, [ADDRESS_A16_IMM]);
          return illegalMeta(opcode);
        case 6:
          return meta(ALU_MNEMONICS[y], 2, 2, [A_REGISTER, IMM8]);
        case 7:
          return meta("rst", 1, 4, [RST_OPERANDS[y]]);
      }
  }

  return illegalMeta(opcode);
}

function decodeCbOpcode(opcode: number): OpcodeMeta {
  const x = opcode >> 6;
  const y = (opcode >> 3) & 0x07;
  const z = opcode & 0x07;
  const target = REG8_OPERANDS[z];

  switch (x) {
    case 0: {
      const cycles = z === 6 ? 4 : 2;
      return meta(ROTATE_MNEMONICS[y], 2, cycles, [target]);
    }
    case 1: {
      const cycles = z === 6 ? 3 : 2;
      return meta("bit", 2, cycles, [BIT_OPERANDS[y], target]);
    }
    case 2: {
      const cycles = z === 6 ? 4 : 2;
      return meta("res", 2, cycles, [BIT_OPERANDS[y], target]);
    }
    case 3: {
      const cycles = z === 6 ? 4 : 2;
      return meta("set", 2, cycles, [BIT_OPERANDS[y], target]);
    }
  }

  return illegalMeta(opcode);
}
