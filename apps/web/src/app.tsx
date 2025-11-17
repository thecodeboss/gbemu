import {
  ChangeEvent,
  UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  RuntimeClient,
  createRuntimeClient,
} from "@gbemu/runtime";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AppPhase = "menu" | "loading" | "running" | "error";

type CpuDebugSnapshot = Awaited<ReturnType<RuntimeClient["getCpuState"]>>;

interface MemoryTableRow {
  offset: number;
  value: number;
  type: string;
}

interface RegisterEntry {
  name: string;
  value: string;
}

const MEMORY_VIEWPORT_HEIGHT = 320;
const MEMORY_ROW_HEIGHT = 28;
const MEMORY_OVERSCAN_ROWS = 16;
const DISASSEMBLY_VIEWPORT_HEIGHT = 256;
const DISASSEMBLY_ROW_HEIGHT = 28;
const DISASSEMBLY_OVERSCAN_ROWS = 12;

function formatHexByte(value: number): string {
  const hex = value.toString(16).toUpperCase().padStart(2, "0");
  return `0x${hex} (${value})`;
}

function formatByteSize(size: number): string {
  if (!size) {
    return "0 B";
  }
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const rounded =
    value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]} (${size.toLocaleString()} bytes)`;
}

function formatAddress(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function formatHexValue(value: number, pad: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(pad, "0")}`;
}

function getMemoryRegionName(address: number): string {
  if (address >= 0x0000 && address <= 0x3fff) {
    return "ROM0";
  }
  if (address >= 0x4000 && address <= 0x7fff) {
    return "ROM1";
  }
  if (address >= 0x8000 && address <= 0x9fff) {
    return "VRAM";
  }
  if (address >= 0xa000 && address <= 0xbfff) {
    return "SRAM";
  }
  if (address >= 0xc000 && address <= 0xcfff) {
    return "WRAM0";
  }
  if (address >= 0xd000 && address <= 0xdfff) {
    return "WRAM1";
  }
  if (address >= 0xe000 && address <= 0xfdff) {
    return "ECHO";
  }
  if (address >= 0xfe00 && address <= 0xfe9f) {
    return "OAM";
  }
  if (address >= 0xfea0 && address <= 0xfeff) {
    return "UNUSED";
  }
  if (address >= 0xff00 && address <= 0xff7f) {
    return "I/O";
  }
  if (address >= 0xff80 && address <= 0xfffe) {
    return "HRAM";
  }
  return "IE";
}

function App() {
  const [phase, setPhase] = useState<AppPhase>("menu");
  const [romName, setRomName] = useState<string | null>(null);
  const [romInfo, setRomInfo] =
    useState<Awaited<ReturnType<RuntimeClient["getRomInfo"]>>>(null);
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
  const [memoryScrollTop, setMemoryScrollTop] = useState(0);
  const [disassemblyScrollTop, setDisassemblyScrollTop] = useState(0);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(() => new Set());
  const [shouldCenterDisassembly, setShouldCenterDisassembly] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const disassemblyScrollContainerRef = useRef<HTMLDivElement | null>(null);
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
      setMemoryScrollTop(0);
      setDisassemblyScrollTop(0);
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
      void runtime
        .setBreakpoints(offsets)
        .catch((err: unknown) => {
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
    if (phase !== "running") {
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
  }, [phase, refreshDebugInfo]);

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
      setDisassemblyScrollTop(0);
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
        setIsBreakMode(true);
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

  const handleMemoryScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setMemoryScrollTop(event.currentTarget.scrollTop);
  }, []);

  const handleDisassemblyScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      setDisassemblyScrollTop(event.currentTarget.scrollTop);
    },
    [],
  );

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
    setDisassemblyScrollTop(0);
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

  const disassemblyTableMetrics = useMemo(() => {
    if (!disassembly) {
      return {
        rows: [] as Array<{
          offset: number;
          instruction: string;
          isActive: boolean;
        }>,
        totalHeight: 0,
        translateY: 0,
        activeOffset: null as number | null,
        activeIndex: null as number | null,
        hasEntries: false,
      };
    }

    const allOffsets = Object.keys(disassembly)
      .map((key) => Number.parseInt(key, 10))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    if (allOffsets.length === 0) {
      return {
        rows: [] as Array<{
          offset: number;
          instruction: string;
          isActive: boolean;
        }>,
        totalHeight: 0,
        translateY: 0,
        activeOffset: null as number | null,
        activeIndex: null as number | null,
        hasEntries: false,
      };
    }

    const minAddress = allOffsets[0]!;
    const maxAddress = allOffsets[allOffsets.length - 1]!;
    let focus = currentInstructionOffset ?? minAddress;

    if (disassembly[focus] === undefined) {
      let cursor = focus;
      while (cursor >= minAddress && disassembly[cursor] === undefined) {
        cursor -= 1;
      }
      if (cursor >= minAddress && disassembly[cursor] !== undefined) {
        focus = cursor;
      } else {
        cursor = currentInstructionOffset ?? focus;
        while (cursor <= maxAddress && disassembly[cursor] === undefined) {
          cursor += 1;
        }
        if (cursor <= maxAddress && disassembly[cursor] !== undefined) {
          focus = cursor;
        } else {
          focus = minAddress;
        }
      }
    }

    const totalRows = allOffsets.length;
    const viewportRows = Math.ceil(
      DISASSEMBLY_VIEWPORT_HEIGHT / DISASSEMBLY_ROW_HEIGHT,
    );
    const startIndex = Math.max(
      0,
      Math.floor(disassemblyScrollTop / DISASSEMBLY_ROW_HEIGHT) -
        DISASSEMBLY_OVERSCAN_ROWS,
    );
    const endIndex = Math.min(
      totalRows,
      startIndex + viewportRows + DISASSEMBLY_OVERSCAN_ROWS * 2,
    );

    const rows: Array<{
      offset: number;
      instruction: string;
      isActive: boolean;
    }> = [];
    for (let index = startIndex; index < endIndex; index += 1) {
      const offset = allOffsets[index]!;
      rows.push({
        offset,
        instruction: disassembly[offset] ?? "",
        isActive: offset === focus,
      });
    }

    const activeIndex = allOffsets.indexOf(focus);

    return {
      rows,
      totalHeight: totalRows * DISASSEMBLY_ROW_HEIGHT,
      translateY: startIndex * DISASSEMBLY_ROW_HEIGHT,
      activeOffset: focus,
      activeIndex: activeIndex >= 0 ? activeIndex : null,
      hasEntries: totalRows > 0,
    };
  }, [currentInstructionOffset, disassembly, disassemblyScrollTop]);

  useEffect(() => {
    if (
      !shouldCenterDisassembly ||
      !isBreakMode ||
      phase !== "running" ||
      !disassembly ||
      disassemblyTableMetrics.activeIndex === null
    ) {
      return;
    }

    const container = disassemblyScrollContainerRef.current;
    if (!container) {
      return;
    }

    const rowTop = disassemblyTableMetrics.activeIndex * DISASSEMBLY_ROW_HEIGHT;
    const rowBottom = rowTop + DISASSEMBLY_ROW_HEIGHT;
    const viewportTop = disassemblyScrollTop;
    const viewportBottom = viewportTop + DISASSEMBLY_VIEWPORT_HEIGHT;

    if (rowTop >= viewportTop && rowBottom <= viewportBottom) {
      return;
    }

    const desiredScroll =
      rowTop - (DISASSEMBLY_VIEWPORT_HEIGHT - DISASSEMBLY_ROW_HEIGHT) / 2;
    const maxScroll = Math.max(
      0,
      disassemblyTableMetrics.totalHeight - DISASSEMBLY_VIEWPORT_HEIGHT,
    );
    const nextScroll = Math.max(0, Math.min(maxScroll, desiredScroll));
    container.scrollTop = nextScroll;
    setShouldCenterDisassembly(false);
  }, [
    disassembly,
    disassemblyScrollTop,
    disassemblyTableMetrics.activeIndex,
    disassemblyTableMetrics.totalHeight,
    shouldCenterDisassembly,
    isBreakMode,
    phase,
  ]);

  const memoryTableMetrics = useMemo(() => {
    if (!memorySnapshot) {
      return {
        totalHeight: 0,
        translateY: 0,
        rows: [] as MemoryTableRow[],
      };
    }

    const totalRows = memorySnapshot.length;
    const viewportRows = Math.ceil(MEMORY_VIEWPORT_HEIGHT / MEMORY_ROW_HEIGHT);
    const startIndex = Math.max(
      0,
      Math.floor(memoryScrollTop / MEMORY_ROW_HEIGHT) - MEMORY_OVERSCAN_ROWS,
    );
    const endIndex = Math.min(
      totalRows,
      startIndex + viewportRows + MEMORY_OVERSCAN_ROWS * 2,
    );
    const rows: MemoryTableRow[] = [];
    for (let index = startIndex; index < endIndex; index += 1) {
      rows.push({
        offset: index,
        value: memorySnapshot[index] ?? 0,
        type: getMemoryRegionName(index),
      });
    }

    return {
      totalHeight: totalRows * MEMORY_ROW_HEIGHT,
      translateY: startIndex * MEMORY_ROW_HEIGHT,
      rows,
    };
  }, [memorySnapshot, memoryScrollTop]);

  const cpuRegisterEntries = useMemo(() => {
    if (!cpuState) {
      return [];
    }
    const { registers } = cpuState;
    const registerList: RegisterEntry[] = [
      { name: "A", value: formatHexValue(registers.a, 2) },
      { name: "F", value: formatHexValue(registers.f, 2) },
      { name: "B", value: formatHexValue(registers.b, 2) },
      { name: "C", value: formatHexValue(registers.c, 2) },
      { name: "D", value: formatHexValue(registers.d, 2) },
      { name: "E", value: formatHexValue(registers.e, 2) },
      { name: "H", value: formatHexValue(registers.h, 2) },
      { name: "L", value: formatHexValue(registers.l, 2) },
      { name: "SP", value: formatAddress(registers.sp) },
      { name: "PC", value: formatAddress(registers.pc) },
    ];
    return registerList;
  }, [cpuState]);

  return (
    <div className="box-border flex w-full max-w-[720px] flex-col gap-6 px-6 py-10 sm:px-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".gb,.gbc,.bin,application/octet-stream"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <Card hidden={phase !== "menu"}>
        <CardHeader>
          <CardTitle>Game Boy Emulator</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p>
            Load a Game Boy or Game Boy Color ROM to boot the placeholder
            system.
          </p>
          <Button type="button" variant="default" onClick={openFilePicker}>
            Select ROM
          </Button>
        </CardContent>
      </Card>

      <Card hidden={phase !== "loading"}>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Preparing <span>{romName ?? "ROM"}</span>.
          </p>
        </CardContent>
      </Card>

      <Card hidden={phase !== "running"}>
        <CardHeader>
          <CardTitle>ROM: {romName ?? "Untitled"}</CardTitle>
        </CardHeader>
        <CardContent>
          <canvas
            ref={canvasRef}
            className="mx-auto block aspect-160/144 min-w-[480px] rounded-2xl border-2 border-white/10 bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.6)] [image-rendering:pixelated]"
            width={DEFAULT_CANVAS_WIDTH}
            height={DEFAULT_CANVAS_HEIGHT}
          />
        </CardContent>
        <CardFooter>
          <CardAction>
            {isBreakMode ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleStepInstruction}
                disabled={isStepping}
              >
                {isStepping ? "Stepping..." : "Step"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleBreak}
                disabled={isStepping}
              >
                Break
              </Button>
            )}
          </CardAction>
          {isBreakMode ? (
            <CardAction>
              <Button
                type="button"
                variant="secondary"
                onClick={handleResume}
                disabled={isStepping}
              >
                Resume
              </Button>
            </CardAction>
          ) : null}
          <CardAction>
            <Button type="button" variant="secondary" onClick={openFilePicker}>
              Change ROM
            </Button>
          </CardAction>
        </CardFooter>
      </Card>

      <Card hidden={phase !== "running"}>
        <CardHeader>
          <CardTitle>ROM Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          {romInfo ? (
            <>
              <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-muted-foreground">Title</dt>
                <dd>{romInfo.title}</dd>
                <dt className="font-medium text-muted-foreground">
                  Cartridge Type
                </dt>
                <dd>{formatHexByte(romInfo.cartridgeType)}</dd>
                <dt className="font-medium text-muted-foreground">ROM Size</dt>
                <dd>{formatByteSize(romInfo.romSize)}</dd>
                <dt className="font-medium text-muted-foreground">RAM Size</dt>
                <dd>{formatByteSize(romInfo.ramSize)}</dd>
                <dt className="font-medium text-muted-foreground">CGB Flag</dt>
                <dd>{formatHexByte(romInfo.cgbFlag)}</dd>
                <dt className="font-medium text-muted-foreground">SGB Flag</dt>
                <dd>{formatHexByte(romInfo.sgbFlag)}</dd>
                <dt className="font-medium text-muted-foreground">
                  Destination Code
                </dt>
                <dd>{formatHexByte(romInfo.destinationCode)}</dd>
              </dl>
              <div className="mt-6 flex flex-col gap-2">
                <h3 className="text-sm font-medium">Disassembly</h3>
                {disassembly !== null ? (
                  <>
                    <div className="overflow-hidden rounded-md border border-input">
                      <div className="grid grid-cols-[28px_max-content_1fr] items-center gap-x-4 bg-muted/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        <span className="text-center">BP</span>
                        <span>Offset</span>
                        <span>Instruction</span>
                      </div>
                      <div
                        ref={disassemblyScrollContainerRef}
                        className="overflow-y-auto"
                        style={{ height: `${DISASSEMBLY_VIEWPORT_HEIGHT}px` }}
                        onScroll={handleDisassemblyScroll}
                      >
                        {disassemblyTableMetrics.hasEntries ? (
                          <div
                            style={{
                              height: `${disassemblyTableMetrics.totalHeight}px`,
                            }}
                            className="relative"
                          >
                            <div
                              className="absolute inset-x-0 top-0"
                              style={{
                                transform: `translateY(${disassemblyTableMetrics.translateY}px)`,
                              }}
                            >
                              {disassemblyTableMetrics.rows.map((row) => {
                                const hasBreakpoint = breakpoints.has(row.offset);
                                const rowClasses = [
                                  "grid grid-cols-[28px_max-content_1fr] items-center gap-x-4 px-3 text-xs font-mono",
                                  row.isActive ? "bg-primary/10" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ");
                                const breakpointButtonClasses = [
                                  "flex h-6 w-6 items-center justify-center text-lg leading-none transition-opacity",
                                  hasBreakpoint ? "opacity-100" : "opacity-40 hover:opacity-70",
                                ]
                                  .filter(Boolean)
                                  .join(" ");
                                const offsetClasses = [
                                  "text-[11px]",
                                  row.isActive
                                    ? "font-semibold text-primary"
                                    : "text-muted-foreground",
                                ]
                                  .filter(Boolean)
                                  .join(" ");
                                const instructionClasses = [
                                  "whitespace-pre-wrap",
                                  row.isActive
                                    ? "font-semibold text-primary"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ");
                                return (
                                  <div
                                    key={row.offset}
                                    className={rowClasses}
                                    style={{
                                      height: `${DISASSEMBLY_ROW_HEIGHT}px`,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      aria-label={
                                        hasBreakpoint
                                          ? "Remove breakpoint"
                                          : "Add breakpoint"
                                      }
                                      title={
                                        hasBreakpoint
                                          ? "Remove breakpoint"
                                          : "Add breakpoint"
                                      }
                                      aria-pressed={hasBreakpoint}
                                      className={breakpointButtonClasses}
                                      onClick={() =>
                                        handleToggleBreakpoint(row.offset)
                                      }
                                    >
                                      {hasBreakpoint ? "🔴" : "⚪"}
                                    </button>
                                    <span className={offsetClasses}>
                                      {formatAddress(row.offset)}
                                    </span>
                                    <span className={instructionClasses}>
                                      {row.instruction}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="px-3 py-4 text-xs text-muted-foreground">
                            No disassembly available for this ROM.
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Scroll to browse the full disassembly. Rows are
                      virtualized for smoother performance. Click the BP
                      column to toggle breakpoints.
                    </p>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed border-input/60 bg-muted/30 px-3 py-4">
                    <p className="text-xs text-muted-foreground">
                      {isDisassembling
                        ? "Generating disassembly..."
                        : "Click the button below to generate a disassembly."}
                    </p>
                    {disassemblyError ? (
                      <p className="mt-2 text-xs text-destructive">
                        {disassemblyError}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDisassemble}
                        disabled={isDisassembling}
                      >
                        {isDisassembling
                          ? "Generating..."
                          : "Generate disassembly"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              ROM metadata unavailable.
            </p>
          )}

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium">CPU State</h3>
            {cpuState ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Registers
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
                    {cpuRegisterEntries.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2 py-1"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {entry.name}
                        </span>
                        <span>{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      IME
                    </p>
                    <p className="text-sm">
                      {cpuState.ime ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      Halted
                    </p>
                    <p className="text-sm">{cpuState.halted ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      Stopped
                    </p>
                    <p className="text-sm">{cpuState.stopped ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      Cycles
                    </p>
                    <p className="text-sm">
                      {cpuState.cycles.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Flags
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { label: "Z", active: cpuState.flags.zero },
                      { label: "N", active: cpuState.flags.subtract },
                      { label: "H", active: cpuState.flags.halfCarry },
                      { label: "C", active: cpuState.flags.carry },
                    ].map((flag) => (
                      <span
                        key={flag.label}
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          flag.active
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {flag.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                CPU state unavailable.
              </p>
            )}
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium">Memory Browser</h3>
            {memorySnapshot && memorySnapshot.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="overflow-hidden rounded-md border border-input">
                  <div className="grid grid-cols-[minmax(72px,1fr)_minmax(96px,1fr)_minmax(96px,1fr)] gap-x-2 bg-muted/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    <span>Type</span>
                    <span>Offset</span>
                    <span>Value</span>
                  </div>
                  <div
                    className="overflow-y-auto"
                    style={{ height: `${MEMORY_VIEWPORT_HEIGHT}px` }}
                    onScroll={handleMemoryScroll}
                  >
                    <div
                      style={{ height: `${memoryTableMetrics.totalHeight}px` }}
                      className="relative"
                    >
                      <div
                        className="absolute inset-x-0 top-0"
                        style={{
                          transform: `translateY(${memoryTableMetrics.translateY}px)`,
                        }}
                      >
                        {memoryTableMetrics.rows.map((row) => (
                          <div
                            key={row.offset}
                            className="grid grid-cols-[minmax(72px,1fr)_minmax(96px,1fr)_minmax(96px,1fr)] items-center gap-x-2 border-b border-border/50 px-3 text-xs font-mono last:border-b-0"
                            style={{ height: `${MEMORY_ROW_HEIGHT}px` }}
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {row.type}
                            </span>
                            <span>{formatAddress(row.offset)}</span>
                            <span>{formatHexValue(row.value, 2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Scroll to inspect memory regions. Rows are virtualized for
                  smoother performance.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Memory snapshot unavailable.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card hidden={phase !== "error"}>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            {error
              ? error
              : "The ROM could not be loaded. Please verify the file and try again."}
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button type="button" variant="default" onClick={handleReturnToMenu}>
            Back to menu
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default App;
