import {
  ReactNode,
  Ref,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { RuntimeClient, createRuntimeClient } from "@gbemu/runtime";
import audioWorkletModuleUrl from "@gbemu/runtime/src/audio/worklet-processor.ts?worker&url";

import { useSaveStorage } from "@/hooks/use-save-storage";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { createEmptyJoypadState } from "@gbemu/core";

const AUDIO_WORKLET_MODULE_URL = new URL(
  audioWorkletModuleUrl,
  import.meta.url,
);

interface EmulatorContextValue {
  runtime: RuntimeClient | null;
  canvasRef: Ref<HTMLCanvasElement>;
  ensureRuntimeClient: (options?: {
    autoPersistSaves?: boolean;
  }) => Promise<RuntimeClient>;
  isRomLoading: boolean;
  romLoadError: string | null;
}

const EmulatorContext = createContext<EmulatorContextValue | undefined>(
  undefined,
);

export function EmulatorProvider({ children }: { children: ReactNode }) {
  const { saveStorage, ensureSaveStorage, setRomTitle } = useSaveStorage();
  const { rom } = useCurrentRom();
  const [runtime, setRuntime] = useState<RuntimeClient | null>(null);
  const [isRomLoading, setIsRomLoading] = useState(false);
  const [romLoadError, setRomLoadError] = useState<string | null>(null);
  const runtimeRef = useRef<RuntimeClient | null>(null);
  const runtimePromiseRef = useRef<Promise<RuntimeClient> | null>(null);
  const runtimeCreationIdRef = useRef(0);
  const runtimeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const canvasRef: Ref<HTMLCanvasElement> = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasElementRef.current = node;
      setIsCanvasReady(Boolean(node));
    },
    [],
  );

  const destroyRuntime = useCallback(async () => {
    runtimeCreationIdRef.current += 1;
    const runtimeClient = runtimeRef.current;
    runtimeRef.current = null;
    runtimePromiseRef.current = null;
    runtimeCanvasRef.current = null;
    setRuntime(null);
    if (runtimeClient) {
      await runtimeClient.dispose();
    }
  }, []);

  const ensureAudioContext = useCallback(async (): Promise<AudioContext> => {
    let audioContext = audioContextRef.current;
    if (!audioContext) {
      audioContext = new AudioContext();
      audioContextRef.current = audioContext;
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    return audioContext;
  }, []);

  const ensureRuntimeClient = useCallback(
    async (
      options: { autoPersistSaves?: boolean } = {},
    ): Promise<RuntimeClient> => {
      if (runtimePromiseRef.current) {
        return runtimePromiseRef.current;
      }

      const canvas = canvasElementRef.current;
      if (!canvas) {
        throw new Error("Display surface has not been initialised.");
      }

      if (runtimePromiseRef.current) {
        if (runtimeCanvasRef.current !== canvas) {
          await destroyRuntime();
        } else {
          return runtimePromiseRef.current;
        }
      }

      const existing = runtimeRef.current;
      if (existing) {
        if (existing.renderer.canvas === canvas) {
          runtimeCanvasRef.current = canvas;
          return existing;
        }
        await destroyRuntime();
      }

      const creationId = runtimeCreationIdRef.current + 1;
      runtimeCreationIdRef.current = creationId;

      const runtimePromise = createRuntimeClient({
        createWorker: () =>
          new Worker(
            new URL(
              "@gbemu/runtime/src/worker/emulator-worker.ts",
              import.meta.url,
            ),
            { type: "module" },
          ),
        audioContext: await ensureAudioContext(),
        audioWorkletModuleUrl: AUDIO_WORKLET_MODULE_URL,
        canvas,
        saveStorage: saveStorage ?? ensureSaveStorage() ?? undefined,
        autoPersistSaves: options.autoPersistSaves ?? true,
      });
      runtimePromiseRef.current = runtimePromise;
      const runtimeClient = await runtimePromise;
      if (runtimeCreationIdRef.current !== creationId) {
        await runtimeClient.dispose();
        runtimeCanvasRef.current = null;
        throw new Error("Runtime initialisation was superseded.");
      }
      runtimePromiseRef.current = null;

      runtimeRef.current = runtimeClient;
      runtimeCanvasRef.current = canvas;
      setRuntime(runtimeClient);
      return runtimeClient;
    },
    [destroyRuntime, ensureAudioContext, ensureSaveStorage, saveStorage],
  );

  useEffect(() => {
    return () => {
      void (async () => {
        await destroyRuntime();

        const audio = audioContextRef.current;
        audioContextRef.current = null;
        if (audio) {
          await audio.close();
        }
      })();
    };
  }, [destroyRuntime]);

  const value = useMemo<EmulatorContextValue>(
    () => ({
      runtime,
      canvasRef,
      ensureRuntimeClient,
      isRomLoading,
      romLoadError,
    }),
    [canvasRef, ensureRuntimeClient, isRomLoading, romLoadError, runtime],
  );

  useEffect(() => {
    if (!rom) {
      setRomLoadError(null);
      setIsRomLoading(false);
      return;
    }

    setRomLoadError(null);
    setIsRomLoading(true);
    if (!isCanvasReady) {
      return;
    }

    void (async () => {
      try {
        const runtimeClient = await ensureRuntimeClient({
          autoPersistSaves: true,
        });
        await runtimeClient.pause();
        await runtimeClient.reset({ hard: true });
        await runtimeClient.loadRom(rom.data);
        const info = await runtimeClient.getRomInfo();
        setRomTitle(info?.title ?? null);
        await runtimeClient.setInputState(createEmptyJoypadState());
        await runtimeClient.start();
      } catch (err: unknown) {
        console.error(err);
        setRomLoadError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsRomLoading(false);
      }
    })();
  }, [ensureRuntimeClient, isCanvasReady, rom, setRomTitle]);

  return (
    <EmulatorContext.Provider value={value}>
      {children}
    </EmulatorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEmulator(): EmulatorContextValue {
  const context = useContext(EmulatorContext);
  if (!context) {
    throw new Error("useEmulator must be used within an EmulatorProvider");
  }
  return context;
}
