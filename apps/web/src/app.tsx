import {
  useIsMobileViewport,
  useViewportHeightVariable,
} from "@/hooks/viewport";
import { cn } from "@/lib/utils";
import { useCurrentRom } from "@/hooks/use-current-rom";
import { useEmulator } from "@/hooks/use-emulator";
import { useAutopause } from "@/hooks/use-autopause";
import { Outlet } from "react-router";

function App() {
  const { rom } = useCurrentRom();
  const isMobileViewport = useIsMobileViewport();
  useViewportHeightVariable();
  const { runtime, isRomLoading } = useEmulator();
  const phase = !rom ? "menu" : isRomLoading ? "loading" : "running";
  useAutopause(phase, runtime);

  const shouldCenterContent = phase === "menu" || phase === "loading";

  return (
    <div
      className={cn(
        "box-border flex w-full flex-col gap-6 px-6 lg:flex-row lg:gap-6 lg:px-8 lg:py-10",
        shouldCenterContent ? "items-center justify-center" : undefined,
        isMobileViewport && phase === "running"
          ? "gap-0 bg-card px-0 py-0"
          : undefined,
      )}
    >
      <Outlet />
    </div>
  );
}

export default App;
