import { useEffect, useMemo, useRef, useState } from "react";

import { formatAddress } from "@/components/debug-card/utils";

const DISASSEMBLY_VIEWPORT_HEIGHT = 256;
const DISASSEMBLY_ROW_HEIGHT = 28;
const DISASSEMBLY_OVERSCAN_ROWS = 12;

interface DisassemblyProps {
  disassembly: Record<number, string> | null;
  currentInstructionOffset: number | null;
  breakpoints: Set<number>;
  onToggleBreakpoint: (offset: number) => void;
  isDisassembling: boolean;
  disassemblyError: string | null;
  shouldCenterDisassembly: boolean;
  onCenterDisassembly: () => void;
  isBreakMode: boolean;
  hidden: boolean;
}

export function Disassembly({
  disassembly,
  currentInstructionOffset,
  breakpoints,
  onToggleBreakpoint,
  isDisassembling,
  disassemblyError,
  shouldCenterDisassembly,
  onCenterDisassembly,
  isBreakMode,
  hidden,
}: DisassemblyProps) {
  const disassemblyScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [disassemblyScrollTop, setDisassemblyScrollTop] = useState(0);

  const disassemblyTableMetrics = useMemo(() => {
    if (!disassembly) {
      return {
        rows: [] as Array<{
          offset: number;
          instruction: string;
          isActive: boolean;
        }>,
        totalHeight: 0,
        translateY: 0,
        activeOffset: null as number | null,
        activeIndex: null as number | null,
        hasEntries: false,
      };
    }

    const allOffsets = Object.keys(disassembly)
      .map((key) => Number.parseInt(key, 10))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    if (allOffsets.length === 0) {
      return {
        rows: [] as Array<{
          offset: number;
          instruction: string;
          isActive: boolean;
        }>,
        totalHeight: 0,
        translateY: 0,
        activeOffset: null as number | null,
        activeIndex: null as number | null,
        hasEntries: false,
      };
    }

    const minAddress = allOffsets[0]!;
    const maxAddress = allOffsets[allOffsets.length - 1]!;
    let focus = currentInstructionOffset ?? minAddress;

    if (disassembly[focus] === undefined) {
      let cursor = focus;
      while (cursor >= minAddress && disassembly[cursor] === undefined) {
        cursor -= 1;
      }
      if (cursor >= minAddress && disassembly[cursor] !== undefined) {
        focus = cursor;
      } else {
        cursor = currentInstructionOffset ?? focus;
        while (cursor <= maxAddress && disassembly[cursor] === undefined) {
          cursor += 1;
        }
        if (cursor <= maxAddress && disassembly[cursor] !== undefined) {
          focus = cursor;
        } else {
          focus = minAddress;
        }
      }
    }

    const totalRows = allOffsets.length;
    const viewportRows = Math.ceil(
      DISASSEMBLY_VIEWPORT_HEIGHT / DISASSEMBLY_ROW_HEIGHT,
    );
    const startIndex = Math.max(
      0,
      Math.floor(disassemblyScrollTop / DISASSEMBLY_ROW_HEIGHT) -
        DISASSEMBLY_OVERSCAN_ROWS,
    );
    const endIndex = Math.min(
      totalRows,
      startIndex + viewportRows + DISASSEMBLY_OVERSCAN_ROWS * 2,
    );

    const rows: Array<{
      offset: number;
      instruction: string;
      isActive: boolean;
    }> = [];
    for (let index = startIndex; index < endIndex; index += 1) {
      const offset = allOffsets[index]!;
      rows.push({
        offset,
        instruction: disassembly[offset] ?? "",
        isActive: offset === focus,
      });
    }

    const activeIndex = allOffsets.indexOf(focus);

    return {
      rows,
      totalHeight: totalRows * DISASSEMBLY_ROW_HEIGHT,
      translateY: startIndex * DISASSEMBLY_ROW_HEIGHT,
      activeOffset: focus,
      activeIndex: activeIndex >= 0 ? activeIndex : null,
      hasEntries: totalRows > 0,
    };
  }, [currentInstructionOffset, disassembly, disassemblyScrollTop]);

  useEffect(() => {
    if (
      hidden ||
      !shouldCenterDisassembly ||
      !isBreakMode ||
      !disassembly ||
      disassemblyTableMetrics.activeIndex === null
    ) {
      return;
    }

    const container = disassemblyScrollContainerRef.current;
    if (!container) {
      return;
    }

    const rowTop = disassemblyTableMetrics.activeIndex * DISASSEMBLY_ROW_HEIGHT;
    const rowBottom = rowTop + DISASSEMBLY_ROW_HEIGHT;
    const viewportTop = disassemblyScrollTop;
    const viewportBottom = viewportTop + DISASSEMBLY_VIEWPORT_HEIGHT;

    if (rowTop >= viewportTop && rowBottom <= viewportBottom) {
      return;
    }

    const desiredScroll =
      rowTop - (DISASSEMBLY_VIEWPORT_HEIGHT - DISASSEMBLY_ROW_HEIGHT) / 2;
    const maxScroll = Math.max(
      0,
      disassemblyTableMetrics.totalHeight - DISASSEMBLY_VIEWPORT_HEIGHT,
    );
    const nextScroll = Math.max(0, Math.min(maxScroll, desiredScroll));
    container.scrollTop = nextScroll;
    onCenterDisassembly();
  }, [
    hidden,
    shouldCenterDisassembly,
    isBreakMode,
    disassembly,
    disassemblyTableMetrics.activeIndex,
    disassemblyTableMetrics.totalHeight,
    disassemblyScrollTop,
    onCenterDisassembly,
  ]);

  return (
    <div className="mt-6 flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide">
        Disassembly
      </h3>
      {disassembly !== null ? (
        <>
          <div className="overflow-hidden border-[3px] border-border bg-secondary shadow-[6px_6px_0_var(--color-accent)]">
            <div className="grid grid-cols-[28px_max-content_1fr] items-center gap-x-4 border-b-[3px] border-border bg-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span className="text-center">BP</span>
              <span>Offset</span>
              <span>Instruction</span>
            </div>
            <div
              ref={disassemblyScrollContainerRef}
              className="overflow-y-auto"
              style={{ height: `${DISASSEMBLY_VIEWPORT_HEIGHT}px` }}
              onScroll={(event) =>
                setDisassemblyScrollTop(event.currentTarget.scrollTop)
              }
            >
              {disassemblyTableMetrics.hasEntries ? (
                <div
                  style={{
                    height: `${disassemblyTableMetrics.totalHeight}px`,
                  }}
                  className="relative"
                >
                  <div
                    className="absolute inset-x-0 top-0"
                    style={{
                      transform: `translateY(${disassemblyTableMetrics.translateY}px)`,
                    }}
                  >
                    {disassemblyTableMetrics.rows.map((row) => {
                      const hasBreakpoint = breakpoints.has(row.offset);
                      const rowClasses = [
                        "grid grid-cols-[28px_max-content_1fr] items-center gap-x-4 border-b border-border/50 px-3 text-xs font-mono last:border-b-0",
                        row.isActive ? "bg-primary/10" : "bg-secondary",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const breakpointButtonClasses = [
                        "flex h-6 w-6 items-center justify-center text-lg leading-none transition-opacity",
                        hasBreakpoint
                          ? "opacity-100"
                          : "opacity-40 hover:opacity-70",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const offsetClasses = [
                        "text-[11px]",
                        row.isActive
                          ? "font-semibold text-primary"
                          : "text-muted-foreground",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const instructionClasses = [
                        "whitespace-pre-wrap",
                        row.isActive ? "font-semibold text-primary" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <div
                          key={row.offset}
                          className={rowClasses}
                          style={{
                            height: `${DISASSEMBLY_ROW_HEIGHT}px`,
                          }}
                        >
                          <button
                            type="button"
                            aria-label={
                              hasBreakpoint
                                ? "Remove breakpoint"
                                : "Add breakpoint"
                            }
                            title={
                              hasBreakpoint
                                ? "Remove breakpoint"
                                : "Add breakpoint"
                            }
                            aria-pressed={hasBreakpoint}
                            className={breakpointButtonClasses}
                            onClick={() => onToggleBreakpoint(row.offset)}
                          >
                            {hasBreakpoint ? "🔴" : "⚪"}
                          </button>
                          <span className={offsetClasses}>
                            {formatAddress(row.offset)}
                          </span>
                          <span className={instructionClasses}>
                            {row.instruction}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-4 text-xs text-muted-foreground">
                  No disassembly available for this ROM.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="border-[3px] border-dashed border-border bg-muted/40 px-3 py-4 shadow-[4px_4px_0_var(--color-accent)]">
          <p className="text-xs text-muted-foreground">
            {isDisassembling
              ? "Generating disassembly..."
              : "Opening the debug panel will automatically generate a disassembly for this ROM."}
          </p>
          {disassemblyError ? (
            <p className="mt-2 text-xs text-destructive">{disassemblyError}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
