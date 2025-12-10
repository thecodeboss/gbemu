import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useEmulator } from "@/hooks/use-emulator";

type GameOptionsContextValue = {
  speedMultiplier: number;
  setSpeedMultiplier: (multiplier: number) => void;
  isOptionsOpen: boolean;
  openOptions: () => void;
  closeOptions: () => void;
};

const GameOptionsContext = createContext<GameOptionsContextValue | undefined>(
  undefined,
);

export function GameOptionsProvider({ children }: { children: ReactNode }) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [speedMultiplier, setSpeedMultiplierState] = useState(1);
  const { runtime } = useEmulator();

  useEffect(() => {
    if (!runtime) {
      return;
    }
    void (async () => {
      try {
        await runtime.setSpeedMultiplier(speedMultiplier);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [runtime, speedMultiplier]);

  const setSpeedMultiplier = useCallback((multiplier: number) => {
    setSpeedMultiplierState(multiplier);
  }, []);

  const openOptions = useCallback(() => setIsOptionsOpen(true), []);
  const closeOptions = useCallback(() => setIsOptionsOpen(false), []);

  const value = useMemo(
    () => ({
      speedMultiplier,
      setSpeedMultiplier,
      isOptionsOpen,
      openOptions,
      closeOptions,
    }),
    [
      closeOptions,
      isOptionsOpen,
      openOptions,
      setSpeedMultiplier,
      speedMultiplier,
    ],
  );

  return (
    <GameOptionsContext.Provider value={value}>
      {children}
    </GameOptionsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameOptions(): GameOptionsContextValue {
  const context = useContext(GameOptionsContext);
  if (!context) {
    throw new Error("useGameOptions must be used within a GameOptionsProvider");
  }
  return context;
}
