import { EmulatorRomInfo } from "./types.js";
import { decodeRamSize, decodeRomSize } from "./sizes.js";

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
