import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  RuntimeClient,
  createRuntimeClient,
} from "@gbemu/runtime";
import { DisplayCard } from "@/components/display-card";
import { ErrorCard } from "@/components/error-card";
import { LoadingCard } from "@/components/loading-card";
import { MenuCard } from "@/components/menu-card";
import { RomDebugCard } from "@/components/debug-card";
import { TileViewerCard } from "@/components/tile-viewer";
import type { CpuDebugSnapshot, RomInfo } from "@/types/runtime";

type AppPhase = "menu" | "loading" | "running" | "error";

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
  const [isDebugVisible, setIsDebugVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasDisassembly = disassembly !== null;

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

  useEffect(() => {
    if (!hasDisassembly || !memorySnapshot) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    let cancelled = false;
    void runtime
      .disassembleRom()
      .then((result: Record<number, string> | null) => {
        if (cancelled) {
          return;
        }
        if (result == null) {
          setDisassembly(null);
          setDisassemblyError("Disassembly is unavailable for this ROM.");
          return;
        }
        setDisassemblyError(null);
        setDisassembly(result);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        console.error(err);
      });
    return () => {
      cancelled = true;
    };
  }, [hasDisassembly, memorySnapshot]);

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
      audioWorkletModuleUrl: new URL(
        "@gbemu/runtime/src/audio/worklet-processor.ts",
        import.meta.url,
      ),
      canvas,
      autoPersistSaves: false,
      onBreakpointHit: (offset: number) => {
        setIsBreakMode(true);
        setIsStepping(false);
        setCurrentInstructionOffset(offset);
        setShouldCenterDisassembly(true);
        void refreshDebugInfo();
      },
    });

    runtimeRef.current = runtimeClient;
    return runtimeClient;
  }, [ensureAudioContext, refreshDebugInfo]);

  useEffect(() => {
    if (phase !== "running" || !isDebugVisible) {
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
  }, [isDebugVisible, phase, refreshDebugInfo]);

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
      setCurrentInstructionOffset(null);
      setIsBreakMode(false);
      setIsStepping(false);
      setBreakpoints(new Set());
      setShouldCenterDisassembly(false);
      setPhase("loading");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const rom = new Uint8Array(arrayBuffer);

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
    }
    setDisassembly(null);
    setDisassemblyError(null);
    setIsDisassembling(false);
    setIsStepping(false);
    setIsBreakMode(false);
    setCurrentInstructionOffset(null);
    setBreakpoints(new Set());
    setShouldCenterDisassembly(false);
    setPhase("menu");
    setError(null);
    setRomName(null);
    setRomInfo(null);
  }, []);

  const handleDisassemble = useCallback(() => {
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

  return (
    <div className="box-border flex w-full gap-6 px-6 py-10 sm:px-8">
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
        isBreakMode={isBreakMode}
        isStepping={isStepping}
        isDebugVisible={isDebugVisible}
        onBreak={handleBreak}
        onResume={handleResume}
        onStep={handleStepInstruction}
        onChangeRom={openFilePicker}
        onToggleDebug={handleToggleDebug}
        canvasDimensions={{
          width: DEFAULT_CANVAS_WIDTH,
          height: DEFAULT_CANVAS_HEIGHT,
        }}
      />

      <RomDebugCard
        hidden={phase !== "running" || !isDebugVisible}
        romInfo={romInfo}
        disassembly={disassembly}
        disassemblyError={disassemblyError}
        isDisassembling={isDisassembling}
        breakpoints={breakpoints}
        onToggleBreakpoint={handleToggleBreakpoint}
        onDisassemble={handleDisassemble}
        currentInstructionOffset={currentInstructionOffset}
        shouldCenterDisassembly={shouldCenterDisassembly}
        onCenterDisassembly={() => setShouldCenterDisassembly(false)}
        isBreakMode={isBreakMode}
        memorySnapshot={memorySnapshot}
        cpuState={cpuState}
      />

      <TileViewerCard
        hidden={phase !== "running" || !isDebugVisible}
        memorySnapshot={memorySnapshot}
      />

      <ErrorCard
        hidden={phase !== "error"}
        error={error}
        onReturnToMenu={handleReturnToMenu}
      />
    </div>
  );
}

export default App;
