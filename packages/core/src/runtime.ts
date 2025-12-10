import {
  AudioBufferChunk,
  EmulatorMode,
  SavePayload,
  VideoFrame,
} from "./emulator.js";
import { JoypadInputState } from "./input.js";

export interface EmulatorWorkerRequestMap {
  loadRom: { rom: Uint8Array };
  loadSave: { payload: SavePayload };
  start: undefined;
  pause: undefined;
  reset: { hard?: boolean } | undefined;
  setMode: { mode: EmulatorMode };
  setInputState: { state: JoypadInputState };
  setSpeedMultiplier: { multiplier: number };
  dispose: undefined;
  getRomInfo: undefined;
  getSave: undefined;
}

export interface EmulatorWorkerEventMap {
  videoFrame: VideoFrame;
  audioSamples: AudioBufferChunk;
  saveData: SavePayload;
  log: string;
  error: unknown;
}
