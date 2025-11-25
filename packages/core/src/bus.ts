import { InterruptType } from "./cpu.js";
import { JoypadInputState, createEmptyJoypadState } from "./input.js";
import { Mbc } from "./mbc.js";

const JOYPAD_REGISTER_ADDRESS = 0xff00;
const DIVIDER_REGISTER_ADDRESS = 0xff04;
const TIMA_REGISTER_ADDRESS = 0xff05;
const TMA_REGISTER_ADDRESS = 0xff06;
const TAC_REGISTER_ADDRESS = 0xff07;
const INTERRUPT_FLAG_ADDRESS = 0xff0f;
const DMA_REGISTER_ADDRESS = 0xff46;
const OAM_START_ADDRESS = 0xfe00;
const OAM_BLOCK_END_ADDRESS = 0xfeff;
const OAM_TRANSFER_SIZE = 0xa0;
const OAM_TRANSFER_TICKS = OAM_TRANSFER_SIZE * 4 + 4;
const TAC_ENABLE_BIT = 0x04;
const TAC_CLOCK_SELECT_MASK = 0x03;
const TAC_UPPER_BITS = 0xf8;
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
  readByte(address: number, ticksAhead?: number): number;
  writeByte(address: number, value: number, ticksAhead?: number): void;
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
  #joypadState: JoypadInputState = createEmptyJoypadState();
  #dividerCounter = 0;
  #timerSignal = false;
  #timaReloadPending = false;
  #timaReloadDelay = 0;
  #oamDmaRemainingTicks = 0;
  #oamDmaSource = 0;
  #oamDmaIndex = 0;
  #suppressOamDmaStep = false;

  loadCartridge(rom: Uint8Array, mbc?: Mbc): void {
    this.#pendingInterrupts.clear();
    this.#memory.fill(0);
    this.#joypadState = createEmptyJoypadState();
    this.#oamDmaRemainingTicks = 0;
    this.#oamDmaSource = 0;
    this.#oamDmaIndex = 0;
    this.#suppressOamDmaStep = false;
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
    this.#resetTimerState();
  }

  refreshExternalRamWindow(): void {
    this.#mirrorExternalRamWindow();
  }

  mapBank(_bank: MemoryBank): void {
    // No dynamic mapping in stub.
  }

  unmapBank(_range: AddressRange): void {
    // No dynamic mapping in stub.
  }

  readByte(address: number, ticksAhead = 0): number {
    return this.#readByteInternal(address, false, ticksAhead);
  }

  #readByteInternal(
    address: number,
    bypassDmaBlocking = false,
    ticksAhead = 0,
  ): number {
    const mappedAddress = address & 0xffff;

    const dmaTicksRemaining = this.#oamDmaRemainingTicks - ticksAhead;

    if (
      !bypassDmaBlocking &&
      dmaTicksRemaining > 0 &&
      this.#isBlockedDuringOamDma(mappedAddress)
    ) {
      return 0xff;
    }

    if (this.#mbc) {
      const value = this.#mbc.read(mappedAddress);
      if (value !== null && value !== undefined) {
        return value & 0xff;
      }
    }
    if (mappedAddress === DIVIDER_REGISTER_ADDRESS) {
      return this.#readDivider();
    }
    if (mappedAddress === TAC_REGISTER_ADDRESS) {
      return this.#memory[TAC_REGISTER_ADDRESS] ?? 0xff;
    }
    return this.#memory[mappedAddress] ?? 0xff;
  }

  writeByte(address: number, value: number, ticksAhead = 0): void {
    const mappedAddress = address & 0xffff;
    const byteValue = value & 0xff;

    const dmaTicksRemaining = this.#oamDmaRemainingTicks - ticksAhead;
    if (
      dmaTicksRemaining > 0 &&
      this.#isBlockedDuringOamDma(mappedAddress)
    ) {
      return;
    }

    if (this.#mbc?.write(mappedAddress, byteValue)) {
      this.#mirrorAfterMbcWrite(mappedAddress);
      return;
    }

    if (mappedAddress === JOYPAD_REGISTER_ADDRESS) {
      this.#updateJoypadRegister(byteValue & 0x30);
      return;
    }

    if (mappedAddress === DIVIDER_REGISTER_ADDRESS) {
      this.#writeDivider();
      return;
    }

    if (mappedAddress === TIMA_REGISTER_ADDRESS) {
      this.#writeTima(byteValue);
      return;
    }

    if (mappedAddress === TMA_REGISTER_ADDRESS) {
      this.#writeTma(byteValue);
      return;
    }

    if (mappedAddress === TAC_REGISTER_ADDRESS) {
      this.#writeTac(byteValue);
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
    this.#memory[DIVIDER_REGISTER_ADDRESS] = (this.#dividerCounter >> 8) & 0xff;
    return this.#memory.slice();
  }

  dmaTransfer(source: number): void {
    const startAddress = (source & 0xff) << 8;
    this.performTransfer("oam", startAddress);
  }

  performTransfer(type: DmaTransferType, source: number): void {
    if (type === "oam") {
      this.#startOamDmaTransfer(source);
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

  setJoypadState(state: JoypadInputState): void {
    this.#joypadState = { ...state };
    this.#updateJoypadRegister();
  }

  tick(cycles: number): void {
    if (cycles <= 0) {
      return;
    }

    let remainingTicks = cycles * 4;
    const skipOamDma = this.#suppressOamDmaStep;
    if (skipOamDma) {
      this.#suppressOamDmaStep = false;
    }

    while (remainingTicks > 0) {
      if (!skipOamDma) {
        this.#stepOamDma();
      }
      this.#stepTimaReload();
      const nextCounter = (this.#dividerCounter + 1) & 0xffff;
      this.#updateTimerSignalOnCounterChange(this.#dividerCounter, nextCounter);
      this.#dividerCounter = nextCounter;
      remainingTicks -= 1;
    }

    this.#memory[DIVIDER_REGISTER_ADDRESS] = (this.#dividerCounter >> 8) & 0xff;
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
    this.#updateJoypadRegister(
      this.#memory[JOYPAD_REGISTER_ADDRESS] & 0x30,
      false,
    );
    this.#memory[TAC_REGISTER_ADDRESS] = this.#normalizeTac(
      this.#memory[TAC_REGISTER_ADDRESS] ?? 0,
    );
  }

  #startOamDmaTransfer(source: number): void {
    this.#oamDmaSource = source & 0xff00;
    this.#oamDmaIndex = 0;
    this.#oamDmaRemainingTicks = OAM_TRANSFER_TICKS;
    this.#suppressOamDmaStep = true;
  }

  #stepOamDma(): void {
    if (!this.#isOamDmaActive()) {
      return;
    }

    const ticksElapsed = OAM_TRANSFER_TICKS - this.#oamDmaRemainingTicks;
    const currentIndex = Math.floor(ticksElapsed / 4);

    if (
      ticksElapsed % 4 === 0 &&
      currentIndex < OAM_TRANSFER_SIZE &&
      this.#oamDmaIndex === currentIndex
    ) {
      const readAddress = (this.#oamDmaSource + currentIndex) & 0xffff;
      const value = this.#readByteInternal(readAddress, true);
      this.#memory[OAM_START_ADDRESS + currentIndex] = value & 0xff;
      this.#oamDmaIndex += 1;
    }

    this.#oamDmaRemainingTicks -= 1;
  }

  #isOamDmaActive(): boolean {
    return this.#oamDmaRemainingTicks > 0;
  }

  #isBlockedDuringOamDma(address: number): boolean {
    return address >= OAM_START_ADDRESS && address <= OAM_BLOCK_END_ADDRESS;
  }

  #composeJoypadValue(selectBits: number, state: JoypadInputState): number {
    const selectButtons = (selectBits & 0x20) === 0;
    const selectDpad = (selectBits & 0x10) === 0;

    let lower = 0x0f;

    if (selectButtons) {
      if (state.a) lower &= ~0x01;
      if (state.b) lower &= ~0x02;
      if (state.select) lower &= ~0x04;
      if (state.start) lower &= ~0x08;
    }

    if (selectDpad) {
      if (state.right) lower &= ~0x01;
      if (state.left) lower &= ~0x02;
      if (state.up) lower &= ~0x04;
      if (state.down) lower &= ~0x08;
    }

    return (0xc0 | selectBits | lower) & 0xff;
  }

  #updateJoypadRegister(selectBits?: number, triggerInterrupt = true): void {
    const previous = this.#memory[JOYPAD_REGISTER_ADDRESS] ?? 0xff;
    const nextSelect = selectBits ?? previous & 0x30;
    const next = this.#composeJoypadValue(nextSelect, this.#joypadState);
    this.#memory[JOYPAD_REGISTER_ADDRESS] = next;

    if (!triggerInterrupt) {
      return;
    }

    const prevNibble = previous & 0x0f;
    const nextNibble = next & 0x0f;
    const highToLow = prevNibble & ~nextNibble & 0x0f;
    if (highToLow !== 0) {
      this.requestInterrupt("joypad");
    }
  }

  #normalizeTac(value: number): number {
    return (value & 0x07) | TAC_UPPER_BITS;
  }

  #getTimerClockBitMask(tacValue: number): number {
    switch (tacValue & TAC_CLOCK_SELECT_MASK) {
      case 0x01:
        return 1 << 3;
      case 0x02:
        return 1 << 5;
      case 0x03:
        return 1 << 7;
      case 0x00:
      default:
        return 1 << 9;
    }
  }

  #computeTimerSignal(
    counter = this.#dividerCounter,
    tacValue?: number,
  ): boolean {
    const tac = tacValue ?? this.#memory[TAC_REGISTER_ADDRESS] ?? 0;
    const timerEnabled = (tac & TAC_ENABLE_BIT) !== 0;
    if (!timerEnabled) {
      return false;
    }
    const mask = this.#getTimerClockBitMask(tac);
    return (counter & mask) !== 0;
  }

  #updateTimerSignalOnCounterChange(
    previousCounter: number,
    nextCounter: number,
    tacValue?: number,
  ): void {
    const tac = tacValue ?? this.#memory[TAC_REGISTER_ADDRESS] ?? 0;
    const previousSignal =
      this.#timerSignal ?? this.#computeTimerSignal(previousCounter, tac);
    const nextSignal = this.#computeTimerSignal(nextCounter, tac);
    if (previousSignal && !nextSignal) {
      this.#onTimerTick();
    }
    this.#timerSignal = nextSignal;
  }

  #resetTimerState(): void {
    this.#dividerCounter =
      ((this.#memory[DIVIDER_REGISTER_ADDRESS] ?? 0) << 8) & 0xffff;
    this.#timaReloadPending = false;
    this.#timaReloadDelay = 0;
    this.#timerSignal = this.#computeTimerSignal();
  }

  #readDivider(): number {
    const value = (this.#dividerCounter >> 8) & 0xff;
    this.#memory[DIVIDER_REGISTER_ADDRESS] = value;
    return value;
  }

  #writeDivider(): void {
    this.#updateTimerSignalOnCounterChange(this.#dividerCounter, 0);
    this.#dividerCounter = 0;
    this.#memory[DIVIDER_REGISTER_ADDRESS] = 0;
  }

  #writeTima(value: number): void {
    if (this.#timaReloadPending && this.#timaReloadDelay > 0) {
      this.#timaReloadPending = false;
      this.#timaReloadDelay = 0;
    }
    this.#memory[TIMA_REGISTER_ADDRESS] = value & 0xff;
  }

  #writeTma(value: number): void {
    const nextValue = value & 0xff;
    this.#memory[TMA_REGISTER_ADDRESS] = nextValue;
  }

  #writeTac(value: number): void {
    const normalized = this.#normalizeTac(value);
    const previousTac = this.#memory[TAC_REGISTER_ADDRESS] ?? 0;
    const previousSignal = this.#computeTimerSignal(
      this.#dividerCounter,
      previousTac,
    );

    this.#memory[TAC_REGISTER_ADDRESS] = normalized;

    const nextSignal = this.#computeTimerSignal(
      this.#dividerCounter,
      normalized,
    );
    if (previousSignal && !nextSignal) {
      this.#onTimerTick();
    }

    this.#timerSignal = nextSignal;
  }

  #stepTimaReload(): void {
    if (!this.#timaReloadPending) {
      return;
    }

    if (this.#timaReloadDelay > 0) {
      this.#timaReloadDelay -= 1;
    }

    if (this.#timaReloadDelay === 0) {
      this.#timaReloadPending = false;
      const reloadValue = this.#memory[TMA_REGISTER_ADDRESS] ?? 0;
      this.#memory[TIMA_REGISTER_ADDRESS] = reloadValue & 0xff;
      this.requestInterrupt("timer");
    }
  }

  #onTimerTick(): void {
    const current = this.#memory[TIMA_REGISTER_ADDRESS] ?? 0;
    const nextValue = (current + 1) & 0xff;
    this.#memory[TIMA_REGISTER_ADDRESS] = nextValue;

    if (nextValue === 0x00 && current === 0xff) {
      this.#timaReloadPending = true;
      this.#timaReloadDelay = 4;
    }
  }
}
