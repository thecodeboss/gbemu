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

  getRtcSnapshot(): Uint8Array | null {
    if (!this.#hasRtc) {
      return null;
    }
    this.#updateRtc();
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    view.setUint8(0, this.#rtcSeconds & 0xff);
    view.setUint8(1, this.#rtcMinutes & 0xff);
    view.setUint8(2, this.#rtcHours & 0xff);
    view.setUint8(3, this.#rtcDays & 0xff);
    view.setUint8(
      4,
      this.#composeDayHighFlags(this.#rtcDays, this.#rtcHalt, this.#rtcCarry),
    );
    view.setUint8(5, 0x00);
    view.setUint8(6, 0x00);
    view.setUint8(7, 0x00);
    view.setFloat64(8, this.#rtcLastUpdatedMs, true);
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

  #nowMs(): number {
    return Date.now();
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
