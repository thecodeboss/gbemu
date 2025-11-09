import { InterruptType } from "./cpu.js";

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

export class SystemBus
  implements MemoryController, DirectMemoryAccess, InterruptController
{
  #memory = new Uint8Array(0x10000);
  #pendingInterrupts = new Set<InterruptType>();

  loadCartridge(rom: Uint8Array): void {
    const romBankSize = 0x4000;
    const bank0 = rom.slice(0, romBankSize);
    this.#memory.set(bank0, 0x0000);

    const bank1 = rom.slice(romBankSize, romBankSize * 2);
    if (bank1.length > 0) {
      this.#memory.set(bank1, romBankSize);
    } else if (rom.length > 0) {
      const mirrorSource = rom.slice(0, Math.min(rom.length, romBankSize));
      this.#memory.set(mirrorSource, romBankSize);
    }

    this.#memory[0xff50] = 0x01;
  }

  mapBank(_bank: MemoryBank): void {
    // No dynamic mapping in stub.
  }

  unmapBank(_range: AddressRange): void {
    // No dynamic mapping in stub.
  }

  readByte(address: number): number {
    return this.#memory[address & 0xffff] ?? 0xff;
  }

  writeByte(address: number, value: number): void {
    this.#memory[address & 0xffff] = value & 0xff;
  }

  readWord(address: number): number {
    const lo = this.readByte(address);
    const hi = this.readByte(address + 1);
    return (hi << 8) | lo;
  }

  writeWord(address: number, value: number): void {
    this.writeByte(address, value & 0xff);
    this.writeByte(address + 1, (value >> 8) & 0xff);
  }

  dumpMemory(): Uint8Array {
    return this.#memory.slice();
  }

  dmaTransfer(_source: number): void {
    // No DMA support in stub.
  }

  performTransfer(_type: DmaTransferType, _source: number): void {
    // No general DMA support in stub.
  }

  requestInterrupt(type: InterruptType): void {
    this.#pendingInterrupts.add(type);
  }

  acknowledgeInterrupt(type: InterruptType): void {
    this.#pendingInterrupts.delete(type);
  }

  getPendingInterrupts(): InterruptType[] {
    return Array.from(this.#pendingInterrupts);
  }

  tick(_cycles: number): void {
    // No bus timing in stub.
  }
}
