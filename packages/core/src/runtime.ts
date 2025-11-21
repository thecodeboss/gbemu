import { AudioBufferChunk, SavePayload, VideoFrame } from "./emulator.js";
import { JoypadInputState } from "./input.js";

export interface EmulatorWorkerRequestMap {
  loadRom: { rom: Uint8Array };
  loadSave: { payload: SavePayload };
  start: undefined;
  pause: undefined;
  reset: { hard?: boolean } | undefined;
  stepFrame: undefined;
  stepInstruction: undefined;
  setBreakpoints: { offsets: number[] };
  setInputState: { state: JoypadInputState };
  dispose: undefined;
  getRomInfo: undefined;
  getSave: undefined;
  disassembleRom: undefined;
  getProgramCounter: undefined;
  getCpuState: undefined;
  getMemorySnapshot: undefined;
}

export interface EmulatorWorkerEventMap {
  videoFrame: VideoFrame;
  audioSamples: AudioBufferChunk;
  saveData: SavePayload;
  log: string;
  error: unknown;
  breakpointHit: number;
}

export interface EmulatorWorkerPort {
  postMessage<T extends keyof EmulatorWorkerRequestMap>(
    type: T,
    payload: EmulatorWorkerRequestMap[T],
  ): void;
  terminate(): void;
}

export interface EmulatorWorkerClient {
  onMessage<T extends keyof EmulatorWorkerEventMap>(
    type: T,
    handler: (payload: EmulatorWorkerEventMap[T]) => void,
  ): void;
  offMessage<T extends keyof EmulatorWorkerEventMap>(
    type: T,
    handler: (payload: EmulatorWorkerEventMap[T]) => void,
  ): void;
}
