import { HeaderField } from "./types.js";
import { describeRamSize, describeRomSize } from "./sizes.js";

export const ENTRY_POINT = 0x100;
export const NINTENDO_LOGO_START = 0x104;
export const HEADER_START = 0x134;
export const PROGRAM_START = 0x150;

export const HEADER_FIELDS: readonly HeaderField[] = [
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
