import { useCurrentRom } from "@/hooks/use-current-rom";
import { useEmulator } from "@/hooks/use-emulator";
import { useAutopause } from "@/hooks/use-autopause";
import { Outlet } from "react-router";

function App() {
  const { rom } = useCurrentRom();
  const { runtime, isRomLoading } = useEmulator();
  const phase = !rom ? "menu" : isRomLoading ? "loading" : "running";
  useAutopause(phase, runtime);

  return <Outlet />;
}

export default App;
