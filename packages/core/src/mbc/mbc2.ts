import { ROM_BANK_SIZE } from "./constants.js";
import { MbcOptions } from "./base.js";
import { Mbc } from "./base.js";

export class Mbc2Controller extends Mbc {
  #romBankCount: number;
  #romBank = 1;
  #ramEnabled = false;

  constructor(rom: Uint8Array, _ramSize: number, options?: MbcOptions) {
    // MBC2 has fixed internal RAM (512 × 4-bit), ignore provided ramSize.
    super("mbc2", rom, 512, options);
    this.#romBankCount = Math.max(
      1,
      Math.ceil(this.rom.length / ROM_BANK_SIZE),
    );
  }

  reset(): void {
    this.#romBank = 1;
    this.#ramEnabled = false;
  }

  getRomWindows(): { lower: Uint8Array; upper: Uint8Array } {
    const lower =
      this.rom.subarray(0, ROM_BANK_SIZE) ?? new Uint8Array(ROM_BANK_SIZE);
    const upper =
      this.rom.subarray(
        this.#resolvedRomBank() * ROM_BANK_SIZE,
        (this.#resolvedRomBank() + 1) * ROM_BANK_SIZE,
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
      if (!this.#ramEnabled) {
        return 0xff;
      }
      const offset = (address - 0xa000) & 0x01ff;
      const value = this.ram[offset] ?? 0xff;
      return 0xf0 | (value & 0x0f);
    }
    return null;
  }

  write(address: number, value: number): boolean {
    if (address < 0x4000) {
      const isRamGate = (address & 0x0100) === 0;
      if (isRamGate) {
        const nextEnabled = (value & 0x0f) === 0x0a;
        const wasEnabled = this.#ramEnabled;
        this.#ramEnabled = nextEnabled;
        if (wasEnabled && !nextEnabled) {
          this.markRamDirty();
        }
        return true;
      }
      this.#setRomBank(value & 0x0f);
      return true;
    }
    if (address >= 0xa000 && address < 0xc000) {
      if (!this.#ramEnabled) {
        return true;
      }
      const offset = (address - 0xa000) & 0x01ff;
      this.ram[offset] = value & 0x0f;
      this.markRamDirty();
      return true;
    }
    return false;
  }

  #setRomBank(rawValue: number): void {
    const bankMask =
      this.#romBankCount > 0 &&
      (this.#romBankCount & (this.#romBankCount - 1)) === 0
        ? this.#romBankCount - 1
        : null;
    let bank = rawValue & 0x0f;
    if (bank === 0) {
      bank = 1;
    }
    if (this.#romBankCount > 0) {
      bank = bankMask !== null ? bank & bankMask : bank % this.#romBankCount;
    }
    this.#romBank = bank;
  }

  #resolvedRomBank(): number {
    if (this.#romBankCount <= 1) {
      return 0;
    }
    return this.#romBank;
  }
}
