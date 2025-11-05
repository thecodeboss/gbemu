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

const panelClassName =
  "flex flex-col gap-6 rounded-[1.25rem] border border-white/5 bg-[rgba(17,21,33,0.9)] p-8 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-[18px] max-sm:px-5 max-sm:py-7";
const headingClassName =
  "m-0 text-[1.75rem] font-bold tracking-[-0.01em] max-sm:text-[1.45rem]";
const descriptionClassName =
  "m-0 text-base leading-relaxed text-slate-100/80";
const highlightClassName = "font-semibold text-sky-400";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-transparent bg-[linear-gradient(135deg,#5468ff,#8892ff)] px-7 py-3 text-base font-semibold tracking-[0.01em] text-white transition duration-150 ease-out hover:-translate-y-px hover:shadow-[0_12px_30px_rgba(84,104,255,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:brightness-95 active:shadow-none max-sm:w-full";
const subtleButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-transparent bg-white/10 px-5 py-2.5 text-base font-semibold tracking-[0.01em] text-white/90 transition duration-150 ease-out hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:brightness-95 max-sm:w-full";
const actionsClassName = "flex justify-center";
const headerClassName =
  "flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch";
const romInfoClassName = "flex flex-col gap-1 text-left";
const romLabelClassName =
  "text-xs uppercase tracking-[0.18em] text-white/60";
const romValueClassName =
  "text-base font-semibold text-white/95 [word-break:break-word]";
const screenClassName =
  "mx-auto block aspect-[160/144] w-full max-w-[480px] rounded-2xl border-2 border-white/10 bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.6)] [image-rendering:pixelated]";

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

      <section className={panelClassName} hidden={phase !== "menu"}>
        <h1 className={headingClassName}>Game Boy Emulator</h1>
        <p className={descriptionClassName}>
          Load a Game Boy or Game Boy Color ROM to boot the placeholder system.
        </p>
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={openFilePicker}
        >
          Select ROM
        </button>
      </section>

      <section className={panelClassName} hidden={phase !== "loading"}>
        <h2 className={headingClassName}>Loading…</h2>
        <p className={descriptionClassName}>
          Preparing <span className={highlightClassName}>{romName ?? "ROM"}</span>
          .
        </p>
      </section>

      <section className={panelClassName} hidden={phase !== "running"}>
        <header className={headerClassName}>
          <div className={romInfoClassName}>
            <span className={romLabelClassName}>ROM</span>
            <span className={romValueClassName}>{romName ?? "Untitled"}</span>
          </div>
          <button
            type="button"
            className={subtleButtonClassName}
            onClick={openFilePicker}
          >
            Change ROM
          </button>
        </header>
        <canvas
          ref={canvasRef}
          className={screenClassName}
          width={DEFAULT_CANVAS_WIDTH}
          height={DEFAULT_CANVAS_HEIGHT}
        />
      </section>

      <section className={panelClassName} hidden={phase !== "error"}>
        <h2 className={headingClassName}>Something went wrong</h2>
        <p className={descriptionClassName}>
          {error
            ? error
            : "The ROM could not be loaded. Please verify the file and try again."}
        </p>
        <div className={actionsClassName}>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={handleReturnToMenu}
          >
            Back to menu
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
