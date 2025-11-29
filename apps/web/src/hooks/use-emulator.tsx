import {
  ReactNode,
  RefObject,
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
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ensureRuntimeClient: (
    options?: { autoPersistSaves?: boolean },
  ) => Promise<RuntimeClient>;
  isRomLoading: boolean;
  romLoadError: string | null;
}

const EmulatorContext = createContext<EmulatorContextValue | undefined>(
  undefined,
);

export function EmulatorProvider({ children }: { children: ReactNode }) {
  const { saveStorage, ensureSaveStorage } = useSaveStorage();
  const { rom } = useCurrentRom();
  const [runtime, setRuntime] = useState<RuntimeClient | null>(null);
  const [isRomLoading, setIsRomLoading] = useState(false);
  const [romLoadError, setRomLoadError] = useState<string | null>(null);
  const runtimeRef = useRef<RuntimeClient | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
      const existing = runtimeRef.current;
      if (existing) {
        return existing;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Display surface has not been initialised.");
      }

      const runtimeClient = await createRuntimeClient({
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

      runtimeRef.current = runtimeClient;
      setRuntime(runtimeClient);
      return runtimeClient;
    },
    [ensureAudioContext, ensureSaveStorage, saveStorage],
  );

  useEffect(() => {
    return () => {
      const runtimeClient = runtimeRef.current;
      runtimeRef.current = null;
      setRuntime(null);
      if (runtimeClient) {
        void runtimeClient.dispose();
      }

      const audio = audioContextRef.current;
      audioContextRef.current = null;
      if (audio) {
        void audio.close();
      }
    };
  }, []);

  const value = useMemo<EmulatorContextValue>(
    () => ({
      runtime,
      canvasRef,
      ensureRuntimeClient,
      isRomLoading,
      romLoadError,
    }),
    [ensureRuntimeClient, isRomLoading, romLoadError, runtime],
  );

  useEffect(() => {
    if (!rom) {
      setRomLoadError(null);
      setIsRomLoading(false);
      return;
    }

    setRomLoadError(null);
    setIsRomLoading(true);

    void (async () => {
      try {
        const runtimeClient = await ensureRuntimeClient({
          autoPersistSaves: true,
        });
        await runtimeClient.pause();
        await runtimeClient.reset({ hard: true });
        await runtimeClient.loadRom(rom.data);
        await runtimeClient.setInputState(createEmptyJoypadState());
        await runtimeClient.start();
      } catch (err: unknown) {
        console.error(err);
        setRomLoadError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsRomLoading(false);
      }
    })();
  }, [ensureRuntimeClient, rom]);

  return (
    <EmulatorContext.Provider value={value}>
      {children}
    </EmulatorContext.Provider>
  );
}

export function useEmulator(): EmulatorContextValue {
  const context = useContext(EmulatorContext);
  if (!context) {
    throw new Error("useEmulator must be used within an EmulatorProvider");
  }
  return context;
}
