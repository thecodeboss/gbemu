import { MbcOptions } from "./base.js";
import { Mbc } from "./base.js";

export class RomOnlyMbc extends Mbc {
  constructor(rom: Uint8Array, ramSize: number, options?: MbcOptions) {
    super("romOnly", rom, ramSize, options);
  }

  reset(): void {
    // No dynamic state to reset.
  }

  read(address: number): number | null {
    if (address < 0x8000) {
      return this.rom[address] ?? 0xff;
    }
    if (address >= 0xa000 && address < 0xc000 && this.ram.length > 0) {
      const offset = address - 0xa000;
      if (offset < this.ram.length) {
        return this.ram[offset];
      }
      return 0xff;
    }
    return null;
  }

  write(address: number, value: number): boolean {
    if (address >= 0xa000 && address < 0xc000 && this.ram.length > 0) {
      const offset = address - 0xa000;
      if (offset < this.ram.length) {
        this.ram[offset] = value & 0xff;
        this.markRamDirty();
      }
      return true;
    }
    return false;
  }
}
