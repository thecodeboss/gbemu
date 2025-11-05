import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  createRuntimeClient,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  type RuntimeClient,
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
import { Switch } from "@/components/ui/switch";

type AppPhase = "menu" | "loading" | "running" | "error";

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

function App() {
  const [phase, setPhase] = useState<AppPhase>("menu");
  const [romName, setRomName] = useState<string | null>(null);
  const [romInfo, setRomInfo] =
    useState<Awaited<ReturnType<RuntimeClient["getRomInfo"]>>>(null);
  const [error, setError] = useState<string | null>(null);
  const [disassembly, setDisassembly] = useState<string | null>(null);
  const [disassemblyError, setDisassemblyError] = useState<string | null>(null);
  const [isDisassembling, setIsDisassembling] = useState(false);
  const [stepModeEnabled, setStepModeEnabled] = useState(true);
  const [isStepping, setIsStepping] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
            import.meta.url
          ),
          { type: "module" }
        ),
      audioContext: await ensureAudioContext(),
      audioWorkletModuleUrl: new URL(
        "@gbemu/runtime/src/audio/worklet-processor.ts",
        import.meta.url
      ),
      canvas,
      autoPersistSaves: false,
    });

    runtimeRef.current = runtimeClient;
    return runtimeClient;
  }, [ensureAudioContext]);

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
      setPhase("loading");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const rom = new Uint8Array(arrayBuffer);

        const runtime = await ensureRuntimeClient();
        await runtime.pause();
        await runtime.reset({ hard: true });
        await runtime.loadRom(rom);
        const info = await runtime.getRomInfo();
        setRomInfo(info);
        if (!stepModeEnabled) {
          await runtime.start();
        }

        setPhase("running");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    },
    [ensureRuntimeClient, stepModeEnabled]
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.target.files ?? []);
      void handleRomSelection(file ?? null);
      event.target.value = "";
    },
    [handleRomSelection]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReturnToMenu = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime) {
      void runtime.pause();
      runtime.renderer.clear("#000000");
    }
    setDisassembly(null);
    setDisassemblyError(null);
    setIsDisassembling(false);
    setIsStepping(false);
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
      } catch (err) {
        console.error(err);
        setDisassemblyError(
          err instanceof Error ? err.message : "Failed to disassemble the ROM."
        );
      } finally {
        setIsDisassembling(false);
      }
    })();
  }, [ensureRuntimeClient]);

  const handleStepModeToggle = useCallback(
    (checked: boolean) => {
      setStepModeEnabled(checked);
      setIsStepping(false);
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      if (checked) {
        void runtime.pause().catch((err) => {
          console.error(err);
          setError(err instanceof Error ? err.message : String(err));
        });
      } else {
        void runtime.start().catch((err) => {
          console.error(err);
          setError(err instanceof Error ? err.message : String(err));
        });
      }
    },
    [setError]
  );

  const handleStepInstruction = useCallback(() => {
    if (!stepModeEnabled) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    setIsStepping(true);
    void runtime
      .stepInstruction()
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setIsStepping(false);
      });
  }, [setError, stepModeEnabled]);

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
          <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2">
            <label
              htmlFor="step-mode-toggle"
              className="flex flex-col gap-1 text-left"
            >
              <span className="text-sm font-medium">Step Mode</span>
              <span className="text-xs text-muted-foreground">
                Execute one CPU instruction at a time.
              </span>
            </label>
            <Switch
              id="step-mode-toggle"
              checked={stepModeEnabled}
              onCheckedChange={handleStepModeToggle}
            />
          </div>
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
          {stepModeEnabled ? (
            <CardAction>
              <Button
                type="button"
                variant="outline"
                onClick={handleStepInstruction}
                disabled={isStepping}
              >
                {isStepping ? "Stepping..." : "Step"}
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
              {disassembly !== null ? (
                <>
                  <h3 className="mt-6 mb-2 text-sm font-medium">Disassembly</h3>
                  <textarea
                    aria-label="ROM disassembly output"
                    className="h-64 w-full resize-y rounded-md border border-input bg-muted/40 p-3 font-mono text-xs leading-snug text-foreground"
                    readOnly
                    value={disassembly}
                  />
                </>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDisassemble}
                    disabled={isDisassembling}
                  >
                    {isDisassembling ? "Disassembling..." : "Disassemble"}
                  </Button>
                  {disassemblyError ? (
                    <p className="text-xs text-destructive">
                      {disassemblyError}
                    </p>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              ROM metadata unavailable.
            </p>
          )}
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
