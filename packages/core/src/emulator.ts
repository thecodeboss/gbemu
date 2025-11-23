import { Ppu } from "./ppu.js";
import { Apu } from "./apu.js";
import { SystemBus } from "./bus.js";
import { Mbc, MbcFactory } from "./mbc.js";
import { Clock } from "./clock.js";
import { EmulatorRomInfo } from "./rom/index.js";
import {
  disassembleRom as disassembleBuffer,
  formatDisassembledRom,
  parseRomInfo,
} from "./rom/index.js";
import { Cpu, CpuFlags, CpuRegisters } from "./cpu.js";
import { JoypadInputState, createEmptyJoypadState } from "./input.js";

export type { EmulatorRomInfo } from "./rom/index.js";

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
  onBreakpointHit?(offset: number): void;
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
  audioSampleRate?: number;
}

export interface EmulatorStateSnapshot {
  cpu: unknown;
  ppu: unknown;
  apu: unknown;
  bus: unknown;
  clock: unknown;
  mbc: unknown;
}

export interface EmulatorCpuDebugState {
  registers: CpuRegisters;
  flags: CpuFlags;
  ime: boolean;
  halted: boolean;
  stopped: boolean;
  cycles: number;
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
const DEFAULT_OUTPUT_SAMPLE_RATE = 44_100;
const MASTER_CLOCK_HZ = 4_194_304;
const CPU_CYCLES_PER_FRAME = Clock.FRAME_CYCLES / 4;
const FRAME_DURATION_MS = (Clock.FRAME_CYCLES / MASTER_CLOCK_HZ) * 1000;

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
  #nextFrameTimestamp: number | null = null;
  #frameCount = 0;
  #mbcFactory: MbcFactory;
  #mbc: Mbc;
  #running = false;
  #breakpoints = new Set<number>();
  #lastBreakpointHit: number | null = null;
  #inputState: JoypadInputState = createEmptyJoypadState();
  #audioSampleRate = DEFAULT_OUTPUT_SAMPLE_RATE;
  #audioRemainder = 0;
  #lastAudioTimestamp: number | null = null;

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
    this.#audioSampleRate =
      options.audioSampleRate ?? DEFAULT_OUTPUT_SAMPLE_RATE;
    this.#audioRemainder = 0;
    this.#lastAudioTimestamp = null;
    this.apu.setOutputSampleRate(this.#audioSampleRate);
  }

  loadRom(rom: Uint8Array): void {
    this.#romData = rom.slice();
    this.#romInfo = parseRomInfo(rom);
    const ramSize = this.#romInfo?.ramSize ?? 0;
    const cartridgeType = this.#mbcFactory.detect(rom);
    this.#mbc = this.#mbcFactory.create(cartridgeType, rom, ramSize);
    this.bus.loadCartridge(rom, this.#mbc);
    this.bus.setJoypadState(this.#inputState);
    this.cpu.reset();
    this.ppu.reset();
    this.apu.reset();
    this.apu.setOutputSampleRate(this.#audioSampleRate);
    this.#audioRemainder = 0;
    this.#lastAudioTimestamp = this.#now();
    this.#nextFrameTimestamp = null;
    this.clock.setSpeed(1);
    this.cpu.state.registers.pc = 0x0100;
    this.#lastBreakpointHit = null;
    this.#frameCount = 0;
    this.#inputState = createEmptyJoypadState();
    this.#callbacks?.onLog?.(
      `Loaded ROM ${this.#romInfo?.title ?? "(untitled)"}`,
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
    this.apu.setOutputSampleRate(this.#audioSampleRate);
    this.#audioRemainder = 0;
    this.#lastAudioTimestamp = this.#now();
    this.#nextFrameTimestamp = null;
    this.clock.step();
    this.#frameCount = 0;
    this.#lastBreakpointHit = null;
    this.#inputState = createEmptyJoypadState();
    this.bus.setJoypadState(this.#inputState);
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
    this.#audioRemainder = 0;
    this.#lastAudioTimestamp = this.#now();
    const now = this.#now();
    this.#nextFrameTimestamp = now;
    this.#scheduleNextFrame();
    this.#callbacks?.onLog?.("Emulator started.");
  }

  pause(): void {
    if (!this.#running) {
      return;
    }
    this.#running = false;
    if (this.#frameTimer !== null) {
      clearTimeout(this.#frameTimer);
      this.#frameTimer = null;
    }
    this.#nextFrameTimestamp = null;
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
    this.#tickSubsystems(cycles);
    this.#emitVideoFrame();
    this.#refreshBreakpointLatch();
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
    const memory = this.bus.dumpMemory();
    const instructions = disassembleBuffer(memory);
    return formatDisassembledRom(instructions);
  }

  getProgramCounter(): number | null {
    return this.cpu.state?.registers?.pc ?? null;
  }

  getCpuState(): EmulatorCpuDebugState {
    return {
      registers: { ...this.cpu.state.registers },
      flags: { ...this.cpu.state.flags },
      ime: this.cpu.state.ime,
      halted: this.cpu.state.halted,
      stopped: this.cpu.state.stopped,
      cycles: this.cpu.state.cycles,
    };
  }

  getMemorySnapshot(): Uint8Array {
    return this.bus.dumpMemory();
  }

  setBreakpoints(offsets: Iterable<number>): void {
    this.#breakpoints.clear();
    for (const value of offsets) {
      if (Number.isFinite(value)) {
        this.#breakpoints.add((Number(value) >>> 0) & 0xffff);
      }
    }
    this.#lastBreakpointHit = null;
  }

  setInputState(state: JoypadInputState): void {
    this.#inputState = { ...state };
    this.bus.setJoypadState(this.#inputState);
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
    const targetFrame = this.#frameCount + 1;
    const maxCycles = CPU_CYCLES_PER_FRAME * 2;
    let accumulatedCycles = 0;

    while (this.#frameCount < targetFrame) {
      if (this.#shouldPauseForBreakpoint()) {
        return;
      }
      const stepCycles = this.cpu.step();
      this.#tickSubsystems(stepCycles);
      accumulatedCycles += stepCycles;
      this.#emitVideoFrame();

      if (accumulatedCycles >= maxCycles) {
        const lcdEnabled = this.ppu.getStatus().lcdEnabled;
        if (lcdEnabled) {
          this.#callbacks?.onLog?.(
            "Frame watchdog triggered before VBlank; breaking out early.",
          );
        }
        break;
      }
    }

    this.#emitAudioChunk();
  }

  #scheduleNextFrame(): void {
    if (!this.#running) {
      return;
    }

    const now = this.#now();
    const frameDuration = FRAME_DURATION_MS;

    if (this.#nextFrameTimestamp === null) {
      this.#nextFrameTimestamp = now;
    }

    while (
      this.#nextFrameTimestamp !== null &&
      now >= this.#nextFrameTimestamp
    ) {
      this.#runFrame();
      this.#nextFrameTimestamp += frameDuration;
      if (!this.#running) {
        return;
      }
    }

    const targetDelay = (this.#nextFrameTimestamp ?? now) - this.#now();
    const delay = Math.max(0, Math.min(frameDuration, targetDelay));
    this.#frameTimer = setTimeout(
      () => this.#scheduleNextFrame(),
      delay,
    ) as unknown as number;
  }

  #shouldPauseForBreakpoint(): boolean {
    if (!this.#running || this.#breakpoints.size === 0) {
      return false;
    }

    this.#refreshBreakpointLatch();
    const pc = this.cpu.state.registers.pc;
    if (!this.#breakpoints.has(pc) || this.#lastBreakpointHit === pc) {
      return false;
    }

    this.#lastBreakpointHit = pc;
    this.pause();
    this.#callbacks?.onBreakpointHit?.(pc);
    return true;
  }

  #refreshBreakpointLatch(): void {
    if (
      this.#lastBreakpointHit !== null &&
      this.cpu.state.registers.pc !== this.#lastBreakpointHit
    ) {
      this.#lastBreakpointHit = null;
    }
  }

  #tickSubsystems(cycles: number): void {
    this.bus.tick(cycles);
    this.ppu.tick(cycles);
    this.apu.tick(cycles);
    for (let i = 0; i < cycles; i += 1) {
      this.clock.step();
    }
  }

  #emitVideoFrame(): void {
    if (!this.#callbacks) {
      return;
    }
    const frame = this.ppu.consumeFrame();
    if (!frame) {
      return;
    }
    this.#frameCount += 1;
    this.#callbacks.onVideoFrame({
      width: frame.width,
      height: frame.height,
      buffer: frame.data,
    });
  }

  #emitAudioChunk(): void {
    if (!this.#callbacks) {
      return;
    }
    const now = this.#now();
    if (this.#lastAudioTimestamp === null) {
      this.#lastAudioTimestamp = now;
    }

    const elapsedMs = Math.max(0, now - this.#lastAudioTimestamp);
    this.#lastAudioTimestamp = now;

    const expectedSamples =
      (elapsedMs * this.#audioSampleRate) / 1000 + this.#audioRemainder;
    let sampleCount = Math.floor(expectedSamples);
    this.#audioRemainder = expectedSamples - sampleCount;

    if (sampleCount <= 0) {
      sampleCount = Math.max(1, Math.floor(this.#audioBufferSize / 4));
    }

    const maxSamples = this.#audioBufferSize * 2;
    if (sampleCount > maxSamples) {
      sampleCount = maxSamples;
    }

    const samples = this.apu.flushSamples(this.#audioSampleRate, sampleCount);

    if (samples.length === 0) {
      return;
    }

    const chunk: AudioBufferChunk = {
      samples,
      sampleRate: this.#audioSampleRate,
    };
    this.#callbacks.onAudioSamples(chunk);
  }

  #now(): number {
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      return performance.now();
    }
    return Date.now();
  }
}

export interface EmulatorInitOptions {
  callbacks: EmulatorCallbacks;
  audioBufferSize?: number;
  audioSampleRate?: number;
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
    audioSampleRate: options.audioSampleRate,
  });
  return emulator;
}

export const createStubEmulator = createEmulator;
