// Auto-generated opcode metadata derived from https://gbdev.io/gb-opcodes/Opcodes.json
// Generation script: see rom disassembler tooling.
export interface OpcodeOperandMeta {
  readonly name: string;
  readonly bytes: number | null;
  readonly immediate: boolean;
  readonly increment: boolean;
  readonly decrement: boolean;
}

export interface OpcodeMeta {
  readonly mnemonic: string;
  readonly length: number;
  readonly operands: readonly OpcodeOperandMeta[];
}

export const UNPREFIXED_OPCODE_TABLE: OpcodeMeta[] = [
  /* 0x00 */ { mnemonic: "nop", length: 1, operands: [] },
  /* 0x01 */ {
    mnemonic: "ld",
    length: 3,
    operands: [
      {
        name: "BC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x02 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "BC",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x03 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "BC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x04 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x05 */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x06 */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x07 */ { mnemonic: "rlca", length: 1, operands: [] },
  /* 0x08 */ {
    mnemonic: "ld",
    length: 3,
    operands: [
      {
        name: "a16",
        bytes: 2,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x09 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "BC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "BC",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0b */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "BC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0c */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0d */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0e */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0f */ { mnemonic: "rrca", length: 1, operands: [] },
  /* 0x10 */ {
    mnemonic: "stop",
    length: 2,
    operands: [
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x11 */ {
    mnemonic: "ld",
    length: 3,
    operands: [
      {
        name: "DE",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x12 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "DE",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x13 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "DE",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x14 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x15 */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x16 */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x17 */ { mnemonic: "rla", length: 1, operands: [] },
  /* 0x18 */ {
    mnemonic: "jr",
    length: 2,
    operands: [
      {
        name: "e8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x19 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "DE",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "DE",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1b */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "DE",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1c */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1d */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1e */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1f */ { mnemonic: "rra", length: 1, operands: [] },
  /* 0x20 */ {
    mnemonic: "jr",
    length: 2,
    operands: [
      {
        name: "NZ",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "e8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x21 */ {
    mnemonic: "ld",
    length: 3,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x22 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: true,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x23 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x24 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x25 */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x26 */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x27 */ { mnemonic: "daa", length: 1, operands: [] },
  /* 0x28 */ {
    mnemonic: "jr",
    length: 2,
    operands: [
      {
        name: "Z",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "e8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x29 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: true,
        decrement: false,
      },
    ],
  },
  /* 0x2b */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2c */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2d */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2e */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2f */ { mnemonic: "cpl", length: 1, operands: [] },
  /* 0x30 */ {
    mnemonic: "jr",
    length: 2,
    operands: [
      {
        name: "NC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "e8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x31 */ {
    mnemonic: "ld",
    length: 3,
    operands: [
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x32 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: true,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x33 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x34 */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x35 */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x36 */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x37 */ { mnemonic: "scf", length: 1, operands: [] },
  /* 0x38 */ {
    mnemonic: "jr",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "e8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x39 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: true,
      },
    ],
  },
  /* 0x3b */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3c */ {
    mnemonic: "inc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3d */ {
    mnemonic: "dec",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3e */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3f */ { mnemonic: "ccf", length: 1, operands: [] },
  /* 0x40 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x41 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x42 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x43 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x44 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x45 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x46 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x47 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x48 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x49 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4b */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4c */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4d */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4e */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4f */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x50 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x51 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x52 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x53 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x54 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x55 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x56 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x57 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x58 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x59 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5b */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5c */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5d */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5e */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5f */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x60 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x61 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x62 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x63 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x64 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x65 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x66 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x67 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x68 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x69 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6b */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6c */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6d */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6e */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6f */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x70 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x71 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x72 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x73 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x74 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x75 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x76 */ { mnemonic: "halt", length: 1, operands: [] },
  /* 0x77 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x78 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x79 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7a */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7b */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7c */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7d */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7e */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7f */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x80 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x81 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x82 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x83 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x84 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x85 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x86 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x87 */ {
    mnemonic: "add",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x88 */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x89 */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8a */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8b */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8c */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8d */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8e */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8f */ {
    mnemonic: "adc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x90 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x91 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x92 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x93 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x94 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x95 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x96 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x97 */ {
    mnemonic: "sub",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x98 */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x99 */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9a */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9b */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9c */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9d */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9e */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9f */ {
    mnemonic: "sbc",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa0 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa1 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa2 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa3 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa4 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa5 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa6 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa7 */ {
    mnemonic: "and",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa8 */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa9 */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xaa */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xab */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xac */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xad */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xae */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xaf */ {
    mnemonic: "xor",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb0 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb1 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb2 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb3 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb4 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb5 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb6 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb7 */ {
    mnemonic: "or",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb8 */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb9 */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xba */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbb */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbc */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbd */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbe */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbf */ {
    mnemonic: "cp",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc0 */ {
    mnemonic: "ret",
    length: 1,
    operands: [
      {
        name: "NZ",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc1 */ {
    mnemonic: "pop",
    length: 1,
    operands: [
      {
        name: "BC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc2 */ {
    mnemonic: "jp",
    length: 3,
    operands: [
      {
        name: "NZ",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc3 */ {
    mnemonic: "jp",
    length: 3,
    operands: [
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc4 */ {
    mnemonic: "call",
    length: 3,
    operands: [
      {
        name: "NZ",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc5 */ {
    mnemonic: "push",
    length: 1,
    operands: [
      {
        name: "BC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc6 */ {
    mnemonic: "add",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc7 */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$00",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc8 */ {
    mnemonic: "ret",
    length: 1,
    operands: [
      {
        name: "Z",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc9 */ { mnemonic: "ret", length: 1, operands: [] },
  /* 0xca */ {
    mnemonic: "jp",
    length: 3,
    operands: [
      {
        name: "Z",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xcb */ { mnemonic: "prefix", length: 1, operands: [] },
  /* 0xcc */ {
    mnemonic: "call",
    length: 3,
    operands: [
      {
        name: "Z",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xcd */ {
    mnemonic: "call",
    length: 3,
    operands: [
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xce */ {
    mnemonic: "adc",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xcf */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$08",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd0 */ {
    mnemonic: "ret",
    length: 1,
    operands: [
      {
        name: "NC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd1 */ {
    mnemonic: "pop",
    length: 1,
    operands: [
      {
        name: "DE",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd2 */ {
    mnemonic: "jp",
    length: 3,
    operands: [
      {
        name: "NC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd3 */ { mnemonic: "illegal_d3", length: 1, operands: [] },
  /* 0xd4 */ {
    mnemonic: "call",
    length: 3,
    operands: [
      {
        name: "NC",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd5 */ {
    mnemonic: "push",
    length: 1,
    operands: [
      {
        name: "DE",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd6 */ {
    mnemonic: "sub",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd7 */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$10",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd8 */ {
    mnemonic: "ret",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd9 */ { mnemonic: "reti", length: 1, operands: [] },
  /* 0xda */ {
    mnemonic: "jp",
    length: 3,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xdb */ { mnemonic: "illegal_db", length: 1, operands: [] },
  /* 0xdc */ {
    mnemonic: "call",
    length: 3,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xdd */ { mnemonic: "illegal_dd", length: 1, operands: [] },
  /* 0xde */ {
    mnemonic: "sbc",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xdf */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$18",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe0 */ {
    mnemonic: "ldh",
    length: 2,
    operands: [
      {
        name: "a8",
        bytes: 1,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe1 */ {
    mnemonic: "pop",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe2 */ {
    mnemonic: "ldh",
    length: 1,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe3 */ { mnemonic: "illegal_e3", length: 1, operands: [] },
  /* 0xe4 */ { mnemonic: "illegal_e4", length: 1, operands: [] },
  /* 0xe5 */ {
    mnemonic: "push",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe6 */ {
    mnemonic: "and",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe7 */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$20",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe8 */ {
    mnemonic: "add",
    length: 2,
    operands: [
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "e8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe9 */ {
    mnemonic: "jp",
    length: 1,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xea */ {
    mnemonic: "ld",
    length: 3,
    operands: [
      {
        name: "a16",
        bytes: 2,
        immediate: false,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xeb */ { mnemonic: "illegal_eb", length: 1, operands: [] },
  /* 0xec */ { mnemonic: "illegal_ec", length: 1, operands: [] },
  /* 0xed */ { mnemonic: "illegal_ed", length: 1, operands: [] },
  /* 0xee */ {
    mnemonic: "xor",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xef */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$28",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf0 */ {
    mnemonic: "ldh",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a8",
        bytes: 1,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf1 */ {
    mnemonic: "pop",
    length: 1,
    operands: [
      {
        name: "AF",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf2 */ {
    mnemonic: "ldh",
    length: 1,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf3 */ { mnemonic: "di", length: 1, operands: [] },
  /* 0xf4 */ { mnemonic: "illegal_f4", length: 1, operands: [] },
  /* 0xf5 */ {
    mnemonic: "push",
    length: 1,
    operands: [
      {
        name: "AF",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf6 */ {
    mnemonic: "or",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf7 */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$30",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf8 */ {
    mnemonic: "ld",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: true,
        decrement: false,
      },
      {
        name: "e8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf9 */ {
    mnemonic: "ld",
    length: 1,
    operands: [
      {
        name: "SP",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xfa */ {
    mnemonic: "ld",
    length: 3,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "a16",
        bytes: 2,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xfb */ { mnemonic: "ei", length: 1, operands: [] },
  /* 0xfc */ { mnemonic: "illegal_fc", length: 1, operands: [] },
  /* 0xfd */ { mnemonic: "illegal_fd", length: 1, operands: [] },
  /* 0xfe */ {
    mnemonic: "cp",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "n8",
        bytes: 1,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xff */ {
    mnemonic: "rst",
    length: 1,
    operands: [
      {
        name: "$38",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
];
export const CB_PREFIXED_OPCODE_TABLE: OpcodeMeta[] = [
  /* 0x00 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x01 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x02 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x03 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x04 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x05 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x06 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x07 */ {
    mnemonic: "rlc",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x08 */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x09 */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0a */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0b */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0c */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0d */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0e */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x0f */ {
    mnemonic: "rrc",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x10 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x11 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x12 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x13 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x14 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x15 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x16 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x17 */ {
    mnemonic: "rl",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x18 */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x19 */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1a */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1b */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1c */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1d */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1e */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x1f */ {
    mnemonic: "rr",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x20 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x21 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x22 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x23 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x24 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x25 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x26 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x27 */ {
    mnemonic: "sla",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x28 */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x29 */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2a */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2b */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2c */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2d */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2e */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x2f */ {
    mnemonic: "sra",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x30 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x31 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x32 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x33 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x34 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x35 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x36 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x37 */ {
    mnemonic: "swap",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x38 */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x39 */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3a */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3b */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3c */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3d */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3e */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x3f */ {
    mnemonic: "srl",
    length: 2,
    operands: [
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x40 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x41 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x42 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x43 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x44 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x45 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x46 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x47 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x48 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x49 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4a */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4b */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4c */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4d */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4e */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x4f */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x50 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x51 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x52 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x53 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x54 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x55 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x56 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x57 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x58 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x59 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5a */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5b */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5c */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5d */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5e */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x5f */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x60 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x61 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x62 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x63 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x64 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x65 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x66 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x67 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x68 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x69 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6a */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6b */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6c */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6d */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6e */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x6f */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x70 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x71 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x72 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x73 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x74 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x75 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x76 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x77 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x78 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x79 */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7a */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7b */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7c */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7d */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7e */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x7f */ {
    mnemonic: "bit",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x80 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x81 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x82 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x83 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x84 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x85 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x86 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x87 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x88 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x89 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8a */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8b */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8c */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8d */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8e */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x8f */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x90 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x91 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x92 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x93 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x94 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x95 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x96 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x97 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x98 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x99 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9a */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9b */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9c */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9d */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9e */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0x9f */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa0 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa1 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa2 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa3 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa4 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa5 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa6 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa7 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa8 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xa9 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xaa */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xab */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xac */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xad */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xae */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xaf */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb0 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb1 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb2 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb3 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb4 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb5 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb6 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb7 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb8 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xb9 */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xba */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbb */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbc */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbd */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbe */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xbf */ {
    mnemonic: "res",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc0 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc1 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc2 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc3 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc4 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc5 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc6 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc7 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "0",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc8 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xc9 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xca */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xcb */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xcc */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xcd */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xce */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xcf */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "1",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd0 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd1 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd2 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd3 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd4 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd5 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd6 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd7 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "2",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd8 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xd9 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xda */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xdb */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xdc */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xdd */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xde */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xdf */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "3",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe0 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe1 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe2 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe3 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe4 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe5 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe6 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe7 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "4",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe8 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xe9 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xea */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xeb */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xec */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xed */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xee */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xef */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "5",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf0 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf1 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf2 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf3 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf4 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf5 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf6 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf7 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "6",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf8 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "B",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xf9 */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "C",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xfa */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "D",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xfb */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "E",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xfc */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "H",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xfd */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "L",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xfe */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "HL",
        bytes: null,
        immediate: false,
        increment: false,
        decrement: false,
      },
    ],
  },
  /* 0xff */ {
    mnemonic: "set",
    length: 2,
    operands: [
      {
        name: "7",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
      {
        name: "A",
        bytes: null,
        immediate: true,
        increment: false,
        decrement: false,
      },
    ],
  },
];
