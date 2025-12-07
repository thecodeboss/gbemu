import { RAM_BANK_SIZE, ROM_BANK_SIZE } from "./constants.js";
import { MbcOptions } from "./base.js";
import { Mbc } from "./base.js";

export class Mbc1Controller extends Mbc {
  #romBankCount: number;
  #ramBankCount: number;
  #romBankMask: number | null;
  #isMulticart: boolean;
  #romBankLow = 1;
  #upperBankBits = 0;
  #ramEnabled = false;
  #ramBankingMode = false;

  constructor(rom: Uint8Array, ramSize: number, options?: MbcOptions) {
    super("mbc1", rom, ramSize, options);
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
    this.#isMulticart = this.#detectMulticart();
  }

  reset(): void {
    this.#romBankLow = 1;
    this.#upperBankBits = 0;
    this.#ramEnabled = false;
    this.#ramBankingMode = false;
  }

  getRomWindows(): { lower: Uint8Array; upper: Uint8Array } {
    const lowerBank = this.#resolvedLowerRomBank();
    const upperBank = this.#resolvedSwitchableRomBank();
    const lower =
      this.rom.subarray(
        lowerBank * ROM_BANK_SIZE,
        (lowerBank + 1) * ROM_BANK_SIZE,
      ) ?? this.rom.subarray(0, ROM_BANK_SIZE);
    const upper =
      this.rom.subarray(
        upperBank * ROM_BANK_SIZE,
        (upperBank + 1) * ROM_BANK_SIZE,
      ) ?? lower;
    return { lower, upper };
  }

  read(address: number): number | null {
    if (address < 0x4000) {
      return this.readRomBank(this.#resolvedLowerRomBank(), address);
    }
    if (address >= 0x4000 && address < 0x8000) {
      const offset = address - 0x4000;
      return this.readRomBank(this.#resolvedSwitchableRomBank(), offset);
    }
    if (address >= 0xa000 && address < 0xc000) {
      if (!this.#ramEnabled || this.ram.length === 0) {
        return 0xff;
      }
      const offset = address - 0xa000;
      return this.readRamByte(this.#resolvedRamBank(), offset);
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
    if (address >= 0x2000 && address < 0x4000) {
      const nextValue = value & 0x1f;
      this.#romBankLow = nextValue === 0 ? 1 : nextValue;
      return true;
    }
    if (address >= 0x4000 && address < 0x6000) {
      const previousRamBank = this.#resolvedRamBank();
      this.#upperBankBits = value & 0x03;
      if (
        this.#ramBankingMode &&
        this.#ramBankCount > 0 &&
        previousRamBank !== this.#resolvedRamBank()
      ) {
        this.markRamDirty();
      }
      return true;
    }
    if (address >= 0x6000 && address < 0x8000) {
      const nextMode = (value & 0x01) === 0x01;
      if (nextMode !== this.#ramBankingMode && nextMode) {
        this.markRamDirty();
      }
      this.#ramBankingMode = nextMode;
      return true;
    }
    if (address >= 0xa000 && address < 0xc000) {
      if (!this.#ramEnabled || this.ram.length === 0) {
        return true;
      }
      const offset = address - 0xa000;
      this.writeRamByte(this.#resolvedRamBank(), offset, value);
      this.markRamDirty();
      return true;
    }
    return false;
  }

  #resolvedLowerRomBank(): number {
    if (!this.#ramBankingMode) {
      return 0;
    }
    if (this.#isMulticart) {
      return this.#normalizeRomBank(this.#upperBankBits << 4);
    }
    return this.#normalizeRomBank(this.#upperBankBits << 5);
  }

  #resolvedSwitchableRomBank(): number {
    if (this.#romBankCount <= 1) {
      return 0;
    }
    const bankNumber = this.#composeRomBankNumber();
    const resolved = this.#isMulticart
      ? this.#resolveMulticartRomBank(bankNumber)
      : bankNumber;
    return this.#normalizeRomBank(resolved);
  }

  #resolvedRamBank(): number {
    if (!this.#ramBankingMode || this.#ramBankCount === 0) {
      return 0;
    }
    return this.#upperBankBits % this.#ramBankCount;
  }

  #composeRomBankNumber(): number {
    let bank = (this.#upperBankBits << 5) | (this.#romBankLow & 0x1f);
    if ((bank & 0x1f) === 0) {
      bank |= 0x01;
    }
    return bank;
  }

  #resolveMulticartRomBank(bankNumber: number): number {
    const groupBase = (bankNumber >> 5) << 4;
    const bankWithinGroup = bankNumber & 0x0f;
    return groupBase | bankWithinGroup;
  }

  #normalizeRomBank(bank: number): number {
    if (this.#romBankMask !== null) {
      return bank & this.#romBankMask;
    }
    return bank % this.#romBankCount;
  }

  #detectMulticart(): boolean {
    if (this.#romBankCount < 64) {
      return false;
    }
    const referenceLogo = this.#extractHeaderLogo();
    if (!referenceLogo) {
      return false;
    }
    let logosFound = 0;
    for (let bank = 0; bank < this.#romBankCount; bank += 16) {
      const offset = bank * ROM_BANK_SIZE + 0x104;
      if (offset + referenceLogo.length > this.rom.length) {
        break;
      }
      if (this.#matchesLogo(offset, referenceLogo)) {
        logosFound += 1;
        if (logosFound > 1) {
          return true;
        }
      }
    }
    return false;
  }

  #extractHeaderLogo(): Uint8Array | null {
    const start = 0x0104;
    const end = 0x0134;
    if (this.rom.length < end) {
      return null;
    }
    return this.rom.subarray(start, end);
  }

  #matchesLogo(offset: number, logo: Uint8Array): boolean {
    for (let i = 0; i < logo.length; i += 1) {
      if (this.rom[offset + i] !== logo[i]) {
        return false;
      }
    }
    return true;
  }
}
