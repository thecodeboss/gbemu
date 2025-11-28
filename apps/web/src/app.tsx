import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  SaveStorageAdapter,
  RuntimeClient,
  createIndexedDbSaveAdapter,
  createRuntimeClient,
  createSaveStorageKey,
  deserializeSavePayload,
} from "@gbemu/runtime";
import {
  JOYPAD_BUTTONS,
  JoypadInputState,
  SavePayload,
  createEmptyJoypadState,
} from "@gbemu/core";
import { DisplayCard } from "@/components/display-card";
import { ErrorCard } from "@/components/error-card";
import { LoadingCard } from "@/components/loading-card";
import { MenuCard } from "@/components/menu-card";
import { RomDebugCard } from "@/components/debug-card";
import { VramViewerCard } from "@/components/vram-viewer";
import { CpuDebugSnapshot, RomInfo } from "@/types/runtime";
import { useGamepad } from "@/hooks/use-gamepad";
import { ManageSavesDialog } from "@/components/manage-saves/manage-saves-dialog";
import { cn } from "@/lib/utils";
import { VirtualJoypad } from "@/components/virtual-joypad";
import audioWorkletModuleUrl from "@gbemu/runtime/src/audio/worklet-processor.ts?worker&url";

const AUDIO_WORKLET_MODULE_URL = new URL(
  audioWorkletModuleUrl,
  import.meta.url,
);

type AppPhase = "menu" | "loading" | "running" | "error";

const detectIsMobileDevice = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const ua = navigator.userAgent ?? "";
  const isMobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return coarsePointer || isMobileUa;
};

function App() {
  const [phase, setPhase] = useState<AppPhase>("menu");
  const [romName, setRomName] = useState<string | null>(null);
  const [romInfo, setRomInfo] = useState<RomInfo>(null);
  const [error, setError] = useState<string | null>(null);
  const [disassembly, setDisassembly] = useState<Record<number, string> | null>(
    null,
  );
  const [disassemblyError, setDisassemblyError] = useState<string | null>(null);
  const [isDisassembling, setIsDisassembling] = useState(false);
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [currentInstructionOffset, setCurrentInstructionOffset] = useState<
    number | null
  >(null);
  const [cpuState, setCpuState] = useState<CpuDebugSnapshot | null>(null);
  const [memorySnapshot, setMemorySnapshot] = useState<Uint8Array | null>(null);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(() => new Set());
  const [shouldCenterDisassembly, setShouldCenterDisassembly] = useState(false);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false);
  const [hasRequestedDisassembly, setHasRequestedDisassembly] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() =>
    detectIsMobileDevice(),
  );
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 767px)").matches,
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeClient | null>(null);
  const saveStorageRef = useRef<SaveStorageAdapter | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const romDataRef = useRef<Uint8Array | null>(null);
  const hardwareInputRef = useRef<JoypadInputState>(createEmptyJoypadState());
  const virtualInputRef = useRef<JoypadInputState>(createEmptyJoypadState());
  const autoPauseRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const query = window.matchMedia("(max-width: 767px)");
    const updateViewportFlag = (
      event: MediaQueryList | MediaQueryListEvent,
    ) => {
      setIsMobileViewport(event.matches);
    };
    updateViewportFlag(query);
    query.addEventListener("change", updateViewportFlag);
    return () => {
      query.removeEventListener("change", updateViewportFlag);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateMobileDeviceFlag = () => {
      setIsMobileDevice(detectIsMobileDevice());
    };
    updateMobileDeviceFlag();
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    coarsePointerQuery.addEventListener("change", updateMobileDeviceFlag);
    return () => {
      coarsePointerQuery.removeEventListener("change", updateMobileDeviceFlag);
    };
  }, []);

  useEffect(() => {
    return () => {
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (runtime) {
        void runtime.dispose();
      }

      const audio = audioContextRef.current;
      audioContextRef.current = null;
      if (audio) {
        void audio.close();
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== "running") {
      setCpuState(null);
      setMemorySnapshot(null);
    }
  }, [phase]);

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

  const ensureSaveStorage = useCallback((): SaveStorageAdapter | null => {
    if (saveStorageRef.current) {
      return saveStorageRef.current;
    }
    try {
      const adapter = createIndexedDbSaveAdapter();
      saveStorageRef.current = adapter;
      return adapter;
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  const mergeInputStates = useCallback(
    (hardware: JoypadInputState, virtual: JoypadInputState) => {
      const merged = createEmptyJoypadState();
      for (const button of JOYPAD_BUTTONS) {
        merged[button] = Boolean(hardware[button] || virtual[button]);
      }
      return merged;
    },
    [],
  );

  const applyInputState = useCallback(
    (partial: { hardware?: JoypadInputState; virtual?: JoypadInputState }) => {
      if (partial.hardware) {
        hardwareInputRef.current = partial.hardware;
      }
      if (partial.virtual) {
        virtualInputRef.current = partial.virtual;
      }
      const runtime = runtimeRef.current;
      const merged = mergeInputStates(
        hardwareInputRef.current,
        virtualInputRef.current,
      );
      if (!runtime) {
        return;
      }
      void runtime.setInputState(merged).catch((err: unknown) => {
        console.error(err);
      });
    },
    [mergeInputStates],
  );

  const refreshDebugInfo = useCallback(async (): Promise<void> => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    try {
      const [cpuSnapshot, memorySnapshotValue] = await Promise.all([
        runtime.getCpuState(),
        runtime.getMemorySnapshot(),
      ]);
      setCpuState(cpuSnapshot);
      setMemorySnapshot(memorySnapshotValue);
    } catch (err: unknown) {
      console.error(err);
    }
  }, []);

  const syncRuntimeBreakpoints = useCallback(
    (next: Set<number>) => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      const offsets = Array.from(next).sort((a, b) => a - b);
      void runtime.setBreakpoints(offsets).catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      });
    },
    [setError],
  );

  const ensureRuntimeClient = useCallback(async (): Promise<RuntimeClient> => {
    const runtime = runtimeRef.current;
    if (runtime) {
      return runtime;
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
      saveStorage: ensureSaveStorage() ?? undefined,
      autoPersistSaves: true,
      onBreakpointHit: (offset: number) => {
        setIsBreakMode(true);
        setIsStepping(false);
        setCurrentInstructionOffset(offset);
        setShouldCenterDisassembly(true);
        void refreshDebugInfo();
      },
    });

    runtimeRef.current = runtimeClient;
    const initialInput = mergeInputStates(
      hardwareInputRef.current,
      virtualInputRef.current,
    );
    void runtimeClient.setInputState(initialInput).catch((err: unknown) => {
      console.error(err);
    });
    return runtimeClient;
  }, [
    ensureAudioContext,
    ensureSaveStorage,
    mergeInputStates,
    refreshDebugInfo,
  ]);

  useEffect(() => {
    if (phase !== "running" || !isDebugVisible || isMobileViewport) {
      return;
    }
    let cancelled = false;
    let timeoutId: number | null = null;
    const poll = async (): Promise<void> => {
      await refreshDebugInfo();
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, 750);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isDebugVisible, isMobileViewport, phase, refreshDebugInfo]);

  useEffect(() => {
    if (phase !== "running") {
      autoPauseRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (!isMobileDevice) {
      autoPauseRef.current = false;
      return;
    }
    const handleVisibilityChange = () => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      if (document.visibilityState === "hidden") {
        if (phase === "running" && !isBreakMode) {
          autoPauseRef.current = true;
          void runtime.pause().catch((err: unknown) => {
            console.error(err);
          });
        }
        return;
      }
      if (
        document.visibilityState === "visible" &&
        phase === "running" &&
        autoPauseRef.current &&
        !isBreakMode
      ) {
        autoPauseRef.current = false;
        void runtime.start().catch((err: unknown) => {
          console.error(err);
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isBreakMode, isMobileDevice, phase]);

  const handleRomSelection = useCallback(
    async (file: File | null): Promise<void> => {
      if (!file) {
        return;
      }

      setError(null);
      setRomInfo(null);
      setRomName(file.name);
      setDisassembly(null);
      setDisassemblyError(null);
      setIsDisassembling(false);
      setHasRequestedDisassembly(false);
      setCurrentInstructionOffset(null);
      setIsBreakMode(false);
      setIsStepping(false);
      setBreakpoints(new Set());
      setShouldCenterDisassembly(false);
      setPhase("loading");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const rom = new Uint8Array(arrayBuffer);
        romDataRef.current = rom;

        const runtime = await ensureRuntimeClient();
        await runtime.pause();
        await runtime.reset({ hard: true });
        await runtime.loadRom(rom);
        await runtime.setBreakpoints([]);
        const info = await runtime.getRomInfo();
        setRomInfo(info);
        const programCounter = await runtime.getProgramCounter();
        setCurrentInstructionOffset(programCounter ?? null);
        await runtime.start();
        setIsBreakMode(false);
        setIsStepping(false);

        setPhase("running");
        void refreshDebugInfo();
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    },
    [ensureRuntimeClient, refreshDebugInfo],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.target.files ?? []);
      void handleRomSelection(file ?? null);
      event.target.value = "";
    },
    [handleRomSelection],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleToggleBreakpoint = useCallback(
    (offset: number) => {
      setBreakpoints((prev) => {
        const next = new Set(prev);
        if (next.has(offset)) {
          next.delete(offset);
        } else {
          next.add(offset);
        }
        syncRuntimeBreakpoints(next);
        return next;
      });
    },
    [syncRuntimeBreakpoints],
  );

  const handleReturnToMenu = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime) {
      void runtime.pause();
      void runtime.setBreakpoints([]);
      runtime.renderer.clear("#000000");
      void runtime.setInputState(createEmptyJoypadState());
    }
    hardwareInputRef.current = createEmptyJoypadState();
    virtualInputRef.current = createEmptyJoypadState();
    setDisassembly(null);
    setDisassemblyError(null);
    setIsDisassembling(false);
    setIsStepping(false);
    setIsBreakMode(false);
    setHasRequestedDisassembly(false);
    setCurrentInstructionOffset(null);
    setBreakpoints(new Set());
    setShouldCenterDisassembly(false);
    setIsSaveManagerOpen(false);
    setPhase("menu");
    setError(null);
    setRomName(null);
    setRomInfo(null);
    romDataRef.current = null;
  }, []);

  const handleDisassemble = useCallback(() => {
    setHasRequestedDisassembly(true);
    setDisassemblyError(null);
    setIsDisassembling(true);
    void (async () => {
      try {
        const runtime = await ensureRuntimeClient();
        const result = await runtime.disassembleRom();
        if (result == null) {
          setDisassemblyError("Disassembly is unavailable for this ROM.");
          return;
        }
        setDisassembly(result);
        if (currentInstructionOffset === null) {
          const pc = await runtime.getProgramCounter();
          setCurrentInstructionOffset(pc ?? null);
        }
      } catch (err: unknown) {
        console.error(err);
        setDisassemblyError(
          err instanceof Error ? err.message : "Failed to disassemble the ROM.",
        );
      } finally {
        setIsDisassembling(false);
      }
    })();
  }, [currentInstructionOffset, ensureRuntimeClient]);

  useEffect(() => {
    if (!isDebugVisible) {
      setHasRequestedDisassembly(false);
      return;
    }
    if (
      phase !== "running" ||
      disassembly ||
      isDisassembling ||
      hasRequestedDisassembly
    ) {
      return;
    }
    setHasRequestedDisassembly(true);
    handleDisassemble();
  }, [
    disassembly,
    handleDisassemble,
    hasRequestedDisassembly,
    isDebugVisible,
    isDisassembling,
    phase,
  ]);

  const handleBreak = useCallback(() => {
    if (isBreakMode) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    setIsStepping(false);
    void runtime
      .pause()
      .then(async () => {
        setIsBreakMode(true);
        const pc = await runtime.getProgramCounter();
        setCurrentInstructionOffset(pc ?? null);
        void refreshDebugInfo();
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [isBreakMode, refreshDebugInfo, setError]);

  const handleResume = useCallback(() => {
    if (!isBreakMode) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    setIsStepping(false);
    void runtime
      .start()
      .then(() => {
        setIsBreakMode(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [isBreakMode, setError]);

  const handleStepInstruction = useCallback(() => {
    if (!isBreakMode) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    setIsStepping(true);
    void runtime
      .stepInstruction()
      .then(async () => {
        const pc = await runtime.getProgramCounter();
        setCurrentInstructionOffset(pc ?? null);
        setShouldCenterDisassembly(true);
        void refreshDebugInfo();
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setIsStepping(false);
      });
  }, [isBreakMode, refreshDebugInfo, setError]);

  const handleToggleDebug = useCallback(() => {
    setIsDebugVisible((prev) => !prev);
  }, []);

  const handleOpenSaveManager = useCallback(() => {
    const adapter = ensureSaveStorage();
    if (!adapter) {
      setError("Save storage is unavailable in this browser.");
      return;
    }
    setIsSaveManagerOpen(true);
  }, [ensureSaveStorage]);

  const handleLoadSaveFromManager = useCallback(
    async (payload: SavePayload, slot: string) => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        throw new Error("No runtime is active to load a save.");
      }
      await runtime.pause();
      await runtime.reset();
      await runtime.loadSave(payload, { slot });
      syncRuntimeBreakpoints(breakpoints);
      const programCounter = await runtime.getProgramCounter();
      setCurrentInstructionOffset(programCounter ?? null);
      setIsBreakMode(false);
      setIsStepping(false);
      await runtime.start();
      setShouldCenterDisassembly(true);
      void refreshDebugInfo();
    },
    [breakpoints, refreshDebugInfo, syncRuntimeBreakpoints],
  );

  const handleStartWithoutSave = useCallback(
    async (slot: string) => {
      const storage = ensureSaveStorage();
      const runtime = runtimeRef.current;
      const rom = romDataRef.current;
      const title = romInfo?.title ?? null;
      if (!runtime || !rom || !storage || !title) {
        throw new Error("No ROM or save storage is available to start fresh.");
      }
      setError(null);
      await runtime.pause();
      await runtime.reset({ hard: true });
      await runtime.loadRom(rom, { skipPersistentLoad: true });
      const serialized = await storage.read(
        createSaveStorageKey(title, slot || undefined),
      );
      if (serialized) {
        const payload = deserializeSavePayload(serialized);
        await runtime.loadSave(payload, { slot });
      }
      const info = await runtime.getRomInfo();
      setRomInfo(info);
      const programCounter = await runtime.getProgramCounter();
      setCurrentInstructionOffset(programCounter ?? null);
      setIsBreakMode(false);
      setIsStepping(false);
      setShouldCenterDisassembly(false);
      syncRuntimeBreakpoints(breakpoints);
      await runtime.start();
      void refreshDebugInfo();
    },
    [
      breakpoints,
      ensureSaveStorage,
      refreshDebugInfo,
      romInfo,
      syncRuntimeBreakpoints,
    ],
  );

  const handleHardwareInputStateChange = useCallback(
    (state: JoypadInputState) => {
      applyInputState({ hardware: state });
    },
    [applyInputState],
  );

  const handleVirtualInputStateChange = useCallback(
    (state: JoypadInputState) => {
      applyInputState({ virtual: state });
    },
    [applyInputState],
  );

  useGamepad({
    enabled: phase === "running",
    onInputState: handleHardwareInputStateChange,
  });

  return (
    <div
      className={cn(
        "box-border flex w-full min-h-dvh flex-col gap-6 px-6 lg:flex-row lg:gap-6 lg:px-8 lg:py-10",
        isMobileViewport && phase === "running"
          ? "min-h-dvh gap-0 bg-card px-0 py-0"
          : undefined,
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".gb,.gbc,.bin,application/octet-stream"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <MenuCard hidden={phase !== "menu"} onSelectRom={openFilePicker} />

      <LoadingCard hidden={phase !== "loading"} romName={romName} />

      <DisplayCard
        hidden={phase !== "running"}
        canvasRef={canvasRef}
        romName={romName}
        isDebugVisible={isDebugVisible}
        onChangeRom={openFilePicker}
        onToggleDebug={handleToggleDebug}
        onManageSaves={handleOpenSaveManager}
        disableSaveManager={phase !== "running" || romInfo === null}
        isMobileViewport={isMobileViewport}
        canvasDimensions={{
          width: DEFAULT_CANVAS_WIDTH,
          height: DEFAULT_CANVAS_HEIGHT,
        }}
      />

      {phase === "running" && isMobileViewport ? (
        <VirtualJoypad onChange={handleVirtualInputStateChange} />
      ) : null}

      <RomDebugCard
        hidden={phase !== "running" || !isDebugVisible || isMobileViewport}
        romInfo={romInfo}
        disassembly={disassembly}
        disassemblyError={disassemblyError}
        isDisassembling={isDisassembling}
        breakpoints={breakpoints}
        onToggleBreakpoint={handleToggleBreakpoint}
        currentInstructionOffset={currentInstructionOffset}
        shouldCenterDisassembly={shouldCenterDisassembly}
        onCenterDisassembly={() => setShouldCenterDisassembly(false)}
        isBreakMode={isBreakMode}
        isStepping={isStepping}
        onBreak={handleBreak}
        onResume={handleResume}
        onStep={handleStepInstruction}
        memorySnapshot={memorySnapshot}
        cpuState={cpuState}
      />

      <VramViewerCard
        hidden={phase !== "running" || !isDebugVisible || isMobileViewport}
        memorySnapshot={memorySnapshot}
      />

      <ErrorCard
        hidden={phase !== "error"}
        error={error}
        onReturnToMenu={handleReturnToMenu}
      />

      <ManageSavesDialog
        open={isSaveManagerOpen}
        romTitle={romInfo?.title ?? null}
        saveStorage={saveStorageRef.current}
        onClose={() => setIsSaveManagerOpen(false)}
        onLoadSave={handleLoadSaveFromManager}
        onStartFresh={handleStartWithoutSave}
      />
    </div>
  );
}

export default App;
