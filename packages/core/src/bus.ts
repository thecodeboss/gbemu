import type { InterruptType } from "./cpu.js";

export type DmaTransferType = "oam" | "hdma";

export interface AddressRange {
  start: number;
  end: number;
}

export interface MemoryBank {
  range: AddressRange;
  readByte(offset: number): number;
  writeByte(offset: number, value: number): void;
  serialize?(): Uint8Array;
  deserialize?(data: Uint8Array): void;
}

export interface MemoryController {
  mapBank(bank: MemoryBank): void;
  unmapBank(range: AddressRange): void;
  readByte(address: number): number;
  writeByte(address: number, value: number): void;
}

export interface DirectMemoryAccess {
  performTransfer(type: DmaTransferType, source: number): void;
}

export interface InterruptController {
  requestInterrupt(type: InterruptType): void;
  acknowledgeInterrupt(type: InterruptType): void;
  getPendingInterrupts(): InterruptType[];
}

export interface SystemBus
  extends MemoryController,
    DirectMemoryAccess,
    InterruptController {
  readWord(address: number): number;
  writeWord(address: number, value: number): void;
  tick(cycles: number): void;
}
