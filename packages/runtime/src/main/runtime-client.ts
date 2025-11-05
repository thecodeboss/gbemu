import type { EmulatorRomInfo, SavePayload } from "@gbemu/core";
import * as Comlink from "comlink";
import { createEmulatorAudioNode } from "../audio/node.js";
import type { EmulatorAudioNode } from "../audio/node.js";
import { Canvas2DRenderer } from "../video/canvas2d-renderer.js";
import type { Canvas2DRendererOptions } from "../video/canvas2d-renderer.js";
import {
  deserializeSavePayload,
  serializeSavePayload,
} from "../save/storage.js";
import type { SaveStorageAdapter } from "../save/storage.js";
import type { EmulatorWorkerApi, WorkerCallbacks } from "../worker/index.js";

export interface RuntimeClientOptions {
  createWorker(): Worker;
  audioContext: AudioContext;
  audioWorkletModuleUrl: string | URL;
  canvas: HTMLCanvasElement;
  canvasOptions?: Canvas2DRendererOptions;
  saveStorage?: SaveStorageAdapter;
  audioBufferSize?: number;
  autoPersistSaves?: boolean;
  onLog?(message: string): void;
  onError?(error: unknown): void;
}

export interface RuntimeClient {
  loadRom(rom: Uint8Array): Promise<void>;
  loadSave(payload: SavePayload): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  reset(options?: { hard?: boolean }): Promise<void>;
  stepFrame(): Promise<void>;
  getRomInfo(): Promise<EmulatorRomInfo | null>;
  getSave(): Promise<SavePayload | null>;
  loadPersistentSave(): Promise<void>;
  disassembleRom(): Promise<string | null>;
  dispose(): Promise<void>;
  readonly renderer: Canvas2DRenderer;
  readonly audio: EmulatorAudioNode;
  readonly worker: Worker;
}

export async function createRuntimeClient(
  options: RuntimeClientOptions
): Promise<RuntimeClient> {
  const worker = options.createWorker();
  const workerEndpoint = Comlink.wrap<EmulatorWorkerApi>(worker);
  const audioNode = await createEmulatorAudioNode({
    context: options.audioContext,
    workletModuleUrl: options.audioWorkletModuleUrl,
  });
  audioNode.connect();

  const renderer = new Canvas2DRenderer(options.canvas, options.canvasOptions);

  const callbacks: WorkerCallbacks = {
    async handleVideoFrame(frame) {
      renderer.drawFrame(frame);
    },
    async handleAudioSamples(chunk) {
      audioNode.enqueue(chunk);
    },
    async handleSaveData(payload) {
      if (options.saveStorage && options.autoPersistSaves) {
        await options.saveStorage.write(serializeSavePayload(payload));
      }
    },
    handleLog(message: string) {
      if (options.onLog) {
        options.onLog(message);
      } else {
        console.log("[gbemu/runtime]", message);
      }
    },
    handleError(error: unknown) {
      if (options.onError) {
        options.onError(error);
      } else {
        console.error("[gbemu/runtime]", error);
      }
    },
  };

  const callbackChannel = new MessageChannel();
  Comlink.expose(callbacks, callbackChannel.port1);
  callbackChannel.port1.start();

  await workerEndpoint.initialize(
    Comlink.transfer(
      {
        callbacksPort: callbackChannel.port2,
        audioBufferSize: options.audioBufferSize,
      },
      [callbackChannel.port2]
    )
  );

  async function loadRom(rom: Uint8Array): Promise<void> {
    const romCopy = rom.slice();
    await workerEndpoint.loadRom(
      Comlink.transfer({ rom: romCopy }, [romCopy.buffer])
    );
    if (options.autoPersistSaves) {
      await loadPersistentSave();
    }
  }

  async function loadPersistentSave(): Promise<void> {
    if (!options.saveStorage) {
      return;
    }
    const serialized = await options.saveStorage.read();
    if (!serialized) {
      return;
    }
    const payload = deserializeSavePayload(serialized);
    await loadSave(payload);
  }

  async function loadSave(payload: SavePayload): Promise<void> {
    const batteryCopy = payload.battery.slice();
    const rtcCopy = payload.rtc ? payload.rtc.slice() : undefined;
    const transferables: Transferable[] = [batteryCopy.buffer];
    if (rtcCopy) {
      transferables.push(rtcCopy.buffer);
    }

    await workerEndpoint.loadSave(
      Comlink.transfer(
        {
          payload: {
            battery: batteryCopy,
            rtc: rtcCopy,
          },
        },
        transferables
      )
    );
  }

  async function dispose(): Promise<void> {
    await workerEndpoint.dispose();
    audioNode.flush();
    audioNode.disconnect();
    worker.terminate();
    callbackChannel.port1.close();
  }

  return {
    loadRom,
    loadSave,
    start: () => workerEndpoint.start(),
    pause: () => workerEndpoint.pause(),
    reset: (opts) => workerEndpoint.reset(opts),
    stepFrame: () => workerEndpoint.stepFrame(),
    getRomInfo: () => workerEndpoint.getRomInfo(),
    async getSave() {
      const payload = await workerEndpoint.getSave();
      if (payload && options.autoPersistSaves && options.saveStorage) {
        await options.saveStorage.write(serializeSavePayload(payload));
      }
      return payload;
    },
    loadPersistentSave,
    disassembleRom: () => workerEndpoint.disassembleRom(),
    dispose,
    renderer,
    audio: audioNode,
    worker,
  };
}
