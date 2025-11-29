import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

export interface CurrentRom {
  id: string;
  name: string;
  lastPlayed: number;
  data: Uint8Array;
}

interface CurrentRomContextValue {
  rom: CurrentRom | null;
  setCurrentRom: Dispatch<SetStateAction<CurrentRom | null>>;
}

const CurrentRomContext = createContext<CurrentRomContextValue | undefined>(
  undefined,
);

interface CurrentRomProviderProps {
  children: ReactNode;
}

export function CurrentRomProvider({ children }: CurrentRomProviderProps) {
  const [rom, setCurrentRom] = useState<CurrentRom | null>(null);
  const value = useMemo(() => ({ rom, setCurrentRom }), [rom]);

  return (
    <CurrentRomContext.Provider value={value}>
      {children}
    </CurrentRomContext.Provider>
  );
}

export function useCurrentRom(): CurrentRomContextValue {
  const context = useContext(CurrentRomContext);
  if (!context) {
    throw new Error("useCurrentRom must be used within a CurrentRomProvider");
  }
  return context;
}
