import { Ppu } from "./ppu.js";
import { Apu } from "./apu.js";
import { SystemBus } from "./bus.js";
import { Mbc, MbcFactory } from "./mbc.js";
import { Clock } from "./clock.js";
import { EmulatorRomInfo } from "./rom/index.js";
import { parseRomInfo } from "./rom/index.js";
import { Cpu, CpuRegisters } from "./cpu/cpu.js";
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
}

export interface EmulatorOptions {
  callbacks: EmulatorCallbacks;
  clock: Clock;
  cpu: Cpu;
  ppu: Ppu;
  apu: Apu;
  bus: SystemBus;
  mbcFactory: MbcFactory;
  audioBufferSize?: number;
  audioSampleRate?: number;
  mode?: EmulatorMode;
  speedMultiplier?: number;
}

export interface EmulatorStateSnapshot {
  cpu: unknown;
  ppu: unknown;
  apu: unknown;
  bus: unknown;
  clock: unknown;
  mbc: unknown;
}

export type EmulatorMode = "dmg" | "cgb";

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
const FRAME_DURATION_MS = (Clock.FRAME_CYCLES / MASTER_CLOCK_HZ) * 1000;
const SAVE_GRACE_CYCLES = Clock.FRAME_CYCLES * 4; // ~4 frames of inactivity before considering a flush
const MIN_SAVE_DIRTY_WRITES = 1024; // treat only larger bursts as intentional saves
const SAVE_LONG_IDLE_CYCLES = Clock.FRAME_CYCLES * 240; // ~4 seconds idle flush for small changes
const MIN_SPEED_MULTIPLIER = 0.1;

function computeCgbNativeRegisters(): CpuRegisters {
  return {
    a: 0x11,
    f: 0x80,
    b: 0x00,
    c: 0x00,
    d: 0xff,
    e: 0x56,
    h: 0x00,
    l: 0x0d,
    sp: 0xfffe,
    pc: 0x0100,
  };
}

function computeCgbCompatibilityRegisters(rom: Uint8Array): CpuRegisters {
  const oldLicense = rom[0x14b] ?? 0;
  const newLicense0 = rom[0x144] ?? 0;
  const newLicense1 = rom[0x145] ?? 0;
  const isNintendoLicense =
    oldLicense === 0x01 ||
    (oldLicense === 0x33 && newLicense0 === 0x30 && newLicense1 === 0x31);

  let b = 0x00;
  if (isNintendoLicense) {
    let sum = 0;
    for (let i = 0x134; i <= 0x143; i += 1) {
      sum = (sum + (rom[i] ?? 0)) & 0xff;
    }
    b = sum & 0xff;
  }

  const hl = b === 0x43 || b === 0x58 ? 0x991a : 0x007c;

  return {
    a: 0x11,
    f: 0x80,
    b,
    c: 0x00,
    d: 0x00,
    e: 0x08,
    h: (hl >> 8) & 0xff,
    l: hl & 0xff,
    sp: 0xfffe,
    pc: 0x0100,
  };
}

export class Emulator {
  readonly cpu: Cpu;
  readonly ppu: Ppu;
  readonly apu: Apu;
  readonly bus: SystemBus;
  readonly clock: Clock;

  #callbacks: EmulatorCallbacks | null = null;
  #audioBufferSize = DEFAULT_AUDIO_BUFFER_FRAMES;
  #mode: EmulatorMode = "dmg";
  #romInfo: EmulatorRomInfo | null = null;
  #saveData: SavePayload | null = null;
  #frameTimer: number | null = null;
  #nextFrameTimestamp: number | null = null;
  #frameCount = 0;
  #mbcFactory: MbcFactory;
  #mbc: Mbc;
  #running = false;
  #inputState: JoypadInputState = createEmptyJoypadState();
  #audioSampleRate = DEFAULT_OUTPUT_SAMPLE_RATE;
  #audioRemainder = 0;
  #lastAudioTimestamp: number | null = null;
  #ramDirty = false;
  #lastRamWriteCycles: number | null = null;
  #ramDirtyWrites = 0;
  #persistSaves = false;
  #speedMultiplier = 1;

  constructor(deps: EmulatorDependencies) {
    this.clock = deps.clock;
    this.cpu = deps.cpu;
    this.ppu = deps.ppu;
    this.apu = deps.apu;
    this.bus = deps.bus;
    this.#mbcFactory = deps.mbcFactory;
    this.#mbc = this.#mbcFactory.create("romOnly", new Uint8Array(0), 0, {
      onRamWrite: () => this.#scheduleSaveFlush(),
    });
  }

  initialize(options: EmulatorOptions): void {
    this.#callbacks = options.callbacks;
    this.#audioBufferSize =
      options.audioBufferSize ?? DEFAULT_AUDIO_BUFFER_FRAMES;
    this.#audioSampleRate =
      options.audioSampleRate ?? DEFAULT_OUTPUT_SAMPLE_RATE;
    this.#mode = options.mode ?? "dmg";
    this.#speedMultiplier = this.#normalizeSpeedMultiplier(
      options.speedMultiplier,
    );
    this.#audioRemainder = 0;
    this.#lastAudioTimestamp = null;
    this.apu.setOutputSampleRate(this.#audioSampleRate);
  }

  loadRom(rom: Uint8Array): void {
    this.#flushPendingSave();
    this.#resetSaveTracking();
    this.#saveData = null;
    this.#romInfo = parseRomInfo(rom);
    const cartridgeConfig = this.#mbcFactory.describeCartridge(rom, {
      cartridgeType: this.#romInfo?.cartridgeType,
      ramSize: this.#romInfo?.ramSize,
    });
    const cgbFlag = this.#romInfo?.cgbFlag ?? 0;
    const supportsCgb = (cgbFlag & 0x80) !== 0;
    const cgbOnly = (cgbFlag & 0xc0) === 0xc0;
    const cgbMode = this.#mode === "cgb" && supportsCgb;
    if (this.#mode === "cgb" && !supportsCgb) {
      this.#callbacks?.onLog?.("ROM not marked CGB; running in DMG mode.");
    }
    if (this.#mode === "dmg" && cgbOnly) {
      this.#callbacks?.onLog?.(
        "CGB-only ROM loaded on DMG mode; behavior may be incorrect.",
      );
    }

    this.#mbc = this.#mbcFactory.create(
      cartridgeConfig.type,
      rom,
      cartridgeConfig.ramSize,
      {
        onRamWrite: () => this.#scheduleSaveFlush(),
      },
    );
    this.#persistSaves =
      cartridgeConfig.batteryBacked || cartridgeConfig.hasRtc;
    this.bus.setSystemMode(this.#mode, cgbMode);
    this.ppu.setSystemMode(this.#mode, cgbMode, this.bus.getTicksPerCpuCycle());
    this.bus.loadCartridge(rom, this.#mbc);
    this.bus.setJoypadState(this.#inputState);
    this.cpu.reset();
    if (this.bus.isCgbHardware()) {
      const registers = cgbMode
        ? computeCgbNativeRegisters()
        : computeCgbCompatibilityRegisters(rom);
      this.cpu.setPowerOnState(registers);
    }
    this.ppu.reset();
    this.apu.reset();
    this.apu.setOutputSampleRate(this.#audioSampleRate);
    this.#audioRemainder = 0;
    this.#lastAudioTimestamp = this.#now();
    this.#nextFrameTimestamp = null;
    this.clock.setSpeed(1);
    this.cpu.state.registers.pc = 0x0100;
    this.#frameCount = 0;
    this.#inputState = createEmptyJoypadState();
    this.#callbacks?.onLog?.(
      `Loaded ROM ${this.#romInfo?.title ?? "(untitled)"}`,
    );
    this.#emitVideoFrame();
    this.#emitAudioChunk();
  }

  loadSave(payload: SavePayload): void {
    const saveCopy = {
      battery: payload.battery.slice(),
      rtc: payload.rtc ? payload.rtc.slice() : undefined,
    };
    this.#saveData = saveCopy;
    this.#applySaveDataToMbc(saveCopy);
    this.#resetSaveTracking();
    this.#callbacks?.onLog?.("Loaded save data.");
  }

  getSave(): SavePayload | null {
    const payload = this.#saveData ?? this.#buildSavePayload();
    if (!payload) {
      return null;
    }
    return {
      battery: payload.battery.slice(),
      rtc: payload.rtc ? payload.rtc.slice() : undefined,
    };
  }

  reset(hard?: boolean): void {
    this.#flushPendingSave();
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
    this.#inputState = createEmptyJoypadState();
    this.bus.setJoypadState(this.#inputState);
    if (hard) {
      this.#resetSaveTracking();
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
    this.apu.clearAudioBuffers();
    this.#audioRemainder = 0;
    const now = this.#now();
    this.#lastAudioTimestamp = now;
    this.#nextFrameTimestamp = now;
    this.#scheduleNextFrame();
    this.#callbacks?.onLog?.("Emulator started.");
  }

  pause(): void {
    if (!this.#running) {
      return;
    }
    this.#running = false;
    this.apu.clearAudioBuffers();
    if (this.#frameTimer !== null) {
      clearTimeout(this.#frameTimer);
      this.#frameTimer = null;
    }
    this.#nextFrameTimestamp = null;
    this.#flushPendingSave();
    this.#callbacks?.onLog?.("Emulator paused.");
  }

  isRunning(): boolean {
    return this.#running;
  }

  getRomInfo(): EmulatorRomInfo | null {
    return this.#romInfo ? { ...this.#romInfo } : null;
  }

  setInputState(state: JoypadInputState): void {
    this.#inputState = { ...state };
    this.bus.setJoypadState(this.#inputState);
  }

  setMode(mode: EmulatorMode): void {
    this.#mode = mode;
  }

  setSpeedMultiplier(multiplier: number): void {
    const normalized = this.#normalizeSpeedMultiplier(multiplier);
    if (normalized === this.#speedMultiplier) {
      return;
    }
    this.#speedMultiplier = normalized;
    if (this.#running) {
      if (this.#frameTimer !== null) {
        clearTimeout(this.#frameTimer);
        this.#frameTimer = null;
      }
      this.#nextFrameTimestamp = this.#now();
      this.#scheduleNextFrame();
    }
  }

  getSpeedMultiplier(): number {
    return this.#speedMultiplier;
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
    this.#flushPendingSave();
    this.pause();
    this.#resetSaveTracking();
    this.#callbacks = null;
  }

  #runFrame(): void {
    const targetFrame = this.#frameCount + 1;
    const cyclesPerFrame = this.#cpuCyclesPerFrame();
    const maxCycles = cyclesPerFrame * 2;
    let accumulatedCycles = 0;

    while (this.#frameCount < targetFrame) {
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
    const frameDuration = this.#frameDurationMs();

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

  #cpuCyclesPerFrame(): number {
    const ticksPerCpu = this.bus.getTicksPerCpuCycle();
    if (ticksPerCpu <= 0) {
      return Clock.FRAME_CYCLES / 4;
    }
    return Clock.FRAME_CYCLES / ticksPerCpu;
  }

  #tickSubsystems(cycles: number): void {
    this.bus.tick(cycles);
    this.ppu.tick(cycles);
    this.apu.tick(cycles);
    this.clock.stepBulk(cycles);
    this.#maybeFlushSave(this.clock.masterCycles);
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
      (elapsedMs * this.#audioSampleRate * this.#speedMultiplier) / 1000 +
      this.#audioRemainder;
    let sampleCount = Math.floor(expectedSamples);
    this.#audioRemainder = expectedSamples - sampleCount;

    if (sampleCount <= 0) {
      // Zero elapsed time (catch-up tick) – trickle a tiny buffer to avoid overfilling.
      sampleCount = Math.min(
        32,
        Math.max(1, Math.floor(this.#audioBufferSize / 16)),
      );
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

  #scheduleSaveFlush(): void {
    if (!this.#persistSaves) {
      return;
    }
    this.#ramDirty = true;
    this.#lastRamWriteCycles = this.clock.masterCycles;
    this.#ramDirtyWrites += 1;
  }

  #flushPendingSave(): void {
    if (this.#ramDirty) {
      this.#ramDirty = false;
      this.#ramDirtyWrites = 0;
      this.#emitSaveData();
    }
  }

  #resetSaveTracking(): void {
    this.#ramDirty = false;
    this.#lastRamWriteCycles = null;
    this.#ramDirtyWrites = 0;
  }

  #maybeFlushSave(currentCycles: number): void {
    if (
      !this.#persistSaves ||
      (this.#mbc.getRamSize() === 0 && !this.#mbc.hasRtc()) ||
      !this.#ramDirty
    ) {
      return;
    }
    if (this.#lastRamWriteCycles === null) {
      return;
    }
    const idleCycles = currentCycles - this.#lastRamWriteCycles;
    if (
      idleCycles < SAVE_GRACE_CYCLES ||
      (this.#ramDirtyWrites < MIN_SAVE_DIRTY_WRITES &&
        idleCycles < SAVE_LONG_IDLE_CYCLES)
    ) {
      return;
    }
    this.#ramDirty = false;
    this.#ramDirtyWrites = 0;
    this.#emitSaveData();
  }

  #applySaveDataToMbc(payload: SavePayload): void {
    if (!this.#mbc) {
      return;
    }
    this.#mbc.loadRamSnapshot(payload.battery);
    if (payload.rtc) {
      this.#mbc.loadRtcSnapshot(payload.rtc);
    }
    this.bus.refreshExternalRamWindow();
  }

  #buildSavePayload(): SavePayload | null {
    if (!this.#mbc) {
      return null;
    }
    const ram = this.#mbc.getRamSnapshot();
    const rtc = this.#mbc.getRtcSnapshot();
    if (ram.length === 0 && !rtc) {
      return null;
    }
    const battery = ram.length > 0 ? ram : new Uint8Array(0);
    const payload: SavePayload = {
      battery,
      rtc: rtc ?? undefined,
    };
    this.#saveData = {
      battery: battery.slice(),
      rtc: rtc ? rtc.slice() : undefined,
    };
    return payload;
  }

  #emitSaveData(): void {
    const payload = this.#buildSavePayload();
    if (!payload || !this.#callbacks) {
      return;
    }
    const rtcCopy = payload.rtc ? payload.rtc.slice() : undefined;
    this.#callbacks.onSaveData({
      battery: payload.battery.slice(),
      rtc: rtcCopy,
    });
  }

  #frameDurationMs(): number {
    return FRAME_DURATION_MS / this.#speedMultiplier;
  }

  #normalizeSpeedMultiplier(multiplier?: number): number {
    if (typeof multiplier !== "number" || Number.isNaN(multiplier)) {
      return 1;
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return 1;
    }
    return Math.max(MIN_SPEED_MULTIPLIER, multiplier);
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
  mode?: EmulatorMode;
  speedMultiplier?: number;
}

export function createEmulator(options: EmulatorInitOptions): Emulator {
  const clock = new Clock();
  const bus = new SystemBus();
  const cpu = new Cpu(bus);
  const ppu = new Ppu(bus);
  const apu = new Apu(bus);
  const mbcFactory = new MbcFactory();
  const emulator = new Emulator({
    clock,
    cpu,
    ppu,
    apu,
    bus,
    mbcFactory,
  });

  emulator.initialize({
    ...options,
    clock,
    cpu,
    ppu,
    apu,
    bus,
    mbcFactory,
  });
  return emulator;
}
