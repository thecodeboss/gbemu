import type { AudioSample, Apu } from "./apu.js";
import type { AddressRange, DmaTransferType, MemoryBank, SystemBus } from "./bus.js";
import type { Clock } from "./clock.js";
import type { Cpu, CpuBusPort, CpuState, InterruptType } from "./cpu.js";
import type {
  AudioBufferChunk,
  Emulator,
  EmulatorCallbacks,
  EmulatorOptions,
  EmulatorStateSnapshot,
  SavePayload,
} from "./emulator.js";
import type { Mbc, MbcFactory, MbcType } from "./mbc.js";
import type { Framebuffer, Ppu, PpuLcdStatus } from "./ppu.js";
import type { EmulatorRomInfo } from "./rom.js";
import { parseRomInfo } from "./rom.js";

const SCREEN_WIDTH = 160;
const SCREEN_HEIGHT = 144;
const DEFAULT_AUDIO_BUFFER_FRAMES = 1024;
const AUDIO_SAMPLE_RATE = 44_100;

class StubClock implements Clock {
  masterCycles = 0;
  #listeners = new Set<(deltaCycles: number) => void>();
  #speed = 1;

  step(): void {
    this.#emitTick(1);
  }

  runFrame(): void {
    // 70224 master cycles per Game Boy frame (59.73Hz).
    const frameCycles = 70_224;
    this.#emitTick(frameCycles);
  }

  setSpeed(multiplier: number): void {
    this.#speed = multiplier;
  }

  onTick(listener: (deltaCycles: number) => void): void {
    this.#listeners.add(listener);
  }

  clearTick(listener: (deltaCycles: number) => void): void {
    this.#listeners.delete(listener);
  }

  #emitTick(deltaCycles: number): void {
    const adjusted = deltaCycles * this.#speed;
    this.masterCycles += adjusted;
    for (const listener of this.#listeners) {
      listener(adjusted);
    }
  }
}

function createDefaultCpuState(): CpuState {
  return {
    registers: {
      a: 0,
      f: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0,
      h: 0,
      l: 0,
      sp: 0xfffe,
      pc: 0x0100,
    },
    flags: {
      zero: false,
      subtract: false,
      halfCarry: false,
      carry: false,
    },
    ime: false,
    halted: false,
    stopped: false,
    cycles: 0,
  };
}

class StubCpu implements Cpu {
  state: CpuState = createDefaultCpuState();
  #doubleSpeed = false;
  #bus: CpuBusPort | null = null;

  reset(): void {
    this.state = createDefaultCpuState();
    this.#doubleSpeed = false;
  }

  step(): number {
    const cycles = this.#doubleSpeed ? 8 : 4;
    this.state.cycles += cycles;
    return cycles;
  }

  requestInterrupt(_type: InterruptType): void {
    // Intentionally left blank for stub implementation.
  }

  clearInterrupt(_type: InterruptType): void {
    // Intentionally left blank for stub implementation.
  }

  setDoubleSpeedMode(enabled: boolean): void {
    this.#doubleSpeed = enabled;
  }

  connectBus(bus: CpuBusPort): void {
    this.#bus = bus;
  }
}

class StubPpu implements Ppu {
  #framebuffer: Framebuffer = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    data: new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4),
  };

  connectBus(_bus: SystemBus): void {
    // No-op for stub.
  }

  reset(): void {
    this.#framebuffer.data.fill(0);
  }

  tick(_cycles: number): void {
    // No timing logic in stub.
  }

  getFramebuffer(): Framebuffer {
    return this.#framebuffer;
  }

  getStatus(): PpuLcdStatus {
    return {
      mode: "vblank",
      ly: 0,
      lyc: 0,
      lcdEnabled: true,
    };
  }
}

class StubApu implements Apu {
  connectBus(_bus: SystemBus): void {
    // No-op for stub.
  }

  reset(): void {
    // Nothing to reset.
  }

  tick(_cycles: number): void {
    // No timing logic in stub.
  }

  flushSamples(): AudioSample[] {
    return [];
  }
}

class StubMemoryBank implements MemoryBank {
  readonly #storage: Uint8Array;

  constructor(
    public readonly range: AddressRange,
    size: number
  ) {
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

class StubSystemBus implements SystemBus {
  #memory = new Uint8Array(0x10000);
  #pendingInterrupts = new Set<InterruptType>();

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

  dmaTransfer(_type: "oam" | "hdma", _source: number): void {
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

class StubMbc implements Mbc {
  readonly type: MbcType;
  readonly romBanks: MemoryBank[];
  readonly ramBanks: MemoryBank[];

  constructor(type: MbcType, romSize: number, ramSize: number) {
    this.type = type;
    this.romBanks = [
      new StubMemoryBank(
        { start: 0x0000, end: Math.max(0, romSize - 1) },
        romSize || 0x4000
      ),
    ];
    this.ramBanks = ramSize
      ? [
          new StubMemoryBank(
            { start: 0xa000, end: 0xa000 + Math.max(0, ramSize - 1) },
            ramSize
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

class StubMbcFactory implements MbcFactory {
  detect(_rom: Uint8Array): MbcType {
    return "romOnly";
  }

  create(type: MbcType, rom: Uint8Array, ramSize: number): Mbc {
    const romSizeBytes = rom.byteLength || 0x4000;
    return new StubMbc(type, romSizeBytes, ramSize);
  }
}

interface StubEmulatorDeps {
  clock: Clock;
  cpu: Cpu;
  ppu: Ppu;
  apu: Apu;
  bus: SystemBus;
  mbcFactory: MbcFactory;
}

class StubEmulator implements Emulator {
  readonly cpu: Cpu;
  readonly ppu: Ppu;
  readonly apu: Apu;
  readonly bus: SystemBus;
  readonly clock: Clock;

  #callbacks: EmulatorCallbacks | null = null;
  #audioBufferSize = DEFAULT_AUDIO_BUFFER_FRAMES;
  #romInfo: EmulatorRomInfo | null = null;
  #romData: Uint8Array | null = null;
  #saveData: SavePayload | null = null;
  #frameTimer: number | null = null;
  #frameCount = 0;
  #mbcFactory: MbcFactory;
  #mbc: Mbc;
  #running = false;

  constructor(deps: StubEmulatorDeps) {
    this.clock = deps.clock;
    this.cpu = deps.cpu;
    this.ppu = deps.ppu;
    this.apu = deps.apu;
    this.bus = deps.bus;
    this.#mbcFactory = deps.mbcFactory;
    this.#mbc = this.#mbcFactory.create("romOnly", new Uint8Array(0), 0);
  }

  initialize(options: EmulatorOptions): void {
    this.#callbacks = options.callbacks;
    this.#audioBufferSize =
      options.audioBufferSize ?? DEFAULT_AUDIO_BUFFER_FRAMES;
  }

  loadRom(rom: Uint8Array): void {
    this.#romData = rom.slice();
    this.#romInfo = parseRomInfo(rom);
    const ramSize = this.#romInfo?.ramSize ?? 0;
    const cartridgeType = this.#mbcFactory.detect(rom);
    this.#mbc = this.#mbcFactory.create(cartridgeType, rom, ramSize);
    this.cpu.reset();
    this.ppu.reset();
    this.apu.reset();
    this.clock.setSpeed(1);
    this.#frameCount = 0;
    this.#callbacks?.onLog?.(
      `Loaded ROM ${this.#romInfo?.title ?? "(untitled)"}`
    );
    this.#emitVideoFrame();
    this.#emitAudioChunk();
  }

  loadSave(payload: SavePayload): void {
    this.#saveData = {
      battery: payload.battery.slice(),
      rtc: payload.rtc ? payload.rtc.slice() : undefined,
    };
    this.#callbacks?.onLog?.("Loaded save data.");
  }

  getSave(): SavePayload | null {
    if (!this.#saveData) {
      return null;
    }
    return {
      battery: this.#saveData.battery.slice(),
      rtc: this.#saveData.rtc ? this.#saveData.rtc.slice() : undefined,
    };
  }

  reset(hard?: boolean): void {
    this.pause();
    this.cpu.reset();
    this.ppu.reset();
    this.apu.reset();
    this.clock.step();
    this.#frameCount = 0;
    if (hard) {
      this.#romData = null;
      this.#romInfo = null;
      this.#saveData = null;
    }
    this.#emitVideoFrame();
  }

  start(): void {
    if (this.#running) {
      return;
    }
    this.#running = true;
    const frameMs = 1000 / 60;
    this.#frameTimer = setInterval(() => {
      this.#runFrame();
    }, frameMs) as unknown as number;
    this.#callbacks?.onLog?.("Emulator started.");
  }

  pause(): void {
    if (!this.#running) {
      return;
    }
    this.#running = false;
    if (this.#frameTimer !== null) {
      clearInterval(this.#frameTimer);
      this.#frameTimer = null;
    }
    this.#callbacks?.onLog?.("Emulator paused.");
  }

  stepFrame(): void {
    this.#runFrame();
  }

  isRunning(): boolean {
    return this.#running;
  }

  getRomInfo(): EmulatorRomInfo | null {
    return this.#romInfo ? { ...this.#romInfo } : null;
  }

  getStateSnapshot(): EmulatorStateSnapshot {
    return {
      cpu: { cycles: this.cpu.state.cycles },
      ppu: { frame: this.#frameCount },
      apu: {},
      bus: {},
      clock: { masterCycles: this.clock.masterCycles },
      mbc: { type: this.#mbc.type },
    };
  }

  restoreState(_snapshot: EmulatorStateSnapshot): void {
    // Nothing to restore in stub.
  }

  dispose(): void {
    this.pause();
    this.#callbacks = null;
    this.#romData = null;
  }

  #runFrame(): void {
    this.clock.runFrame();
    const stepCycles = this.cpu.step();
    this.bus.tick(stepCycles);
    this.#emitVideoFrame();
    this.#emitAudioChunk();
  }

  #emitVideoFrame(): void {
    if (!this.#callbacks) {
      return;
    }
    const width = SCREEN_WIDTH;
    const height = SCREEN_HEIGHT;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const framePhase = this.#frameCount % 256;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const r = (x + framePhase) & 0xff;
        const g = (y + framePhase) & 0xff;
        const b = (x ^ y ^ framePhase) & 0xff;
        pixels[index] = r;
        pixels[index + 1] = g;
        pixels[index + 2] = b;
        pixels[index + 3] = 0xff;
      }
    }
    this.#frameCount += 1;
    this.#callbacks.onVideoFrame({
      width,
      height,
      buffer: pixels,
    });
  }

  #emitAudioChunk(): void {
    if (!this.#callbacks) {
      return;
    }
    const samples = new Float32Array(this.#audioBufferSize * 2);
    // Leave the buffer silent for stub purposes.
    const chunk: AudioBufferChunk = {
      samples,
      sampleRate: AUDIO_SAMPLE_RATE,
    };
    this.#callbacks.onAudioSamples(chunk);
  }
}

export interface StubEmulatorInitOptions {
  callbacks: EmulatorCallbacks;
  audioBufferSize?: number;
}

export function createStubEmulator(
  options: StubEmulatorInitOptions
): Emulator {
  const clock = new StubClock();
  const cpu = new StubCpu();
  const ppu = new StubPpu();
  const apu = new StubApu();
  const bus = new StubSystemBus();
  const mbcFactory = new StubMbcFactory();
  const emulator = new StubEmulator({
    clock,
    cpu,
    ppu,
    apu,
    bus,
    mbcFactory,
  });

  emulator.initialize({
    callbacks: options.callbacks,
    clock,
    cpu,
    ppu,
    apu,
    bus,
    mbcFactory,
    audioBufferSize: options.audioBufferSize,
  });
  return emulator;
}
