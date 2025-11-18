import { useMemo } from "react";

import type { CpuDebugSnapshot } from "@/types/runtime";
import { formatAddress, formatHexValue } from "@/components/debug-card/utils";

interface RegisterEntry {
  name: string;
  value: string;
}

interface CpuStateProps {
  cpuState: CpuDebugSnapshot | null;
}

export function CpuState({ cpuState }: CpuStateProps) {
  const cpuRegisterEntries = useMemo(() => {
    if (!cpuState) {
      return [];
    }
    const { registers } = cpuState;
    const registerList: RegisterEntry[] = [
      { name: "A", value: formatHexValue(registers.a, 2) },
      { name: "F", value: formatHexValue(registers.f, 2) },
      { name: "B", value: formatHexValue(registers.b, 2) },
      { name: "C", value: formatHexValue(registers.c, 2) },
      { name: "D", value: formatHexValue(registers.d, 2) },
      { name: "E", value: formatHexValue(registers.e, 2) },
      { name: "H", value: formatHexValue(registers.h, 2) },
      { name: "L", value: formatHexValue(registers.l, 2) },
      { name: "SP", value: formatAddress(registers.sp) },
      { name: "PC", value: formatAddress(registers.pc) },
    ];
    return registerList;
  }, [cpuState]);

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-medium">CPU State</h3>
      {cpuState ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Registers
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
              {cpuRegisterEntries.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2 py-1"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {entry.name}
                  </span>
                  <span>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs font-mono sm:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                IME
              </p>
              <p className="text-sm">{cpuState.ime ? "Enabled" : "Disabled"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Halted
              </p>
              <p className="text-sm">{cpuState.halted ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Stopped
              </p>
              <p className="text-sm">{cpuState.stopped ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Cycles
              </p>
              <p className="text-sm">{cpuState.cycles.toLocaleString()}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Flags
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "Z", active: cpuState.flags.zero },
                { label: "N", active: cpuState.flags.subtract },
                { label: "H", active: cpuState.flags.halfCarry },
                { label: "C", active: cpuState.flags.carry },
              ].map((flag) => (
                <span
                  key={flag.label}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    flag.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {flag.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">CPU state unavailable.</p>
      )}
    </div>
  );
}
