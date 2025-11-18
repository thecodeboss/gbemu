import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CpuDebugSnapshot, RomInfo } from "@/types/runtime";
import { CpuState } from "@/components/debug-card/cpu-state";
import { Disassembly } from "@/components/debug-card/disassembly";
import { MemoryBrowser } from "@/components/debug-card/memory-browser";
import { RomInfo as RomInfoSection } from "@/components/debug-card/rom-info";

interface RomDebugCardProps {
  hidden: boolean;
  romInfo: RomInfo | null;
  disassembly: Record<number, string> | null;
  disassemblyError: string | null;
  isDisassembling: boolean;
  breakpoints: Set<number>;
  onToggleBreakpoint: (offset: number) => void;
  onDisassemble: () => void;
  currentInstructionOffset: number | null;
  shouldCenterDisassembly: boolean;
  onCenterDisassembly: () => void;
  isBreakMode: boolean;
  memorySnapshot: Uint8Array | null;
  cpuState: CpuDebugSnapshot | null;
}

export function RomDebugCard({
  hidden,
  romInfo,
  disassembly,
  disassemblyError,
  isDisassembling,
  breakpoints,
  onToggleBreakpoint,
  onDisassemble,
  currentInstructionOffset,
  shouldCenterDisassembly,
  onCenterDisassembly,
  isBreakMode,
  memorySnapshot,
  cpuState,
}: RomDebugCardProps) {
  return (
    <Card hidden={hidden}>
      <CardHeader>
        <CardTitle>ROM Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <RomInfoSection romInfo={romInfo} />

        <Disassembly
          hidden={hidden}
          disassembly={disassembly}
          disassemblyError={disassemblyError}
          isDisassembling={isDisassembling}
          breakpoints={breakpoints}
          onToggleBreakpoint={onToggleBreakpoint}
          onDisassemble={onDisassemble}
          currentInstructionOffset={currentInstructionOffset}
          shouldCenterDisassembly={shouldCenterDisassembly}
          onCenterDisassembly={onCenterDisassembly}
          isBreakMode={isBreakMode}
        />

        <CpuState cpuState={cpuState} />

        <MemoryBrowser memorySnapshot={memorySnapshot} />
      </CardContent>
    </Card>
  );
}
