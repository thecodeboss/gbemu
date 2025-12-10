import {
  EmulatorRomInfo,
  SavePayload,
  JoypadInputState,
  EmulatorMode,
} from "@gbemu/core";
import * as Comlink from "comlink";
import { createEmulatorAudioNode } from "../audio/node.js";
import { EmulatorAudioNode } from "../audio/node.js";
import { Canvas2DRenderer } from "../video/canvas2d-renderer.js";
import { Canvas2DRendererOptions } from "../video/canvas2d-renderer.js";
import {
  SaveStorageAdapter,
  SaveStorageKey,
  createSaveStorageKey,
  deserializeSavePayload,
  serializeSavePayload,
} from "../save/storage.js";
import { EmulatorWorkerApi, WorkerCallbacks } from "../worker/index.js";
import {
  fetchPreferredSavePayload,
  rememberActiveSaveName,
  resolveSaveKey,
} from "./save-selection.js";

export interface RuntimeClientOptions {
  createWorker(): Worker;
  audioContext: AudioContext;
  audioWorkletModuleUrl: string | URL;
  canvas: HTMLCanvasElement;
  canvasOptions?: Canvas2DRendererOptions;
  saveStorage?: SaveStorageAdapter;
  audioBufferSize?: number;
  autoPersistSaves?: boolean;
  mode?: EmulatorMode;
  speedMultiplier?: number;
  onLog?(message: string): void;
  onError?(error: unknown): void;
}

function detectModeFromRomHeader(rom: Uint8Array): EmulatorMode {
  const cgbFlag = rom[0x143] ?? 0;
  return cgbFlag === 0x80 || cgbFlag === 0xc0 ? "cgb" : "dmg";
}

export interface RuntimeClient {
  loadRom(
    rom: Uint8Array,
    options?: { skipPersistentLoad?: boolean; saveName?: string },
  ): Promise<void>;
  loadSave(
    payload: SavePayload,
    options?: { name?: string; id?: string },
  ): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  reset(options?: { hard?: boolean }): Promise<void>;
  getRomInfo(): Promise<EmulatorRomInfo | null>;
  getSave(): Promise<SavePayload | null>;
  loadPersistentSave(): Promise<void>;
  dispose(): Promise<void>;
  setInputState(state: JoypadInputState): Promise<void>;
  setMode(mode: EmulatorMode): Promise<void>;
  setSpeedMultiplier(multiplier: number): Promise<void>;
  readonly renderer: Canvas2DRenderer;
  readonly audio: EmulatorAudioNode;
  readonly worker: Worker;
}

export async function createRuntimeClient(
  options: RuntimeClientOptions,
): Promise<RuntimeClient> {
  const autoPersistSaves = options.autoPersistSaves ?? true;
  let currentSaveKey: SaveStorageKey | null = null;
  let currentRomInfo: EmulatorRomInfo | null = null;
  let currentMode: EmulatorMode = options.mode ?? "dmg";
  let currentSpeedMultiplier = options.speedMultiplier ?? 1;

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
      if (options.saveStorage && autoPersistSaves && currentSaveKey !== null) {
        await options.saveStorage.write(
          currentSaveKey,
          serializeSavePayload(payload),
        );
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
        audioSampleRate: options.audioContext.sampleRate,
        mode: currentMode,
        speedMultiplier: currentSpeedMultiplier,
      },
      [callbackChannel.port2],
    ),
  );

  async function loadRom(
    rom: Uint8Array,
    loadOptions: { skipPersistentLoad?: boolean; saveName?: string } = {},
  ): Promise<void> {
    currentMode = detectModeFromRomHeader(rom);
    const romCopy = rom.slice();
    await workerEndpoint.setMode({ mode: currentMode });
    await workerEndpoint.loadRom(
      Comlink.transfer({ rom: romCopy }, [romCopy.buffer]),
    );
    currentRomInfo = await workerEndpoint.getRomInfo();
    currentSaveKey = await resolveSaveKey({
      romInfo: currentRomInfo,
      requestedName: loadOptions.saveName,
      saveStorage: options.saveStorage,
    });
    rememberActiveSaveName(currentSaveKey);
    if (autoPersistSaves && !loadOptions.skipPersistentLoad) {
      await loadPersistentSave();
    }
  }

  async function loadPersistentSave(): Promise<void> {
    if (!options.saveStorage) {
      return;
    }

    if (!currentRomInfo) {
      currentRomInfo = await workerEndpoint.getRomInfo();
    }

    const resolved = await fetchPreferredSavePayload({
      saveStorage: options.saveStorage,
      currentSaveKey,
      romInfo: currentRomInfo,
    });
    if (!resolved) {
      return;
    }

    currentSaveKey = resolved.key;
    const payload = deserializeSavePayload(resolved.payload);
    await loadSave(payload, {
      name: currentSaveKey.name,
      id: currentSaveKey.id,
    });
    rememberActiveSaveName(currentSaveKey);
  }

  async function loadSave(
    payload: SavePayload,
    saveOptions?: { name?: string; id?: string },
  ): Promise<void> {
    const batteryCopy = payload.battery.slice();
    const rtcCopy = payload.rtc ? payload.rtc.slice() : undefined;
    const transferables: Transferable[] = [batteryCopy.buffer];
    if (rtcCopy) {
      transferables.push(rtcCopy.buffer);
    }

    if (options.saveStorage && currentRomInfo && saveOptions?.name) {
      const resolvedId =
        saveOptions.id ??
        (currentSaveKey?.name === saveOptions.name
          ? currentSaveKey?.id
          : undefined);
      currentSaveKey = createSaveStorageKey(
        currentRomInfo.title,
        saveOptions.name,
        resolvedId,
      );
    }

    await workerEndpoint.loadSave(
      Comlink.transfer(
        {
          payload: {
            battery: batteryCopy,
            rtc: rtcCopy,
          },
        },
        transferables,
      ),
    );
    rememberActiveSaveName(currentSaveKey);
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
    pause: async () => {
      await workerEndpoint.pause();
      audioNode.flush();
    },
    reset: async (opts) => {
      await workerEndpoint.reset(opts);
      if (opts?.hard) {
        currentRomInfo = null;
        currentSaveKey = null;
      }
      audioNode.flush();
    },
    setInputState: (state) => workerEndpoint.setInputState({ state }),
    async setMode(mode) {
      currentMode = mode;
      await workerEndpoint.setMode({ mode });
    },
    async setSpeedMultiplier(multiplier) {
      currentSpeedMultiplier = multiplier;
      await workerEndpoint.setSpeedMultiplier({ multiplier });
    },
    async getRomInfo() {
      currentRomInfo = await workerEndpoint.getRomInfo();
      if (currentRomInfo && !currentSaveKey) {
        currentSaveKey = createSaveStorageKey(currentRomInfo.title);
      }
      return currentRomInfo;
    },
    async getSave() {
      const payload = await workerEndpoint.getSave();
      if (
        payload &&
        autoPersistSaves &&
        options.saveStorage &&
        currentSaveKey
      ) {
        await options.saveStorage.write(
          currentSaveKey,
          serializeSavePayload(payload),
        );
      }
      return payload;
    },
    loadPersistentSave,
    dispose,
    renderer,
    audio: audioNode,
    worker,
  };
}
