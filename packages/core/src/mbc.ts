export type MbcType =
  | "romOnly"
  | "mbc1"
  | "mbc2"
  | "mbc3"
  | "mbc5"
  | "mbc6"
  | "mbc7";

const ROM_BANK_SIZE = 0x4000;
const RAM_BANK_SIZE = 0x2000;

export interface MbcOptions {
  onRamWrite?: () => void;
}

const CARTRIDGE_TYPE_TO_MBC: Record<number, MbcType> = {
  0x00: "romOnly",
  0x01: "mbc1",
  0x02: "mbc1",
  0x03: "mbc1",
  0x05: "mbc2",
  0x06: "mbc2",
  0x0f: "mbc3",
  0x10: "mbc3",
  0x11: "mbc3",
  0x12: "mbc3",
  0x13: "mbc3",
  0x19: "mbc5",
  0x1a: "mbc5",
  0x1b: "mbc5",
  0x1c: "mbc5",
  0x1d: "mbc5",
  0x1e: "mbc5",
};

export abstract class Mbc {
  readonly type: MbcType;
  protected readonly rom: Uint8Array;
  protected readonly ram: Uint8Array;
  #onRamWrite: (() => void) | null;

  constructor(
    type: MbcType,
    rom: Uint8Array,
    ramSize: number,
    options?: MbcOptions,
  ) {
    this.type = type;
    this.rom = rom.slice();
    this.ram = ramSize > 0 ? new Uint8Array(ramSize) : new Uint8Array(0);
    this.#onRamWrite = options?.onRamWrite ?? null;
  }

  abstract reset(): void;

  /**
   * Handles reads targeting the cartridge regions. Returns null when the MBC
   * does not service the requested address so the system bus can fall back to
   * internal memory.
   */
  abstract read(address: number): number | null;

  /**
   * Handles writes targeting cartridge registers or external RAM. Returns true
   * when the write was consumed by the controller.
   */
  abstract write(address: number, value: number): boolean;

  getRamSnapshot(): Uint8Array {
    return this.ram.slice();
  }

  getRamSize(): number {
    return this.ram.length;
  }

  loadRamSnapshot(payload: Uint8Array): void {
    if (this.ram.length === 0) {
      return;
    }
    this.ram.set(payload.subarray(0, this.ram.length));
  }

  protected readRomBank(bankIndex: number, offset: number): number {
    const address = bankIndex * ROM_BANK_SIZE + offset;
    return this.rom[address] ?? 0xff;
  }

  protected readRamByte(bankIndex: number, offset: number): number {
    const base = bankIndex * RAM_BANK_SIZE + offset;
    if (base < 0 || base >= this.ram.length) {
      return 0xff;
    }
    return this.ram[base];
  }

  protected writeRamByte(
    bankIndex: number,
    offset: number,
    value: number,
  ): void {
    const base = bankIndex * RAM_BANK_SIZE + offset;
    if (base < 0 || base >= this.ram.length) {
      return;
    }
    this.ram[base] = value & 0xff;
  }

  protected markRamDirty(): void {
    this.#onRamWrite?.();
  }
}

class RomOnlyMbc extends Mbc {
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

class Mbc1Controller extends Mbc {
  #romBankCount: number;
  #ramBankCount: number;
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
    this.#ramBankCount =
      this.ram.length > 0
        ? Math.max(1, Math.ceil(this.ram.length / RAM_BANK_SIZE))
        : 0;
  }

  reset(): void {
    this.#romBankLow = 1;
    this.#upperBankBits = 0;
    this.#ramEnabled = false;
    this.#ramBankingMode = false;
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
    if (this.#romBankCount <= 0x20) {
      return 0;
    }
    return (this.#upperBankBits << 5) % this.#romBankCount;
  }

  #resolvedSwitchableRomBank(): number {
    if (this.#romBankCount <= 1) {
      return 0;
    }
    const bank = (this.#upperBankBits << 5) | (this.#romBankLow & 0x1f);
    const clamped = bank % this.#romBankCount;
    return clamped === 0 ? 1 : clamped;
  }

  #resolvedRamBank(): number {
    if (!this.#ramBankingMode || this.#ramBankCount === 0) {
      return 0;
    }
    return this.#upperBankBits % this.#ramBankCount;
  }
}

class Mbc3Controller extends Mbc {
  #romBankCount: number;
  #ramBankCount: number;
  #romBank = 1;
  #ramBank = 0;
  #ramEnabled = false;
  #rtcRegisterSelect: number | null = null;
  #latchState = 0;

  constructor(rom: Uint8Array, ramSize: number, options?: MbcOptions) {
    super("mbc3", rom, ramSize, options);
    this.#romBankCount = Math.max(
      1,
      Math.ceil(this.rom.length / ROM_BANK_SIZE),
    );
    this.#ramBankCount =
      this.ram.length > 0
        ? Math.max(1, Math.ceil(this.ram.length / RAM_BANK_SIZE))
        : 0;
  }

  reset(): void {
    this.#romBank = 1;
    this.#ramBank = 0;
    this.#ramEnabled = false;
    this.#rtcRegisterSelect = null;
    this.#latchState = 0;
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
      if (this.#rtcRegisterSelect !== null && this.#rtcRegisterSelect >= 0x08) {
        return this.#readRtc(this.#rtcRegisterSelect);
      }
      const offset = address - 0xa000;
      return this.readRamByte(this.#ramBank, offset);
    }
    return null;
  }

  write(address: number, value: number): boolean {
    if (address < 0x2000) {
      this.#ramEnabled = (value & 0x0f) === 0x0a;
      if (!this.#ramEnabled) {
        this.markRamDirty();
      }
      return true;
    }
    if (address >= 0x2000 && address < 0x4000) {
      this.#setRomBank(value & 0x7f);
      return true;
    }
    if (address >= 0x4000 && address < 0x6000) {
      this.#selectRamOrRtc(value & 0x0f);
      return true;
    }
    if (address >= 0x6000 && address < 0x8000) {
      this.#latchClock(value & 0x01);
      return true;
    }
    if (address >= 0xa000 && address < 0xc000) {
      if (!this.#ramEnabled || this.ram.length === 0) {
        return true;
      }
      if (this.#rtcRegisterSelect !== null && this.#rtcRegisterSelect >= 0x08) {
        this.#writeRtc(this.#rtcRegisterSelect, value & 0xff);
        return true;
      }
      const offset = address - 0xa000;
      this.writeRamByte(this.#ramBank, offset, value);
      this.markRamDirty();
      return true;
    }
    return false;
  }

  #setRomBank(rawValue: number): void {
    let bank = rawValue % this.#romBankCount;
    if (this.#romBankCount > 1 && bank === 0) {
      bank = 1;
    }
    this.#romBank = bank;
  }

  #resolvedRomBank(): number {
    if (this.#romBankCount <= 1) {
      return 0;
    }
    return this.#romBank % this.#romBankCount || 1;
  }

  #selectRamOrRtc(value: number): void {
    if (value >= 0x08 && value <= 0x0c) {
      this.#rtcRegisterSelect = value;
      return;
    }
    this.#rtcRegisterSelect = null;
    if (this.#ramBankCount === 0) {
      this.#ramBank = 0;
      return;
    }
    this.#ramBank = value % this.#ramBankCount;
  }

  #latchClock(value: number): void {
    // A write sequence of 0x00 -> 0x01 latches the RTC. The stub does not
    // emulate the RTC yet, but we keep the edge-triggered state so future work
    // can hook into it without changing the interface again.
    if (this.#latchState === 0 && value === 1) {
      this.#latchState = 1;
    } else if (value === 0) {
      this.#latchState = 0;
    }
  }

  #readRtc(_register: number): number {
    // RTC is not implemented yet; return 0xff so software treats it as idle.
    return 0xff;
  }

  #writeRtc(_register: number, _value: number): void {
    // RTC writes are ignored until the emulator wires up a real clock source.
  }
}

export class MbcFactory {
  detect(rom: Uint8Array): MbcType {
    const typeByte = rom[0x147] ?? 0x00;
    return CARTRIDGE_TYPE_TO_MBC[typeByte] ?? "romOnly";
  }

  create(
    type: MbcType,
    rom: Uint8Array,
    ramSize: number,
    options?: MbcOptions,
  ): Mbc {
    switch (type) {
      case "mbc1":
        return new Mbc1Controller(rom, ramSize, options);
      case "mbc3":
        return new Mbc3Controller(rom, ramSize, options);
      default:
        return new RomOnlyMbc(rom, ramSize, options);
    }
  }
}
