import {
  AudioBufferChunk,
  Emulator,
  EmulatorCallbacks,
  EmulatorCpuDebugState,
  EmulatorRomInfo,
  SavePayload,
  VideoFrame,
  JoypadInputState,
} from "@gbemu/core";
import * as Comlink from "comlink";
import { Remote } from "comlink";

export interface WorkerCallbacks {
  handleVideoFrame(frame: VideoFrame): Promise<void> | void;
  handleAudioSamples(chunk: AudioBufferChunk): Promise<void> | void;
  handleSaveData(payload: SavePayload): Promise<void> | void;
  handleLog?(message: string): Promise<void> | void;
  handleError?(error: unknown): Promise<void> | void;
  handleBreakpointHit?(offset: number): Promise<void> | void;
}

export interface WorkerInitializeOptions {
  callbacksPort: MessagePort;
  audioBufferSize?: number;
}

export interface EmulatorFactoryContext {
  callbacks: EmulatorCallbacks;
  audioBufferSize?: number;
}

export type EmulatorFactory = (
  context: EmulatorFactoryContext,
) => Promise<Emulator> | Emulator;

export interface EmulatorWorkerApi {
  initialize(options: WorkerInitializeOptions): Promise<void>;
  loadRom(message: { rom: Uint8Array }): Promise<void>;
  loadSave(message: { payload: SavePayload }): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  reset(options?: { hard?: boolean }): Promise<void>;
  stepFrame(): Promise<void>;
  stepInstruction(): Promise<void>;
  setBreakpoints(message: { offsets: number[] }): Promise<void>;
  setInputState(message: { state: JoypadInputState }): Promise<void>;
  dispose(): Promise<void>;
  getRomInfo(): Promise<EmulatorRomInfo | null>;
  getSave(): Promise<SavePayload | null>;
  disassembleRom(): Promise<Record<number, string> | null>;
  getProgramCounter(): Promise<number | null>;
  getCpuState(): Promise<EmulatorCpuDebugState>;
  getMemorySnapshot(): Promise<Uint8Array>;
}

export function createWorkerHost(factory: EmulatorFactory): EmulatorWorkerApi {
  let callbacks: Remote<WorkerCallbacks> | null = null;
  let emulator: Emulator | null = null;
  let isDisposed = false;
  let audioBufferSize: number | undefined;
  let callbacksPort: MessagePort | null = null;

  async function ensureEmulator(): Promise<Emulator> {
    if (isDisposed) {
      throw new Error("Worker runtime has been disposed.");
    }

    if (!callbacks) {
      throw new Error(
        "Worker runtime must be initialized before using the emulator.",
      );
    }

    if (!emulator) {
      const emulatorCallbacks = createEmulatorCallbacks(callbacks);
      emulator = await factory({
        callbacks: emulatorCallbacks,
        audioBufferSize,
      });
    }

    return emulator;
  }

  return {
    async initialize(options: WorkerInitializeOptions): Promise<void> {
      callbacksPort = options.callbacksPort;
      callbacks = Comlink.wrap<WorkerCallbacks>(callbacksPort);
      callbacksPort.start();
      audioBufferSize = options.audioBufferSize;
    },

    async loadRom(message): Promise<void> {
      const system = await ensureEmulator();
      await system.loadRom(message.rom);
    },

    async loadSave(message): Promise<void> {
      const system = await ensureEmulator();
      await system.loadSave(message.payload);
    },

    async start(): Promise<void> {
      const system = await ensureEmulator();
      system.start();
    },

    async pause(): Promise<void> {
      const system = await ensureEmulator();
      system.pause();
    },

    async reset(options?: { hard?: boolean }): Promise<void> {
      const system = await ensureEmulator();
      system.reset(options?.hard);
    },

    async stepFrame(): Promise<void> {
      const system = await ensureEmulator();
      system.stepFrame();
    },

    async stepInstruction(): Promise<void> {
      const system = await ensureEmulator();
      system.stepInstruction();
    },

    async setBreakpoints(message: { offsets: number[] }): Promise<void> {
      const system = await ensureEmulator();
      system.setBreakpoints(message.offsets ?? []);
    },

    async setInputState(message: { state: JoypadInputState }): Promise<void> {
      const system = await ensureEmulator();
      system.setInputState(message.state);
    },

    async dispose(): Promise<void> {
      if (emulator) {
        emulator.dispose();
        emulator = null;
      }
      isDisposed = true;
      callbacks = null;
      if (callbacksPort) {
        callbacksPort.close();
        callbacksPort = null;
      }
    },

    async getRomInfo(): Promise<EmulatorRomInfo | null> {
      const system = await ensureEmulator();
      return system.getRomInfo();
    },

    async getSave(): Promise<SavePayload | null> {
      const system = await ensureEmulator();
      const payload = system.getSave();
      if (!payload) {
        return null;
      }
      const batteryCopy = payload.battery.slice();
      const rtcCopy = payload.rtc ? payload.rtc.slice() : undefined;
      const transferables: Transferable[] = [batteryCopy.buffer];
      if (rtcCopy) {
        transferables.push(rtcCopy.buffer);
      }
      return Comlink.transfer(
        {
          battery: batteryCopy,
          rtc: rtcCopy,
        },
        transferables,
      );
    },

    async disassembleRom(): Promise<Record<number, string> | null> {
      const system = await ensureEmulator();
      return system.disassembleRom();
    },

    async getProgramCounter(): Promise<number | null> {
      const system = await ensureEmulator();
      return system.getProgramCounter();
    },

    async getCpuState(): Promise<EmulatorCpuDebugState> {
      const system = await ensureEmulator();
      const snapshot = system.getCpuState();
      return {
        registers: { ...snapshot.registers },
        flags: { ...snapshot.flags },
        ime: snapshot.ime,
        halted: snapshot.halted,
        stopped: snapshot.stopped,
        cycles: snapshot.cycles,
      };
    },

    async getMemorySnapshot(): Promise<Uint8Array> {
      const system = await ensureEmulator();
      const snapshot = system.getMemorySnapshot();
      const copy = snapshot.slice();
      return Comlink.transfer(copy, [copy.buffer]);
    },
  };
}

function createEmulatorCallbacks(
  callbacks: Remote<WorkerCallbacks>,
): EmulatorCallbacks {
  return {
    onVideoFrame(frame: VideoFrame) {
      const bufferCopy = frame.buffer.slice();
      void callbacks.handleVideoFrame?.(
        Comlink.transfer(
          {
            width: frame.width,
            height: frame.height,
            buffer: bufferCopy,
          },
          [bufferCopy.buffer],
        ),
      );
    },
    onAudioSamples(chunk: AudioBufferChunk) {
      const samplesCopy = chunk.samples.slice();
      void callbacks.handleAudioSamples?.(
        Comlink.transfer(
          {
            samples: samplesCopy,
            sampleRate: chunk.sampleRate,
          },
          [samplesCopy.buffer],
        ),
      );
    },
    onSaveData(payload: SavePayload) {
      const batteryCopy = payload.battery.slice();
      const rtcCopy = payload.rtc ? payload.rtc.slice() : undefined;
      const transferables: Transferable[] = [batteryCopy.buffer];
      if (rtcCopy) {
        transferables.push(rtcCopy.buffer);
      }
      void callbacks.handleSaveData?.(
        Comlink.transfer(
          {
            battery: batteryCopy,
            rtc: rtcCopy,
          },
          transferables,
        ),
      );
    },
    onLog(message: string) {
      const log = callbacks.handleLog;
      if (typeof log === "function") {
        void log(message);
      }
    },
    onError(error: unknown) {
      const handler = callbacks.handleError;
      if (typeof handler === "function") {
        void handler(error);
        return;
      }
      console.error("[gbemu/runtime]", error);
    },
    onBreakpointHit(offset: number) {
      const handler = callbacks.handleBreakpointHit;
      if (typeof handler === "function") {
        void handler(offset);
      }
    },
  };
}
