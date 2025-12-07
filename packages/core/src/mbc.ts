import { decodeRamSize } from "./rom/sizes.js";

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

interface CartridgeTypeMetadata {
  mbc: MbcType;
  hasRam?: boolean;
  battery?: boolean;
  rtc?: boolean;
  rumble?: boolean;
  forceRamSize?: number;
}

const CARTRIDGE_TYPE_TABLE: Record<number, CartridgeTypeMetadata> = {
  0x00: { mbc: "romOnly" },
  0x01: { mbc: "mbc1" },
  0x02: { mbc: "mbc1", hasRam: true },
  0x03: { mbc: "mbc1", hasRam: true, battery: true },
  0x05: { mbc: "mbc2", hasRam: true, forceRamSize: 512 },
  0x06: { mbc: "mbc2", hasRam: true, battery: true, forceRamSize: 512 },
  0x08: { mbc: "romOnly", hasRam: true },
  0x09: { mbc: "romOnly", hasRam: true, battery: true },
  0x0f: { mbc: "mbc3", rtc: true, battery: true },
  0x10: { mbc: "mbc3", hasRam: true, rtc: true, battery: true },
  0x11: { mbc: "mbc3" },
  0x12: { mbc: "mbc3", hasRam: true },
  0x13: { mbc: "mbc3", hasRam: true, battery: true },
  0x19: { mbc: "mbc5" },
  0x1a: { mbc: "mbc5", hasRam: true },
  0x1b: { mbc: "mbc5", hasRam: true, battery: true },
  0x1c: { mbc: "mbc5", rumble: true },
  0x1d: { mbc: "mbc5", hasRam: true, rumble: true },
  0x1e: { mbc: "mbc5", hasRam: true, battery: true, rumble: true },
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

  getRomWindows(): { lower: Uint8Array; upper: Uint8Array } {
    const lower = this.rom.subarray(0, ROM_BANK_SIZE);
    const upper =
      this.rom.length >= ROM_BANK_SIZE * 2
        ? this.rom.subarray(ROM_BANK_SIZE, ROM_BANK_SIZE * 2)
        : lower;
    return { lower, upper };
  }

  getRamSnapshot(): Uint8Array {
    return this.ram.slice();
  }

  getRamSize(): number {
    return this.ram.length;
  }

  hasRtc(): boolean {
    return false;
  }

  getRtcSnapshot(): Uint8Array | null {
    return null;
  }

  loadRtcSnapshot(_payload: Uint8Array): void {
    // No RTC state to hydrate by default.
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
    const next = value & 0xff;
    if (this.ram[base] === next) {
      return;
    }
    this.ram[base] = next;
    this.markRamDirty();
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

class Mbc2Controller extends Mbc {
  #romBankCount: number;
  #romBank = 1;
  #ramEnabled = false;

  constructor(rom: Uint8Array, ramSize: number, options?: MbcOptions) {
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

class Mbc3Controller extends Mbc {
  #romBankCount: number;
  #ramBankCount: number;
  #romBank = 1;
  #ramBank = 0;
  #ramEnabled = false;
  #hasRtc: boolean;
  #rtcRegisterSelect: number | null = null;
  #latchState = 0;
  #rtcSeconds = 0;
  #rtcMinutes = 0;
  #rtcHours = 0;
  #rtcDays = 0;
  #rtcHalt = false;
  #rtcCarry = false;
  #rtcLatchedSeconds = 0;
  #rtcLatchedMinutes = 0;
  #rtcLatchedHours = 0;
  #rtcLatchedDays = 0;
  #rtcLatchedDayHigh = 0;
  #rtcLatched = false;
  #rtcLastUpdatedMs = 0;

  constructor(rom: Uint8Array, ramSize: number, options?: MbcOptions) {
    super("mbc3", rom, ramSize, options);
    const cartridgeType = rom[0x147] ?? 0x00;
    this.#hasRtc = cartridgeType === 0x0f || cartridgeType === 0x10;
    this.#romBankCount = Math.max(
      1,
      Math.ceil(this.rom.length / ROM_BANK_SIZE),
    );
    this.#ramBankCount =
      this.ram.length > 0
        ? Math.max(1, Math.ceil(this.ram.length / RAM_BANK_SIZE))
        : 0;
    this.#rtcLastUpdatedMs = this.#nowMs();
  }

  reset(): void {
    this.#romBank = 1;
    this.#ramBank = 0;
    this.#ramEnabled = false;
    this.#rtcRegisterSelect = null;
    this.#latchState = 0;
    this.#rtcSeconds = 0;
    this.#rtcMinutes = 0;
    this.#rtcHours = 0;
    this.#rtcDays = 0;
    this.#rtcHalt = false;
    this.#rtcCarry = false;
    this.#rtcLatched = false;
    this.#rtcLastUpdatedMs = this.#nowMs();
    this.#refreshLatchedFromRunning();
    if (this.#hasRtc) {
      this.markRamDirty();
    }
  }

  hasRtc(): boolean {
    return this.#hasRtc;
  }

  getRomWindows(): { lower: Uint8Array; upper: Uint8Array } {
    const lowerBank = 0;
    const upperBank = this.#resolvedRomBank();
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

  getRtcSnapshot(): Uint8Array | null {
    if (!this.#hasRtc) {
      return null;
    }
    this.#updateRtc();
    if (!this.#rtcLatched) {
      this.#refreshLatchedFromRunning();
    }

    const buffer = new ArrayBuffer(48);
    const view = new DataView(buffer);
    let offset = 0;
    offset = this.#writeRtcInt(view, offset, this.#rtcSeconds);
    offset = this.#writeRtcInt(view, offset, this.#rtcMinutes);
    offset = this.#writeRtcInt(view, offset, this.#rtcHours);
    offset = this.#writeRtcInt(view, offset, this.#rtcDays);
    offset = this.#writeRtcInt(
      view,
      offset,
      this.#composeDayHighFlags(this.#rtcDays, this.#rtcHalt, this.#rtcCarry),
    );
    offset = this.#writeRtcInt(view, offset, this.#rtcLatchedSeconds);
    offset = this.#writeRtcInt(view, offset, this.#rtcLatchedMinutes);
    offset = this.#writeRtcInt(view, offset, this.#rtcLatchedHours);
    offset = this.#writeRtcInt(view, offset, this.#rtcLatchedDays);
    offset = this.#writeRtcInt(view, offset, this.#rtcLatchedDayHigh);
    const lastUpdatedSeconds = Math.max(
      0,
      Math.floor(this.#rtcLastUpdatedMs / 1000),
    );
    view.setBigUint64(offset, BigInt(lastUpdatedSeconds), true);
    return new Uint8Array(buffer);
  }

  loadRtcSnapshot(payload: Uint8Array): void {
    if (!this.#hasRtc || payload.length < 5) {
      return;
    }
    const view = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength,
    );

    if (payload.length >= 48) {
      const rawSeconds = view.getInt32(0, true);
      const rawMinutes = view.getInt32(4, true);
      const rawHours = view.getInt32(8, true);
      const rawDays = view.getInt32(12, true);
      const control = view.getInt32(16, true) & 0xff;

      this.#rtcSeconds = Math.min(59, Math.max(0, rawSeconds));
      this.#rtcMinutes = Math.min(59, Math.max(0, rawMinutes));
      this.#rtcHours = Math.min(23, Math.max(0, rawHours));
      const controlDayHigh = (control & 0x01) << 8;
      this.#rtcDays = ((rawDays & 0x1ff) | controlDayHigh) % 512;
      this.#rtcHalt = (control & 0x40) !== 0;
      this.#rtcCarry = (control & 0x80) !== 0;
      this.#rtcLatchedSeconds = Math.min(
        59,
        Math.max(0, view.getInt32(20, true)),
      );
      this.#rtcLatchedMinutes = Math.min(
        59,
        Math.max(0, view.getInt32(24, true)),
      );
      this.#rtcLatchedHours = Math.min(
        23,
        Math.max(0, view.getInt32(28, true)),
      );
      this.#rtcLatchedDays = view.getInt32(32, true) & 0x1ff;
      this.#rtcLatchedDayHigh = view.getInt32(36, true) & 0xff;
      const timestampSeconds = Number(view.getBigUint64(40, true));
      this.#rtcLastUpdatedMs = Number.isFinite(timestampSeconds)
        ? Math.max(0, timestampSeconds) * 1000
        : this.#nowMs();
      this.#rtcLatched = false;
      this.#updateRtc();
      this.#refreshLatchedFromRunning();
      return;
    }

    this.#rtcSeconds = Math.min(59, view.getUint8(0));
    this.#rtcMinutes = Math.min(59, view.getUint8(1));
    this.#rtcHours = Math.min(23, view.getUint8(2));
    const dayLow = view.getUint8(3);
    const dayHigh = view.getUint8(4);
    this.#rtcDays = (((dayHigh & 0x01) << 8) | dayLow) % 512;
    this.#rtcHalt = (dayHigh & 0x40) !== 0;
    this.#rtcCarry = (dayHigh & 0x80) !== 0;
    const timestamp =
      payload.length >= 16 ? view.getFloat64(8, true) : Number.NaN;
    this.#rtcLastUpdatedMs = Number.isFinite(timestamp)
      ? timestamp
      : this.#nowMs();
    this.#rtcLatched = false;
    this.#updateRtc();
    this.#refreshLatchedFromRunning();
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
      if (this.#rtcRegisterSelect !== null && this.#rtcRegisterSelect >= 0x08) {
        if (!this.#hasRtc) {
          return 0xff;
        }
        return this.#readRtc(this.#rtcRegisterSelect);
      }
      if (this.ram.length === 0) {
        return 0xff;
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
      if (!this.#ramEnabled) {
        return true;
      }
      if (this.#rtcRegisterSelect !== null && this.#rtcRegisterSelect >= 0x08) {
        if (this.#hasRtc) {
          this.#writeRtc(this.#rtcRegisterSelect, value & 0xff);
        }
        return true;
      }
      if (this.ram.length === 0) {
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
    if (value >= 0x08 && value <= 0x0c && this.#hasRtc) {
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
    if (this.#latchState === 0 && value === 1) {
      if (this.#hasRtc) {
        this.#updateRtc();
        this.#refreshLatchedFromRunning();
        this.#rtcLatched = true;
      }
      this.#latchState = 1;
      return;
    }
    if (value === 0) {
      this.#latchState = 0;
    }
  }

  #readRtc(register: number): number {
    if (!this.#hasRtc) {
      return 0xff;
    }
    this.#updateRtc();
    if (!this.#rtcLatched) {
      this.#refreshLatchedFromRunning();
    }
    switch (register) {
      case 0x08:
        return this.#rtcLatchedSeconds;
      case 0x09:
        return this.#rtcLatchedMinutes;
      case 0x0a:
        return this.#rtcLatchedHours;
      case 0x0b:
        return this.#rtcLatchedDays & 0xff;
      case 0x0c:
        return this.#rtcLatchedDayHigh;
      default:
        return 0xff;
    }
  }

  #writeRtc(register: number, value: number): void {
    if (!this.#hasRtc) {
      return;
    }
    this.#updateRtc();
    const now = this.#nowMs();
    let changed = false;

    switch (register) {
      case 0x08: {
        const seconds = Math.min(59, value & 0xff);
        changed = changed || seconds !== this.#rtcSeconds;
        this.#rtcSeconds = seconds;
        this.#rtcLastUpdatedMs = now;
        break;
      }
      case 0x09: {
        const minutes = Math.min(59, value & 0xff);
        changed = changed || minutes !== this.#rtcMinutes;
        this.#rtcMinutes = minutes;
        this.#rtcLastUpdatedMs = now;
        break;
      }
      case 0x0a: {
        const hours = Math.min(23, value & 0xff);
        changed = changed || hours !== this.#rtcHours;
        this.#rtcHours = hours;
        this.#rtcLastUpdatedMs = now;
        break;
      }
      case 0x0b: {
        const nextDays = ((value & 0xff) | (this.#rtcDays & 0x100)) % 512;
        changed = changed || nextDays !== this.#rtcDays;
        this.#rtcDays = nextDays;
        this.#rtcLastUpdatedMs = now;
        break;
      }
      case 0x0c: {
        const wasHalted = this.#rtcHalt;
        const nextCarry = (value & 0x80) !== 0;
        const nextHalt = (value & 0x40) !== 0;
        const nextDays = (((value & 0x01) << 8) | (this.#rtcDays & 0xff)) % 512;
        changed =
          changed ||
          nextDays !== this.#rtcDays ||
          nextCarry !== this.#rtcCarry ||
          nextHalt !== this.#rtcHalt;
        this.#rtcDays = nextDays;
        this.#rtcCarry = nextCarry;
        this.#rtcHalt = nextHalt;
        this.#rtcLastUpdatedMs = now;
        if (wasHalted && !this.#rtcHalt) {
          this.#rtcLastUpdatedMs = now;
        }
        break;
      }
      default:
        return;
    }

    this.#refreshLatchedFromRunning();
    if (changed) {
      this.markRamDirty();
    }
  }

  #updateRtc(): void {
    if (!this.#hasRtc) {
      return;
    }
    const now = this.#nowMs();
    if (this.#rtcHalt) {
      this.#rtcLastUpdatedMs = now;
      return;
    }
    const elapsedMs = Math.max(0, now - this.#rtcLastUpdatedMs);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds <= 0) {
      return;
    }
    this.#rtcLastUpdatedMs += elapsedSeconds * 1000;
    this.#advanceRtcBySeconds(elapsedSeconds);
    if (!this.#rtcLatched) {
      this.#refreshLatchedFromRunning();
    }
  }

  #advanceRtcBySeconds(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }
    const totalSeconds = this.#rtcSeconds + deltaSeconds;
    const minutesCarry = Math.floor(totalSeconds / 60);
    this.#rtcSeconds = totalSeconds % 60;

    const totalMinutes = this.#rtcMinutes + minutesCarry;
    const hoursCarry = Math.floor(totalMinutes / 60);
    this.#rtcMinutes = totalMinutes % 60;

    const totalHours = this.#rtcHours + hoursCarry;
    const dayCarry = Math.floor(totalHours / 24);
    this.#rtcHours = totalHours % 24;

    if (dayCarry > 0) {
      const nextDays = this.#rtcDays + dayCarry;
      if (nextDays >= 512) {
        this.#rtcCarry = true;
      }
      this.#rtcDays = nextDays % 512;
    }
  }

  #refreshLatchedFromRunning(): void {
    this.#rtcLatchedSeconds = this.#rtcSeconds;
    this.#rtcLatchedMinutes = this.#rtcMinutes;
    this.#rtcLatchedHours = this.#rtcHours;
    this.#rtcLatchedDays = this.#rtcDays;
    this.#rtcLatchedDayHigh = this.#composeDayHighFlags(
      this.#rtcDays,
      this.#rtcHalt,
      this.#rtcCarry,
    );
  }

  #composeDayHighFlags(days: number, halt: boolean, carry: boolean): number {
    let value = days > 0xff ? 0x01 : 0x00;
    if (halt) {
      value |= 0x40;
    }
    if (carry) {
      value |= 0x80;
    }
    return value & 0xff;
  }

  #writeRtcInt(view: DataView, offset: number, value: number): number {
    view.setInt32(offset, value | 0, true);
    return offset + 4;
  }

  #nowMs(): number {
    return Date.now();
  }
}

class Mbc5Controller extends Mbc {
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

export class MbcFactory {
  describeCartridge(
    rom: Uint8Array,
    romInfo?: { cartridgeType?: number; ramSize?: number } | null,
  ): {
    type: MbcType;
    ramSize: number;
    batteryBacked: boolean;
    hasRtc: boolean;
    hasRumble: boolean;
  } {
    const typeByte = romInfo?.cartridgeType ?? rom[0x147] ?? 0x00;
    const meta = CARTRIDGE_TYPE_TABLE[typeByte] ?? { mbc: "romOnly" };
    const ramAllowed = meta.hasRam ?? false;
    const headerRamSize = romInfo?.ramSize ?? decodeRamSize(rom[0x149] ?? 0x00);
    let ramSize = meta.forceRamSize ?? (ramAllowed ? headerRamSize : 0);
    if (!ramAllowed) {
      ramSize = 0;
    }
    return {
      type: meta.mbc,
      ramSize,
      batteryBacked: Boolean(meta.battery || meta.rtc),
      hasRtc: Boolean(meta.rtc),
      hasRumble: Boolean(meta.rumble),
    };
  }

  detect(rom: Uint8Array): MbcType {
    return this.describeCartridge(rom).type;
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
      case "mbc2":
        return new Mbc2Controller(rom, 512, options);
      case "mbc3":
        return new Mbc3Controller(rom, ramSize, options);
      case "mbc5":
        return new Mbc5Controller(rom, ramSize, options);
      default:
        return new RomOnlyMbc(rom, ramSize, options);
    }
  }
}
