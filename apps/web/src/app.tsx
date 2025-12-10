import { Suspense } from "react";

import { useCurrentRom } from "@/hooks/use-current-rom";
import { useEmulator } from "@/hooks/use-emulator";
import { useAutopause } from "@/hooks/use-autopause";
import { GameOptionsDialogLazy } from "@/components/game-options-dialog.lazy";

function App({ children }: { children: React.ReactNode }) {
  const { rom } = useCurrentRom();
  const { runtime, isRomLoading } = useEmulator();
  const phase = !rom ? "menu" : isRomLoading ? "loading" : "running";
  useAutopause(phase, runtime);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <GameOptionsDialogLazy />
      </Suspense>
    </>
  );
}

export default App;
