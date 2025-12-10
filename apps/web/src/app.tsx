import { useCurrentRom } from "@/hooks/use-current-rom";
import { useEmulator } from "@/hooks/use-emulator";
import { useAutopause } from "@/hooks/use-autopause";
import { GameOptionsDialog } from "@/components/game-options-dialog";

function App({ children }: { children: React.ReactNode }) {
  const { rom } = useCurrentRom();
  const { runtime, isRomLoading } = useEmulator();
  const phase = !rom ? "menu" : isRomLoading ? "loading" : "running";
  useAutopause(phase, runtime);

  return (
    <>
      {children}
      <GameOptionsDialog />
    </>
  );
}

export default App;
