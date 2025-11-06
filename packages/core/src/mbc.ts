import { AddressRange, MemoryBank } from "./bus.js";

export type MbcType =
  | "romOnly"
  | "mbc1"
  | "mbc2"
  | "mbc3"
  | "mbc5"
  | "mbc6"
  | "mbc7";

class InMemoryBank implements MemoryBank {
  readonly range: AddressRange;
  #storage: Uint8Array;

  constructor(range: AddressRange, size: number) {
    this.range = range;
    this.#storage = new Uint8Array(size);
  }

  readByte(offset: number): number {
    return this.#storage[offset] ?? 0xff;
  }

  writeByte(offset: number, value: number): void {
    if (offset < this.#storage.length) {
      this.#storage[offset] = value & 0xff;
    }
  }

  serialize(): Uint8Array {
    return this.#storage.slice();
  }

  deserialize(data: Uint8Array): void {
    this.#storage.set(data.subarray(0, this.#storage.length));
  }
}

export class Mbc {
  readonly type: MbcType;
  readonly romBanks: MemoryBank[];
  readonly ramBanks: MemoryBank[];

  constructor(type: MbcType, romSize: number, ramSize: number) {
    this.type = type;
    this.romBanks = [
      new InMemoryBank(
        { start: 0x0000, end: Math.max(0, romSize - 1) },
        romSize || 0x4000,
      ),
    ];
    this.ramBanks = ramSize
      ? [
          new InMemoryBank(
            { start: 0xa000, end: 0xa000 + Math.max(0, ramSize - 1) },
            ramSize,
          ),
        ]
      : [];
  }

  reset(): void {
    // No-op for stub.
  }

  selectRomBank(_index: number): void {
    // No banking logic in stub.
  }

  selectRamBank(_index: number): void {
    // No banking logic in stub.
  }

  enableRam(_enabled: boolean): void {
    // No-op for stub.
  }

  handleWrite(_address: number, _value: number): void {
    // No banking logic in stub.
  }

  serialize(): Uint8Array {
    return new Uint8Array();
  }

  deserialize(_data: Uint8Array): void {
    // Nothing persisted in stub.
  }
}

export class MbcFactory {
  detect(_rom: Uint8Array): MbcType {
    return "romOnly";
  }

  create(type: MbcType, rom: Uint8Array, ramSize: number): Mbc {
    const romSizeBytes = rom.byteLength || 0x4000;
    return new Mbc(type, romSizeBytes, ramSize);
  }
}
