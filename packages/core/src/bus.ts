import { InterruptType } from "./cpu-instructions/constants.js";
import { JoypadInputState, createEmptyJoypadState } from "./input.js";
import { Mbc } from "./mbc.js";

type HardwareMode = "dmg" | "cgb";

const JOYPAD_REGISTER_ADDRESS = 0xff00;
const DIVIDER_REGISTER_ADDRESS = 0xff04;
const TIMA_REGISTER_ADDRESS = 0xff05;
const TMA_REGISTER_ADDRESS = 0xff06;
const TAC_REGISTER_ADDRESS = 0xff07;
const INTERRUPT_FLAG_ADDRESS = 0xff0f;
const DMA_REGISTER_ADDRESS = 0xff46;
const KEY1_REGISTER_ADDRESS = 0xff4d;
const VBK_REGISTER_ADDRESS = 0xff4f;
const HDMA1_REGISTER_ADDRESS = 0xff51;
const HDMA2_REGISTER_ADDRESS = 0xff52;
const HDMA3_REGISTER_ADDRESS = 0xff53;
const HDMA4_REGISTER_ADDRESS = 0xff54;
const HDMA5_REGISTER_ADDRESS = 0xff55;
const RP_REGISTER_ADDRESS = 0xff56;
const BCPS_REGISTER_ADDRESS = 0xff68;
const BCPD_REGISTER_ADDRESS = 0xff69;
const OCPS_REGISTER_ADDRESS = 0xff6a;
const OCPD_REGISTER_ADDRESS = 0xff6b;
const OPRI_REGISTER_ADDRESS = 0xff6c;
const SVBK_REGISTER_ADDRESS = 0xff70;
const PCM12_REGISTER_ADDRESS = 0xff76;
const PCM34_REGISTER_ADDRESS = 0xff77;

const COMPAT_BG_DEFAULT: readonly number[] = [0x7fff, 0x56b5, 0x2d6b, 0x18c6];
const COMPAT_OBJ0_DEFAULT: readonly number[] = [0x7fff, 0x56b5, 0x2d6b, 0x18c6];
const COMPAT_OBJ1_DEFAULT: readonly number[] = [0x7fff, 0x5ad6, 0x35ad, 0x10a5];
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

const FORCED_ONE_BITMASKS: Readonly<Record<number, number>> = {
  [0xff00]: 0xc0, // P1: upper bits always read high.
  [0xff02]: 0x7e, // SC: unused bits read as 1.
  [0xff07]: 0xf8, // TAC: upper bits read as 1.
  [0xff0f]: 0xe0, // IF: upper bits read as 1.
  [0xff10]: 0x80, // NR10: bit 7 unused.
  [0xff1a]: 0x7f, // NR30: bits 0-6 unused.
  [0xff1c]: 0x9f, // NR32: bits 7 and 0-4 unused.
  [0xff20]: 0xc0, // NR41: upper bits unused.
  [0xff23]: 0x3f, // NR44: lower bits unused.
  [0xff26]: 0x70, // NR52: bits 4-6 unused.
  [0xff41]: 0x80, // STAT: bit 7 unused.
  [KEY1_REGISTER_ADDRESS]: 0x7e, // KEY1: bits 1-6 read high.
  [VBK_REGISTER_ADDRESS]: 0xfe, // VBK: upper bits read high.
  [SVBK_REGISTER_ADDRESS]: 0xf8, // SVBK: upper bits read high.
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

const CGB_ONLY_REGISTER_DEFAULTS: ReadonlyArray<readonly [number, number]> = [
  [KEY1_REGISTER_ADDRESS, 0x7e],
  [VBK_REGISTER_ADDRESS, 0xfe],
  [HDMA1_REGISTER_ADDRESS, 0xff],
  [HDMA2_REGISTER_ADDRESS, 0xff],
  [HDMA3_REGISTER_ADDRESS, 0xff],
  [HDMA4_REGISTER_ADDRESS, 0xff],
  [HDMA5_REGISTER_ADDRESS, 0xff],
  [RP_REGISTER_ADDRESS, 0x00],
  [BCPS_REGISTER_ADDRESS, 0x00],
  [BCPD_REGISTER_ADDRESS, 0x00],
  [OCPS_REGISTER_ADDRESS, 0x00],
  [OCPD_REGISTER_ADDRESS, 0x00],
  [OPRI_REGISTER_ADDRESS, 0x01],
  [SVBK_REGISTER_ADDRESS, 0xf8],
  [PCM12_REGISTER_ADDRESS, 0x00],
  [PCM34_REGISTER_ADDRESS, 0x00],
];

export class SystemBus {
  #memory = new Uint8Array(0x10000);
  #hardwareMode: HardwareMode = "dmg";
  #cgbMode = false;
  #doubleSpeed = false;
  #ticksPerCpuCycle = 4;
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
  #vramBanks: [Uint8Array, Uint8Array] = [
    new Uint8Array(0x2000),
    new Uint8Array(0x2000),
  ];
  #activeVramBank = 0;
  #wramBank0 = new Uint8Array(0x1000);
  #wramBanks: Uint8Array[] = Array.from(
    { length: 7 },
    () => new Uint8Array(0x1000),
  );
  #activeWramBank = 1;
  #bgPaletteData = new Uint8Array(0x40);
  #objPaletteData = new Uint8Array(0x40);
  #bgPaletteIndex = 0;
  #objPaletteIndex = 0;
  #bgPaletteAutoIncrement = false;
  #objPaletteAutoIncrement = false;
  #hdmaActive = false;
  #hdmaHblankMode = false;
  #hdmaBlocksRemaining = 0;
  #hdmaSource = 0;
  #hdmaDestination = 0;
  #speedSwitchRequested = false;

  setSystemMode(hardwareMode: HardwareMode, cgbMode: boolean): void {
    this.#hardwareMode = hardwareMode;
    this.#cgbMode = hardwareMode === "cgb" && cgbMode;
    this.#doubleSpeed = false;
    this.#speedSwitchRequested = false;
    this.#ticksPerCpuCycle = 4;
  }

  getTicksPerCpuCycle(): number {
    return this.#ticksPerCpuCycle;
  }

  isDoubleSpeed(): boolean {
    return this.#doubleSpeed;
  }

  isCgbMode(): boolean {
    return this.#cgbMode;
  }

  loadCartridge(rom: Uint8Array, mbc?: Mbc): void {
    this.#pendingInterrupts.clear();
    this.#memory.fill(0);
    this.#vramBanks[0].fill(0);
    this.#vramBanks[1].fill(0);
    this.#wramBank0.fill(0);
    for (const bank of this.#wramBanks) {
      bank.fill(0);
    }
    this.#bgPaletteData.fill(0);
    this.#objPaletteData.fill(0);
    this.#bgPaletteIndex = 0;
    this.#objPaletteIndex = 0;
    this.#bgPaletteAutoIncrement = false;
    this.#objPaletteAutoIncrement = false;
    this.#activeVramBank = 0;
    this.#activeWramBank = 1;
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
    if (this.#hardwareMode === "cgb" && !this.#cgbMode) {
      this.#loadCompatibilityPalettes();
    }
    this.#resetTimerState();
  }

  refreshExternalRamWindow(): void {
    this.#mirrorExternalRamWindow();
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

    if (this.#isCgbRegister(mappedAddress) && !this.#cgbMode) {
      return 0xff;
    }

    if (mappedAddress >= 0x8000 && mappedAddress < 0xa000) {
      return this.#applyForcedOnes(
        mappedAddress,
        this.#readVramBanked(mappedAddress),
      );
    }

    if (mappedAddress >= 0xc000 && mappedAddress < 0xd000) {
      const offset = mappedAddress - 0xc000;
      return this.#wramBank0[offset] ?? 0xff;
    }

    if (mappedAddress >= 0xd000 && mappedAddress < 0xe000) {
      const offset = mappedAddress - 0xd000;
      const bankIndex = this.#activeWramBank - 1;
      return this.#wramBanks[bankIndex]?.[offset] ?? 0xff;
    }

    if (mappedAddress >= 0xe000 && mappedAddress < 0xfe00) {
      // Echo of WRAM.
      return this.#readByteInternal(mappedAddress - 0x2000, true, ticksAhead);
    }

    const cgbRegisterRead = this.#readCgbRegister(mappedAddress);
    if (cgbRegisterRead !== null) {
      return this.#applyForcedOnes(mappedAddress, cgbRegisterRead & 0xff);
    }

    if (this.#isUnmappedIoRegister(mappedAddress)) {
      return 0xff;
    }

    if (this.#mbc) {
      const value = this.#mbc.read(mappedAddress);
      if (value !== null && value !== undefined) {
        return this.#applyForcedOnes(mappedAddress, value & 0xff);
      }
    }
    if (mappedAddress === DIVIDER_REGISTER_ADDRESS) {
      return this.#applyForcedOnes(mappedAddress, this.#readDivider() & 0xff);
    }
    if (mappedAddress === TAC_REGISTER_ADDRESS) {
      return this.#applyForcedOnes(
        mappedAddress,
        this.#memory[TAC_REGISTER_ADDRESS] ?? 0xff,
      );
    }
    return this.#applyForcedOnes(
      mappedAddress,
      this.#memory[mappedAddress] ?? 0xff,
    );
  }

  writeByte(address: number, value: number, ticksAhead = 0): void {
    const mappedAddress = address & 0xffff;
    const byteValue = value & 0xff;

    const dmaTicksRemaining = this.#oamDmaRemainingTicks - ticksAhead;
    if (dmaTicksRemaining > 0 && this.#isBlockedDuringOamDma(mappedAddress)) {
      return;
    }

    if (this.#isCgbRegister(mappedAddress) && !this.#cgbMode) {
      return;
    }

    if (mappedAddress >= 0x8000 && mappedAddress < 0xa000) {
      this.#writeVramBanked(mappedAddress, byteValue);
      return;
    }

    if (mappedAddress >= 0xc000 && mappedAddress < 0xd000) {
      const offset = mappedAddress - 0xc000;
      this.#wramBank0[offset] = byteValue;
      return;
    }

    if (mappedAddress >= 0xd000 && mappedAddress < 0xe000) {
      const offset = mappedAddress - 0xd000;
      const bankIndex = this.#activeWramBank - 1;
      const target = this.#wramBanks[bankIndex];
      if (target) {
        target[offset] = byteValue;
      }
      return;
    }

    if (mappedAddress >= 0xe000 && mappedAddress < 0xfe00) {
      this.writeByte(mappedAddress - 0x2000, byteValue, ticksAhead);
      return;
    }

    if (this.#writeCgbRegister(mappedAddress, byteValue)) {
      return;
    }

    if (this.#mbc?.write(mappedAddress, byteValue)) {
      this.#mirrorAfterMbcWrite(mappedAddress);
      return;
    }

    if (this.#isUnmappedIoRegister(mappedAddress)) {
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

    const normalizedValue = this.#applyForcedOnes(mappedAddress, byteValue);
    this.#memory[mappedAddress] = normalizedValue;

    if (mappedAddress === INTERRUPT_FLAG_ADDRESS) {
      this.#syncPendingInterrupts(normalizedValue);
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
    const snapshot = this.#memory.slice();
    snapshot[DIVIDER_REGISTER_ADDRESS] = (this.#dividerCounter >> 8) & 0xff;
    snapshot.set(this.#vramBanks[this.#activeVramBank], 0x8000);
    snapshot.set(this.#wramBank0, 0xc000);
    const activeWram =
      this.#wramBanks[this.#activeWramBank - 1] ?? this.#wramBanks[0];
    snapshot.set(activeWram, 0xd000);
    snapshot.set(snapshot.subarray(0xc000, 0xe000), 0xe000);
    return snapshot;
  }

  dmaTransfer(source: number): void {
    const startAddress = (source & 0xff) << 8;
    this.performTransfer("oam", startAddress);
  }

  performTransfer(type: "oam" | "hdma", source: number): void {
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

    let remainingTicks = cycles * this.#ticksPerCpuCycle;
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
    const defaults = this.#cgbMode
      ? [...DMG_HARDWARE_REGISTER_DEFAULTS, ...CGB_ONLY_REGISTER_DEFAULTS]
      : DMG_HARDWARE_REGISTER_DEFAULTS;

    for (const [address, value] of defaults) {
      this.#memory[address] = value & 0xff;
    }
    this.#updateJoypadRegister(
      this.#memory[JOYPAD_REGISTER_ADDRESS] & 0x30,
      false,
    );
    this.#memory[TAC_REGISTER_ADDRESS] = this.#normalizeTac(
      this.#memory[TAC_REGISTER_ADDRESS] ?? 0,
    );
    if (!this.#cgbMode && this.#hardwareMode === "cgb") {
      this.#memory[KEY1_REGISTER_ADDRESS] = 0xff;
      this.#memory[VBK_REGISTER_ADDRESS] = 0xff;
      this.#memory[SVBK_REGISTER_ADDRESS] = 0xff;
    }
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

  #isCgbRegister(address: number): boolean {
    return address >= 0xff4c && address <= 0xff7f;
  }

  readVram(address: number, bank = this.#activeVramBank): number {
    return this.#readVramBanked(address, bank);
  }

  getBgPaletteColor(
    paletteIndex: number,
    colorIndex: number,
  ): [number, number, number, number] {
    const base = ((paletteIndex & 0x07) * 8 + (colorIndex & 0x03) * 2) & 0x3f;
    const low = this.#bgPaletteData[base] ?? 0;
    const high = this.#bgPaletteData[base + 1] ?? 0;
    return this.#decodeCgbColor(low, high);
  }

  getObjPaletteColor(
    paletteIndex: number,
    colorIndex: number,
  ): [number, number, number, number] {
    const base = ((paletteIndex & 0x07) * 8 + (colorIndex & 0x03) * 2) & 0x3f;
    const low = this.#objPaletteData[base] ?? 0;
    const high = this.#objPaletteData[base + 1] ?? 0;
    return this.#decodeCgbColor(low, high);
  }

  #decodeCgbColor(low: number, high: number): [number, number, number, number] {
    const value = ((high & 0x7f) << 8) | (low & 0xff);
    const r = value & 0x1f;
    const g = (value >> 5) & 0x1f;
    const b = (value >> 10) & 0x1f;
    const scale = (component: number) => Math.floor((component / 0x1f) * 255);
    return [scale(r), scale(g), scale(b), 0xff];
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

  #readVramBanked(address: number, bank = this.#activeVramBank): number {
    const normalized = (address - 0x8000) & 0x1fff;
    const activeBank = this.#cgbMode ? bank & 0x01 : 0;
    return this.#vramBanks[activeBank][normalized] ?? 0xff;
  }

  #writeVramBanked(
    address: number,
    value: number,
    bank = this.#activeVramBank,
  ): void {
    const normalized = (address - 0x8000) & 0x1fff;
    const activeBank = this.#cgbMode ? bank & 0x01 : 0;
    this.#vramBanks[activeBank][normalized] = value & 0xff;
  }

  #normalizeTac(value: number): number {
    return (value & 0x07) | TAC_UPPER_BITS;
  }

  #readCgbRegister(address: number): number | null {
    if (this.#hardwareMode !== "cgb") {
      return null;
    }

    if (!this.#cgbMode) {
      if (this.#isCgbRegister(address)) {
        return 0xff;
      }
      return null;
    }

    switch (address) {
      case KEY1_REGISTER_ADDRESS:
        return this.#composeKey1Value();
      case VBK_REGISTER_ADDRESS:
        return 0xfe | (this.#activeVramBank & 0x01);
      case SVBK_REGISTER_ADDRESS:
        return 0xf8 | (this.#activeWramBank & 0x07);
      case BCPS_REGISTER_ADDRESS:
        return (
          (this.#bgPaletteIndex & 0x3f) |
          (this.#bgPaletteAutoIncrement ? 0x80 : 0)
        );
      case BCPD_REGISTER_ADDRESS:
        return this.#bgPaletteData[this.#bgPaletteIndex & 0x3f] ?? 0xff;
      case OCPS_REGISTER_ADDRESS:
        return (
          (this.#objPaletteIndex & 0x3f) |
          (this.#objPaletteAutoIncrement ? 0x80 : 0)
        );
      case OCPD_REGISTER_ADDRESS:
        return this.#objPaletteData[this.#objPaletteIndex & 0x3f] ?? 0xff;
      case HDMA1_REGISTER_ADDRESS:
      case HDMA2_REGISTER_ADDRESS:
      case HDMA3_REGISTER_ADDRESS:
      case HDMA4_REGISTER_ADDRESS:
        return this.#memory[address] ?? 0xff;
      case HDMA5_REGISTER_ADDRESS:
        if (this.#hdmaActive && this.#hdmaBlocksRemaining > 0) {
          return 0x80 | ((this.#hdmaBlocksRemaining - 1) & 0x7f);
        }
        return 0xff;
      case RP_REGISTER_ADDRESS:
        return this.#memory[RP_REGISTER_ADDRESS] ?? 0x00;
      case OPRI_REGISTER_ADDRESS:
        return this.#memory[OPRI_REGISTER_ADDRESS] ?? 0x01;
      case PCM12_REGISTER_ADDRESS:
      case PCM34_REGISTER_ADDRESS:
        return 0x00;
      default:
        break;
    }

    return null;
  }

  #writeCgbRegister(address: number, value: number): boolean {
    if (this.#hardwareMode !== "cgb") {
      return false;
    }

    switch (address) {
      case KEY1_REGISTER_ADDRESS: {
        this.#speedSwitchRequested = (value & 0x01) !== 0;
        this.#memory[KEY1_REGISTER_ADDRESS] = this.#composeKey1Value();
        return true;
      }
      case VBK_REGISTER_ADDRESS: {
        this.#activeVramBank = value & 0x01;
        this.#memory[VBK_REGISTER_ADDRESS] = 0xfe | this.#activeVramBank;
        return true;
      }
      case SVBK_REGISTER_ADDRESS: {
        const nextBank = value & 0x07;
        this.#activeWramBank = nextBank === 0 ? 1 : nextBank;
        this.#memory[SVBK_REGISTER_ADDRESS] =
          0xf8 | (this.#activeWramBank & 0x07);
        return true;
      }
      case BCPS_REGISTER_ADDRESS: {
        this.#bgPaletteIndex = value & 0x3f;
        this.#bgPaletteAutoIncrement = (value & 0x80) !== 0;
        this.#memory[BCPS_REGISTER_ADDRESS] =
          (this.#bgPaletteIndex & 0x3f) |
          (this.#bgPaletteAutoIncrement ? 0x80 : 0x00);
        return true;
      }
      case BCPD_REGISTER_ADDRESS: {
        const index = this.#bgPaletteIndex & 0x3f;
        this.#bgPaletteData[index] = value & 0xff;
        this.#memory[BCPD_REGISTER_ADDRESS] = this.#bgPaletteData[index];
        if (this.#bgPaletteAutoIncrement) {
          this.#bgPaletteIndex = (index + 1) & 0x3f;
        }
        return true;
      }
      case OCPS_REGISTER_ADDRESS: {
        this.#objPaletteIndex = value & 0x3f;
        this.#objPaletteAutoIncrement = (value & 0x80) !== 0;
        this.#memory[OCPS_REGISTER_ADDRESS] =
          (this.#objPaletteIndex & 0x3f) |
          (this.#objPaletteAutoIncrement ? 0x80 : 0x00);
        return true;
      }
      case OCPD_REGISTER_ADDRESS: {
        const index = this.#objPaletteIndex & 0x3f;
        this.#objPaletteData[index] = value & 0xff;
        this.#memory[OCPD_REGISTER_ADDRESS] = this.#objPaletteData[index];
        if (this.#objPaletteAutoIncrement) {
          this.#objPaletteIndex = (index + 1) & 0x3f;
        }
        return true;
      }
      case HDMA1_REGISTER_ADDRESS:
      case HDMA2_REGISTER_ADDRESS:
      case HDMA3_REGISTER_ADDRESS:
      case HDMA4_REGISTER_ADDRESS:
        this.#memory[address] = value & 0xff;
        return true;
      case HDMA5_REGISTER_ADDRESS: {
        const request = value & 0xff;
        if (
          this.#hdmaActive &&
          this.#hdmaHblankMode &&
          (request & 0x80) === 0
        ) {
          // Cancel active HBlank transfer.
          this.#hdmaActive = false;
          this.#hdmaBlocksRemaining = 0;
          this.#memory[HDMA5_REGISTER_ADDRESS] = 0xff;
          return true;
        }
        this.#startHdmaTransfer(request);
        return true;
      }
      case RP_REGISTER_ADDRESS:
        this.#memory[RP_REGISTER_ADDRESS] = value & 0xff;
        return true;
      case OPRI_REGISTER_ADDRESS:
        this.#memory[OPRI_REGISTER_ADDRESS] = value & 0xff;
        return true;
      case PCM12_REGISTER_ADDRESS:
      case PCM34_REGISTER_ADDRESS:
        // Read-only on hardware; ignore writes.
        return true;
      default:
        break;
    }

    return false;
  }

  handleStop(): boolean {
    if (!this.#cgbMode || !this.#speedSwitchRequested) {
      return false;
    }
    this.#doubleSpeed = !this.#doubleSpeed;
    this.#ticksPerCpuCycle = this.#doubleSpeed ? 2 : 4;
    this.#speedSwitchRequested = false;
    this.#memory[KEY1_REGISTER_ADDRESS] = this.#composeKey1Value();
    return true;
  }

  #composeKey1Value(): number {
    const speedBit = this.#doubleSpeed ? 0x80 : 0x00;
    const requestBit = this.#speedSwitchRequested ? 0x01 : 0x00;
    return 0x7e | speedBit | requestBit;
  }

  #startHdmaTransfer(value: number): void {
    const lengthBlocks = (value & 0x7f) + 1;
    this.#hdmaHblankMode = (value & 0x80) !== 0;
    this.#hdmaBlocksRemaining = lengthBlocks;
    this.#hdmaActive = true;

    this.#hdmaSource =
      (((this.#memory[HDMA1_REGISTER_ADDRESS] ?? 0) << 8) |
        (this.#memory[HDMA2_REGISTER_ADDRESS] ?? 0)) &
      0xfff0;
    this.#hdmaDestination =
      0x8000 |
      ((((this.#memory[HDMA3_REGISTER_ADDRESS] ?? 0) & 0x1f) << 8) |
        ((this.#memory[HDMA4_REGISTER_ADDRESS] ?? 0) & 0xf0));

    if (!this.#hdmaHblankMode) {
      this.#runHdmaBlocks(lengthBlocks);
      this.#hdmaActive = false;
      this.#hdmaBlocksRemaining = 0;
      this.#memory[HDMA5_REGISTER_ADDRESS] = 0xff;
      return;
    }

    this.#memory[HDMA5_REGISTER_ADDRESS] =
      0x80 | ((this.#hdmaBlocksRemaining - 1) & 0x7f);
  }

  handleHblankHdma(): void {
    if (!this.#hdmaActive || !this.#hdmaHblankMode) {
      return;
    }
    if (this.#hdmaBlocksRemaining <= 0) {
      this.#hdmaActive = false;
      this.#memory[HDMA5_REGISTER_ADDRESS] = 0xff;
      return;
    }

    this.#runHdmaBlocks(1);
    this.#hdmaBlocksRemaining -= 1;

    if (this.#hdmaBlocksRemaining === 0) {
      this.#hdmaActive = false;
      this.#memory[HDMA5_REGISTER_ADDRESS] = 0xff;
    } else {
      this.#memory[HDMA5_REGISTER_ADDRESS] =
        0x80 | ((this.#hdmaBlocksRemaining - 1) & 0x7f);
    }
  }

  #runHdmaBlocks(blocks: number): void {
    const totalBytes = blocks * 0x10;
    for (let offset = 0; offset < totalBytes; offset += 1) {
      const readAddress = (this.#hdmaSource + offset) & 0xffff;
      const writeAddress = (this.#hdmaDestination + offset) & 0xffff;
      const byte = this.readByte(readAddress);
      this.#writeVramBanked(writeAddress, byte);
    }
    this.#hdmaSource = (this.#hdmaSource + totalBytes) & 0xffff;
    const destLow = (this.#hdmaDestination - 0x8000 + totalBytes) & 0x1ff0;
    this.#hdmaDestination = 0x8000 | destLow;
  }

  #loadCompatibilityPalettes(): void {
    this.#writeCompatPaletteSet(this.#bgPaletteData, 0, COMPAT_BG_DEFAULT);
    this.#writeCompatPaletteSet(this.#objPaletteData, 0, COMPAT_OBJ0_DEFAULT);
    this.#writeCompatPaletteSet(this.#objPaletteData, 1, COMPAT_OBJ1_DEFAULT);
  }

  #writeCompatPaletteSet(
    target: Uint8Array,
    paletteIndex: number,
    colors: readonly number[],
  ): void {
    const base = (paletteIndex & 0x07) * 8;
    for (let i = 0; i < 4; i += 1) {
      const color = colors[i] ?? 0;
      target[base + i * 2] = color & 0xff;
      target[base + i * 2 + 1] = (color >> 8) & 0xff;
    }
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

  #applyForcedOnes(address: number, value: number): number {
    const forced = FORCED_ONE_BITMASKS[address];
    if (forced === undefined) {
      return value & 0xff;
    }
    return (value | forced) & 0xff;
  }

  #isUnmappedIoRegister(address: number): boolean {
    if (address === 0xff03) {
      return true;
    }
    if (address >= 0xff08 && address <= 0xff0e) {
      return true;
    }
    if (address === 0xff15 || address === 0xff1f) {
      return true;
    }
    if (address >= 0xff27 && address <= 0xff2f) {
      return true;
    }
    if (address >= 0xff4c && address <= 0xff7f) {
      return this.#hardwareMode !== "cgb";
    }
    if (
      address >= 0xff76 &&
      address <= 0xff77 &&
      this.#hardwareMode !== "cgb"
    ) {
      return true;
    }
    return false;
  }
}
