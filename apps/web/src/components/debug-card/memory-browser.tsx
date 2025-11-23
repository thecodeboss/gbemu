import { useMemo, useState } from "react";

import { formatAddress, formatHexValue } from "@/components/debug-card/utils";

const MEMORY_VIEWPORT_HEIGHT = 320;
const MEMORY_ROW_HEIGHT = 28;
const MEMORY_OVERSCAN_ROWS = 16;

interface MemoryTableRow {
  offset: number;
  value: number;
  type: string;
}

interface MemoryBrowserProps {
  memorySnapshot: Uint8Array | null;
}

function getMemoryRegionName(address: number): string {
  if (address >= 0x0000 && address <= 0x3fff) {
    return "ROM0";
  }
  if (address >= 0x4000 && address <= 0x7fff) {
    return "ROM1";
  }
  if (address >= 0x8000 && address <= 0x9fff) {
    return "VRAM";
  }
  if (address >= 0xa000 && address <= 0xbfff) {
    return "SRAM";
  }
  if (address >= 0xc000 && address <= 0xcfff) {
    return "WRAM0";
  }
  if (address >= 0xd000 && address <= 0xdfff) {
    return "WRAM1";
  }
  if (address >= 0xe000 && address <= 0xfdff) {
    return "ECHO";
  }
  if (address >= 0xfe00 && address <= 0xfe9f) {
    return "OAM";
  }
  if (address >= 0xfea0 && address <= 0xfeff) {
    return "UNUSED";
  }
  if (address >= 0xff00 && address <= 0xff7f) {
    return "I/O";
  }
  if (address >= 0xff80 && address <= 0xfffe) {
    return "HRAM";
  }
  return "IE";
}

export function MemoryBrowser({ memorySnapshot }: MemoryBrowserProps) {
  const [memoryScrollTop, setMemoryScrollTop] = useState(0);

  const memoryTableMetrics = useMemo(() => {
    if (!memorySnapshot) {
      return {
        totalHeight: 0,
        translateY: 0,
        rows: [] as MemoryTableRow[],
      };
    }

    const totalRows = memorySnapshot.length;
    const viewportRows = Math.ceil(MEMORY_VIEWPORT_HEIGHT / MEMORY_ROW_HEIGHT);
    const startIndex = Math.max(
      0,
      Math.floor(memoryScrollTop / MEMORY_ROW_HEIGHT) - MEMORY_OVERSCAN_ROWS,
    );
    const endIndex = Math.min(
      totalRows,
      startIndex + viewportRows + MEMORY_OVERSCAN_ROWS * 2,
    );
    const rows: MemoryTableRow[] = [];
    for (let index = startIndex; index < endIndex; index += 1) {
      rows.push({
        offset: index,
        value: memorySnapshot[index] ?? 0,
        type: getMemoryRegionName(index),
      });
    }

    return {
      totalHeight: totalRows * MEMORY_ROW_HEIGHT,
      translateY: startIndex * MEMORY_ROW_HEIGHT,
      rows,
    };
  }, [memorySnapshot, memoryScrollTop]);

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-medium">Memory Browser</h3>
      {memorySnapshot && memorySnapshot.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-md border border-input">
            <div className="grid grid-cols-[minmax(72px,1fr)_minmax(96px,1fr)_minmax(96px,1fr)] gap-x-2 bg-muted/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <span>Type</span>
              <span>Offset</span>
              <span>Value</span>
            </div>
            <div
              className="overflow-y-auto"
              style={{ height: `${MEMORY_VIEWPORT_HEIGHT}px` }}
              onScroll={(event) =>
                setMemoryScrollTop(event.currentTarget.scrollTop)
              }
            >
              <div
                style={{ height: `${memoryTableMetrics.totalHeight}px` }}
                className="relative"
              >
                <div
                  className="absolute inset-x-0 top-0"
                  style={{
                    transform: `translateY(${memoryTableMetrics.translateY}px)`,
                  }}
                >
                  {memoryTableMetrics.rows.map((row) => (
                    <div
                      key={row.offset}
                      className="grid grid-cols-[minmax(72px,1fr)_minmax(96px,1fr)_minmax(96px,1fr)] items-center gap-x-2 border-b border-border/50 px-3 text-xs font-mono last:border-b-0"
                      style={{ height: `${MEMORY_ROW_HEIGHT}px` }}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {row.type}
                      </span>
                      <span>{formatAddress(row.offset)}</span>
                      <span>{formatHexValue(row.value, 2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Scroll to inspect memory regions. Rows are virtualized for smoother
            performance.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Memory snapshot unavailable.
        </p>
      )}
    </div>
  );
}
