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

type AppPhase = "menu" | "loading" | "running" | "error";

function App() {
  const [phase, setPhase] = useState<AppPhase>("menu");
  const [romName, setRomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setRomName(file.name);
      setPhase("loading");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const rom = new Uint8Array(arrayBuffer);

        const runtime = await ensureRuntimeClient();
        await runtime.pause();
        await runtime.reset({ hard: true });
        await runtime.loadRom(rom);
        await runtime.start();

        setPhase("running");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    },
    [ensureRuntimeClient]
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
    setPhase("menu");
    setError(null);
    setRomName(null);
  }, []);

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
            <Button type="button" variant="secondary" onClick={openFilePicker}>
              Change ROM
            </Button>
          </CardAction>
        </CardFooter>
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
