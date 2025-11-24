import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CpuDebugSnapshot, RomInfo } from "@/types/runtime";
import { CpuState } from "@/components/debug-card/cpu-state";
import { Disassembly } from "@/components/debug-card/disassembly";
import { MemoryBrowser } from "@/components/debug-card/memory-browser";
import { RomInfoSection } from "@/components/debug-card/rom-info-section";

interface RomDebugCardProps {
  hidden: boolean;
  romInfo: RomInfo | null;
  disassembly: Record<number, string> | null;
  disassemblyError: string | null;
  isDisassembling: boolean;
  breakpoints: Set<number>;
  onToggleBreakpoint: (offset: number) => void;
  currentInstructionOffset: number | null;
  shouldCenterDisassembly: boolean;
  onCenterDisassembly: () => void;
  isBreakMode: boolean;
  isStepping: boolean;
  onBreak: () => void;
  onResume: () => void;
  onStep: () => void;
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
  currentInstructionOffset,
  shouldCenterDisassembly,
  onCenterDisassembly,
  isBreakMode,
  isStepping,
  onBreak,
  onResume,
  onStep,
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

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBreak}
            disabled={isBreakMode || isStepping}
          >
            Pause
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onResume}
            disabled={!isBreakMode || isStepping}
          >
            Resume
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onStep}
            disabled={!isBreakMode || isStepping}
          >
            {isStepping ? "Stepping..." : "Step"}
          </Button>
        </div>

        <Disassembly
          hidden={hidden}
          disassembly={disassembly}
          disassemblyError={disassemblyError}
          isDisassembling={isDisassembling}
          breakpoints={breakpoints}
          onToggleBreakpoint={onToggleBreakpoint}
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
