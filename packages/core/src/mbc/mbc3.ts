import { RAM_BANK_SIZE, ROM_BANK_SIZE } from "./constants.js";
import { MbcOptions } from "./base.js";
import { Mbc } from "./base.js";

export class Mbc3Controller extends Mbc {
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
