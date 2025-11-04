import type { MemoryBank } from "./bus.js";

export type MbcType =
  | "romOnly"
  | "mbc1"
  | "mbc2"
  | "mbc3"
  | "mbc5"
  | "mbc6"
  | "mbc7";

export interface MbcFactory {
  detect(rom: Uint8Array): MbcType;
  create(type: MbcType, rom: Uint8Array, ramSize: number): Mbc;
}

export interface Mbc {
  readonly type: MbcType;
  readonly romBanks: MemoryBank[];
  readonly ramBanks: MemoryBank[];
  reset(): void;
  selectRomBank(index: number): void;
  selectRamBank(index: number): void;
  enableRam(enabled: boolean): void;
  handleWrite(address: number, value: number): void;
  serialize(): Uint8Array;
  deserialize(data: Uint8Array): void;
}
