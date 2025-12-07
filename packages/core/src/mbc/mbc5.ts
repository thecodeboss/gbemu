import { RAM_BANK_SIZE, ROM_BANK_SIZE } from "./constants.js";
import { MbcOptions } from "./base.js";
import { Mbc } from "./base.js";

export class Mbc5Controller extends Mbc {
  #romBankCount: number;
  #ramBankCount: number;
  #romBankLow = 1;
  #romBankHigh = 0;
  #romBankMask: number | null;
  #ramBank = 0;
  #ramEnabled = false;

  constructor(rom: Uint8Array, ramSize: number, options?: MbcOptions) {
    super("mbc5", rom, ramSize, options);
    this.#romBankCount = Math.max(
      1,
      Math.ceil(this.rom.length / ROM_BANK_SIZE),
    );
    this.#romBankMask =
      this.#romBankCount > 0 &&
      (this.#romBankCount & (this.#romBankCount - 1)) === 0
        ? this.#romBankCount - 1
        : null;
    this.#ramBankCount =
      this.ram.length > 0
        ? Math.max(1, Math.ceil(this.ram.length / RAM_BANK_SIZE))
        : 0;
  }

  reset(): void {
    this.#romBankLow = 1;
    this.#romBankHigh = 0;
    this.#ramBank = 0;
    this.#ramEnabled = false;
  }

  getRomWindows(): { lower: Uint8Array; upper: Uint8Array } {
    const lower =
      this.rom.subarray(0, ROM_BANK_SIZE) ?? new Uint8Array(ROM_BANK_SIZE);
    const upperBank = this.#resolvedRomBank();
    const upper =
      this.rom.subarray(
        upperBank * ROM_BANK_SIZE,
        (upperBank + 1) * ROM_BANK_SIZE,
      ) ?? lower;
    return { lower, upper };
  }

  read(address: number): number | null {
    if (address < 0x4000) {
      return this.readRomBank(0, address);
    }
    if (address >= 0x4000 && address < 0x8000) {
      const offset = address - 0x4000;
      return this.readRomBank(this.#resolvedRomBank(), offset);
    }
    if (address >= 0xa000 && address < 0xc000) {
      if (!this.#ramEnabled || this.ram.length === 0) {
        return 0xff;
      }
      const offset = address - 0xa000;
      return this.readRamByte(this.#ramBank, offset);
    }
    return null;
  }

  write(address: number, value: number): boolean {
    if (address < 0x2000) {
      const nextEnabled = (value & 0x0f) === 0x0a;
      const wasEnabled = this.#ramEnabled;
      this.#ramEnabled = nextEnabled;
      if (wasEnabled && !nextEnabled) {
        this.markRamDirty();
      }
      return true;
    }
    if (address >= 0x2000 && address < 0x3000) {
      this.#romBankLow = value & 0xff;
      return true;
    }
    if (address >= 0x3000 && address < 0x4000) {
      this.#romBankHigh = value & 0x01;
      return true;
    }
    if (address >= 0x4000 && address < 0x6000) {
      const nextRamBank = value & 0x0f;
      if (nextRamBank !== this.#ramBank) {
        this.markRamDirty();
      }
      this.#ramBank = nextRamBank % (this.#ramBankCount || 1);
      return true;
    }
    if (address >= 0xa000 && address < 0xc000) {
      if (!this.#ramEnabled || this.ram.length === 0) {
        return true;
      }
      const offset = address - 0xa000;
      this.writeRamByte(this.#ramBank, offset, value);
      this.markRamDirty();
      return true;
    }
    return false;
  }

  #resolvedRomBank(): number {
    let bank = ((this.#romBankHigh & 0x01) << 8) | (this.#romBankLow & 0xff);
    if (this.#romBankMask !== null) {
      bank &= this.#romBankMask;
    } else {
      bank %= this.#romBankCount;
    }
    return bank;
  }
}
