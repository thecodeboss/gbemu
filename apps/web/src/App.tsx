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
    <div className="app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".gb,.gbc,.bin,application/octet-stream"
        onChange={handleFileInputChange}
        className="file-input"
      />

      <section className="panel panel--menu" data-visible={phase === "menu"}>
        <h1 className="panel__title">Game Boy Emulator</h1>
        <p className="panel__description">
          Load a Game Boy or Game Boy Color ROM to boot the placeholder system.
        </p>
        <button type="button" className="button" onClick={openFilePicker}>
          Select ROM
        </button>
      </section>

      <section
        className="panel panel--status"
        data-visible={phase === "loading"}
      >
        <h2 className="panel__title">Loading…</h2>
        <p className="panel__description">
          Preparing <span className="panel__highlight">{romName ?? "ROM"}</span>
          .
        </p>
      </section>

      <section
        className="panel panel--player"
        data-visible={phase === "running"}
      >
        <header className="player__header">
          <div className="player__rom">
            <span className="player__label">ROM</span>
            <span className="player__value">{romName ?? "Untitled"}</span>
          </div>
          <button
            type="button"
            className="button button--subtle"
            onClick={openFilePicker}
          >
            Change ROM
          </button>
        </header>
        <canvas
          ref={canvasRef}
          className="player__screen"
          width={DEFAULT_CANVAS_WIDTH}
          height={DEFAULT_CANVAS_HEIGHT}
        />
      </section>

      <section className="panel panel--error" data-visible={phase === "error"}>
        <h2 className="panel__title">Something went wrong</h2>
        <p className="panel__description">
          {error
            ? error
            : "The ROM could not be loaded. Please verify the file and try again."}
        </p>
        <div className="panel__actions">
          <button type="button" className="button" onClick={handleReturnToMenu}>
            Back to menu
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
