import type { Cpu } from "./cpu.js";
import type { Ppu } from "./ppu.js";
import type { Apu } from "./apu.js";
import type { SystemBus } from "./bus.js";
import type { MbcFactory } from "./mbc.js";
import type { Clock } from "./clock.js";

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

export interface EmulatorRomInfo {
  title: string;
  cartridgeType: number;
  romSize: number;
  ramSize: number;
  cgbFlag: number;
  sgbFlag: number;
  destinationCode: number;
}

export interface EmulatorStateSnapshot {
  cpu: unknown;
  ppu: unknown;
  apu: unknown;
  bus: unknown;
  clock: unknown;
  mbc: unknown;
}

export interface Emulator {
  readonly cpu: Cpu;
  readonly ppu: Ppu;
  readonly apu: Apu;
  readonly bus: SystemBus;
  readonly clock: Clock;
  initialize(options: EmulatorOptions): void;
  loadRom(rom: Uint8Array): void;
  loadSave(payload: SavePayload): void;
  getSave(): SavePayload | null;
  reset(hard?: boolean): void;
  start(): void;
  pause(): void;
  stepFrame(): void;
  isRunning(): boolean;
  getRomInfo(): EmulatorRomInfo | null;
  getStateSnapshot(): EmulatorStateSnapshot;
  restoreState(snapshot: EmulatorStateSnapshot): void;
  dispose(): void;
}
