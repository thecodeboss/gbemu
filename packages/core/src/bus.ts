import { InterruptType } from "./cpu.js";
import { Mbc } from "./mbc.js";

const INTERRUPT_FLAG_ADDRESS = 0xff0f;
const DMA_REGISTER_ADDRESS = 0xff46;
const OAM_START_ADDRESS = 0xfe00;
const OAM_TRANSFER_SIZE = 0xa0;
const INTERRUPT_BITS: Record<InterruptType, number> = {
  vblank: 0x01,
  lcdStat: 0x02,
  timer: 0x04,
  serial: 0x08,
  joypad: 0x10,
};

// DMG defaults gathered from Pan Docs' Power-Up Sequence tables.
const DMG_HARDWARE_REGISTER_DEFAULTS: ReadonlyArray<readonly [number, number]> =
  [
    [0xff00, 0xcf], // P1
    [0xff01, 0x00], // SB
    [0xff02, 0x7e], // SC
    [0xff04, 0xab], // DIV
    [0xff05, 0x00], // TIMA
    [0xff06, 0x00], // TMA
    [0xff07, 0xf8], // TAC (upper bits read as 1)
    [0xff0f, 0xe1], // IF
    [0xff10, 0x80], // NR10
    [0xff11, 0xbf], // NR11
    [0xff12, 0xf3], // NR12
    [0xff13, 0xff], // NR13
    [0xff14, 0xbf], // NR14
    [0xff16, 0x3f], // NR21
    [0xff17, 0x00], // NR22
    [0xff18, 0xff], // NR23
    [0xff19, 0xbf], // NR24
    [0xff1a, 0x7f], // NR30
    [0xff1b, 0xff], // NR31
    [0xff1c, 0x9f], // NR32
    [0xff1d, 0xff], // NR33
    [0xff1e, 0xbf], // NR34
    [0xff20, 0xff], // NR41
    [0xff21, 0x00], // NR42
    [0xff22, 0x00], // NR43
    [0xff23, 0xbf], // NR44
    [0xff24, 0x77], // NR50
    [0xff25, 0xf3], // NR51
    [0xff26, 0xf1], // NR52
    [0xff40, 0x91], // LCDC
    [0xff41, 0x85], // STAT
    [0xff42, 0x00], // SCY
    [0xff43, 0x00], // SCX
    [0xff44, 0x00], // LY
    [0xff45, 0x00], // LYC
    [0xff46, 0xff], // DMA
    [0xff47, 0xfc], // BGP
    [0xff48, 0xff], // OBP0 (uninitialized on hardware; default to white)
    [0xff49, 0xff], // OBP1 (uninitialized on hardware; default to white)
    [0xff4a, 0x00], // WY
    [0xff4b, 0x00], // WX
    [0xff50, 0x01], // BANK
    [0xffff, 0x00], // IE
  ];

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
  #mbc: Mbc | null = null;

  loadCartridge(rom: Uint8Array, mbc?: Mbc): void {
    this.#pendingInterrupts.clear();
    this.#memory.fill(0);
    this.#mbc = mbc ?? null;
    this.#mbc?.reset();

    if (this.#mbc) {
      this.#mirrorFixedRomBank();
      this.#mirrorSwitchableRomBank();
      this.#mirrorExternalRamWindow();
    } else {
      const mirrorLength = Math.min(rom.length, 0x8000);
      this.#memory.set(rom.subarray(0, mirrorLength), 0x0000);
    }

    this.#initializeHardwareRegisters();
  }

  mapBank(_bank: MemoryBank): void {
    // No dynamic mapping in stub.
  }

  unmapBank(_range: AddressRange): void {
    // No dynamic mapping in stub.
  }

  readByte(address: number): number {
    const mappedAddress = address & 0xffff;
    if (this.#mbc) {
      const value = this.#mbc.read(mappedAddress);
      if (value !== null && value !== undefined) {
        return value & 0xff;
      }
    }
    return this.#memory[mappedAddress] ?? 0xff;
  }

  writeByte(address: number, value: number): void {
    const mappedAddress = address & 0xffff;
    const byteValue = value & 0xff;

    if (this.#mbc?.write(mappedAddress, byteValue)) {
      this.#mirrorAfterMbcWrite(mappedAddress);
      return;
    }

    this.#memory[mappedAddress] = byteValue;

    if (mappedAddress === INTERRUPT_FLAG_ADDRESS) {
      this.#syncPendingInterrupts(byteValue);
    }

    if (mappedAddress === DMA_REGISTER_ADDRESS) {
      this.dmaTransfer(byteValue);
    }
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

  dmaTransfer(source: number): void {
    const startAddress = (source & 0xff) << 8;
    this.performTransfer("oam", startAddress);
  }

  performTransfer(type: DmaTransferType, source: number): void {
    if (type === "oam") {
      this.#performOamDmaTransfer(source);
    }
  }

  requestInterrupt(type: InterruptType): void {
    const bit = INTERRUPT_BITS[type];
    this.#pendingInterrupts.add(type);
    const nextValue = this.#memory[INTERRUPT_FLAG_ADDRESS] | bit;
    this.#memory[INTERRUPT_FLAG_ADDRESS] = nextValue & 0xff;
  }

  acknowledgeInterrupt(type: InterruptType): void {
    const bit = INTERRUPT_BITS[type];
    this.#pendingInterrupts.delete(type);
    const nextValue = this.#memory[INTERRUPT_FLAG_ADDRESS] & ~bit;
    this.#memory[INTERRUPT_FLAG_ADDRESS] = nextValue & 0xff;
  }

  getPendingInterrupts(): InterruptType[] {
    return Array.from(this.#pendingInterrupts);
  }

  tick(_cycles: number): void {
    // No bus timing in stub.
  }

  #mirrorAfterMbcWrite(address: number): void {
    if (!this.#mbc) {
      return;
    }
    if (address < 0x2000) {
      this.#mirrorExternalRamWindow();
      return;
    }
    if (address < 0x4000) {
      this.#mirrorSwitchableRomBank();
      return;
    }
    if (address < 0x6000) {
      this.#mirrorExternalRamWindow();
      return;
    }
    if (address < 0x8000) {
      return;
    }
    if (address >= 0xa000 && address < 0xc000) {
      const value = this.#mbc.read(address);
      this.#memory[address] = value ?? 0xff;
    }
  }

  #mirrorFixedRomBank(): void {
    if (!this.#mbc) {
      return;
    }
    for (let offset = 0; offset < 0x4000; offset += 1) {
      const value = this.#mbc.read(offset) ?? 0xff;
      this.#memory[offset] = value & 0xff;
    }
  }

  #mirrorSwitchableRomBank(): void {
    if (!this.#mbc) {
      return;
    }
    for (let offset = 0; offset < 0x4000; offset += 1) {
      const address = 0x4000 + offset;
      const value = this.#mbc.read(address) ?? 0xff;
      this.#memory[address] = value & 0xff;
    }
  }

  #mirrorExternalRamWindow(): void {
    if (!this.#mbc) {
      return;
    }
    for (let offset = 0; offset < 0x2000; offset += 1) {
      const address = 0xa000 + offset;
      const value = this.#mbc.read(address);
      if (value === null) {
        break;
      }
      this.#memory[address] = value & 0xff;
    }
  }

  #syncPendingInterrupts(value: number): void {
    this.#pendingInterrupts.clear();
    for (const [type, bit] of Object.entries(INTERRUPT_BITS)) {
      if ((value & bit) !== 0) {
        this.#pendingInterrupts.add(type as InterruptType);
      }
    }
  }

  #initializeHardwareRegisters(): void {
    for (const [address, value] of DMG_HARDWARE_REGISTER_DEFAULTS) {
      this.#memory[address] = value & 0xff;
    }
  }

  #performOamDmaTransfer(source: number): void {
    const startAddress = source & 0xff00;
    for (let offset = 0; offset < OAM_TRANSFER_SIZE; offset += 1) {
      const readAddress = (startAddress + offset) & 0xffff;
      const value = this.readByte(readAddress);
      this.#memory[OAM_START_ADDRESS + offset] = value & 0xff;
    }
  }
}
