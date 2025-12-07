import { RAM_BANK_SIZE, ROM_BANK_SIZE } from "./constants.js";

export type MbcType =
  | "romOnly"
  | "mbc1"
  | "mbc2"
  | "mbc3"
  | "mbc5"
  | "mbc6"
  | "mbc7";

export interface MbcOptions {
  onRamWrite?: () => void;
}

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
