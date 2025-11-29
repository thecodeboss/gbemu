import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from "@gbemu/runtime";
import { JoypadInputState } from "@gbemu/core";
import { DisplayCard } from "@/components/display-card";
import { LoadingCard } from "@/components/loading-card";
import { MenuCard } from "@/components/menu-card";
import { useGamepad } from "@/hooks/use-gamepad";
import {
  useIsMobileViewport,
  useViewportHeightVariable,
} from "@/hooks/viewport";
import { ManageSavesDialog } from "@/components/manage-saves/manage-saves-dialog";
import { cn } from "@/lib/utils";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { useEmulator } from "@/hooks/use-emulator";
import { useAutopause } from "@/hooks/use-autopause";

function App() {
  const { rom } = useCurrentRom();
  const isMobileViewport = useIsMobileViewport();
  useViewportHeightVariable();
  const { runtime, isRomLoading } = useEmulator();
  const phase = !rom ? "menu" : isRomLoading ? "loading" : "running";
  const { virtualGamepad } = useGamepad({
    enableVirtual: phase === "running" && isMobileViewport,
    onChange: (state: JoypadInputState) => {
      if (!runtime) {
        return;
      }
      return runtime.setInputState(state);
    },
  });
  useAutopause(phase, runtime);

  const shouldCenterContent = phase === "menu" || phase === "loading";
  const viewportFillStyle = {
    minHeight: "var(--app-viewport-height, 100vh)",
  } as const;

  return (
    <div
      className={cn(
        "box-border flex w-full flex-col gap-6 px-6 lg:flex-row lg:gap-6 lg:px-8 lg:py-10",
        shouldCenterContent ? "items-center justify-center" : undefined,
        isMobileViewport && phase === "running"
          ? "gap-0 bg-card px-0 py-0"
          : undefined,
      )}
      style={viewportFillStyle}
    >
      <MenuCard hidden={phase !== "menu"} />

      <LoadingCard hidden={phase !== "loading"} romName={rom?.name ?? null} />

      <DisplayCard
        hidden={phase !== "running"}
        romName={rom?.name ?? null}
        disableSaveManager={phase !== "running" || !rom?.name}
        isMobileViewport={isMobileViewport}
        canvasDimensions={{
          width: DEFAULT_CANVAS_WIDTH,
          height: DEFAULT_CANVAS_HEIGHT,
        }}
      />

      {virtualGamepad}

      <ManageSavesDialog />
    </div>
  );
}

export default App;
