import { Ppu, DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT } from "./ppu.js";
import { Apu } from "./apu.js";
import { SystemBus } from "./bus.js";
import { Mbc, MbcFactory } from "./mbc.js";
import { Clock } from "./clock.js";
import type { EmulatorRomInfo } from "./rom.js";
import { disassembleRom as renderDisassembly, parseRomInfo } from "./rom.js";
import { Cpu } from "./cpu.js";

export type { EmulatorRomInfo } from "./rom.js";

export interface VideoFrame {
  buffer: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface AudioBufferChunk {
  samples: Float32Array;
  sampleRate: number;
}

export interface SavePayload {
  battery: Uint8Array;
  rtc?: Uint8Array;
}

export interface EmulatorCallbacks {
  onVideoFrame(frame: VideoFrame): void;
  onAudioSamples(chunk: AudioBufferChunk): void;
  onSaveData(payload: SavePayload): void;
  onLog?(message: string): void;
  onError?(error: unknown): void;
}

export interface EmulatorOptions {
  callbacks: EmulatorCallbacks;
  clock: Clock;
  cpu: Cpu;
  ppu: Ppu;
  apu: Apu;
  bus: SystemBus;
  mbcFactory: MbcFactory;
  bootRom?: Uint8Array;
  audioBufferSize?: number;
}

export interface EmulatorStateSnapshot {
  cpu: unknown;
  ppu: unknown;
  apu: unknown;
  bus: unknown;
  clock: unknown;
  mbc: unknown;
}

interface EmulatorDependencies {
  clock: Clock;
  cpu: Cpu;
  ppu: Ppu;
  apu: Apu;
  bus: SystemBus;
  mbcFactory: MbcFactory;
}

const DEFAULT_AUDIO_BUFFER_FRAMES = 1024;
const AUDIO_SAMPLE_RATE = 44_100;

export class Emulator {
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

  constructor(deps: EmulatorDependencies) {
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

  stepInstruction(): void {
    if (this.#running) {
      this.pause();
    }
    const cycles = this.cpu.step();
    this.bus.tick(cycles);
    for (let i = 0; i < cycles; i += 1) {
      this.clock.step();
    }
    this.#emitVideoFrame();
  }

  isRunning(): boolean {
    return this.#running;
  }

  getRomInfo(): EmulatorRomInfo | null {
    return this.#romInfo ? { ...this.#romInfo } : null;
  }

  disassembleRom(): Record<number, string> | null {
    if (!this.#romData) {
      return null;
    }
    return renderDisassembly(this.#romData);
  }

  getProgramCounter(): number | null {
    return this.cpu.state?.registers?.pc ?? null;
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
    const width = DEFAULT_SCREEN_WIDTH;
    const height = DEFAULT_SCREEN_HEIGHT;
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
    const chunk: AudioBufferChunk = {
      samples,
      sampleRate: AUDIO_SAMPLE_RATE,
    };
    this.#callbacks.onAudioSamples(chunk);
  }
}

export interface EmulatorInitOptions {
  callbacks: EmulatorCallbacks;
  audioBufferSize?: number;
}

export function createEmulator(options: EmulatorInitOptions): Emulator {
  const clock = new Clock();
  const cpu = new Cpu();
  const ppu = new Ppu();
  const apu = new Apu();
  const bus = new SystemBus();
  const mbcFactory = new MbcFactory();
  const emulator = new Emulator({
    clock,
    cpu,
    ppu,
    apu,
    bus,
    mbcFactory,
  });

  cpu.connectBus(bus);
  ppu.connectBus(bus);
  apu.connectBus(bus);

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

export const createStubEmulator = createEmulator;
