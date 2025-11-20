import { useEffect, useRef } from "react";

import { decodeTileImage, TILE_BYTES, TILE_SIZE } from "./tile-utils";

interface TilesTabProps {
  memorySnapshot: Uint8Array | null;
}

const TILE_SCALE = 2;
const TILE_DRAW_SIZE = TILE_SIZE * TILE_SCALE;
const TILE_GAP = 1;
const SECTION_COLUMNS = 16;
const SECTION_ROWS = 8;
const SECTION_TILE_COUNT = SECTION_COLUMNS * SECTION_ROWS;
const GAP_COLOR = "#888888";

const SECTION_DEFINITIONS = [
  { start: 0x8000, label: "$8000-$87FF" },
  { start: 0x8800, label: "$8800-$8FFF" },
  { start: 0x9000, label: "$9000-$97FF" },
] as const;

function renderTileSection(
  canvas: HTMLCanvasElement,
  memorySnapshot: Uint8Array,
  startAddress: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const sectionWidth =
    SECTION_COLUMNS * TILE_DRAW_SIZE + (SECTION_COLUMNS - 1) * TILE_GAP;
  const sectionHeight =
    SECTION_ROWS * TILE_DRAW_SIZE + (SECTION_ROWS - 1) * TILE_GAP;

  canvas.width = sectionWidth;
  canvas.height = sectionHeight;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = GAP_COLOR;
  ctx.fillRect(0, 0, sectionWidth, sectionHeight);

  for (let tileIndex = 0; tileIndex < SECTION_TILE_COUNT; tileIndex += 1) {
    const tileOffset = startAddress + tileIndex * TILE_BYTES;
    if (tileOffset + TILE_BYTES > memorySnapshot.length) {
      break;
    }

    const imageData = decodeTileImage(
      memorySnapshot,
      tileOffset,
      TILE_SCALE,
    );
    const column = tileIndex % SECTION_COLUMNS;
    const row = Math.floor(tileIndex / SECTION_COLUMNS);
    const destX = column * (TILE_DRAW_SIZE + TILE_GAP);
    const destY = row * (TILE_DRAW_SIZE + TILE_GAP);

    ctx.putImageData(imageData, destX, destY);
  }
}

export function TilesTab({ memorySnapshot }: TilesTabProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (!memorySnapshot) {
      return;
    }

    SECTION_DEFINITIONS.forEach((section, index) => {
      const canvas = canvasRefs.current[index];
      if (!canvas) {
        return;
      }
      renderTileSection(canvas, memorySnapshot, section.start);
    });
  }, [memorySnapshot]);

  return memorySnapshot ? (
    <div className="flex flex-col">
      {SECTION_DEFINITIONS.map((section, index) => (
        <div key={section.start}>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Block {index + 1}</span>
            <span className="font-mono text-[11px]">{section.label}</span>
          </div>
          <canvas
            ref={(node) => {
              canvasRefs.current[index] = node;
            }}
            className="border border-border/60 bg-slate-200 [image-rendering:pixelated]"
          />
          {index < SECTION_DEFINITIONS.length - 1 ? (
            <div aria-hidden className="h-1 w-full bg-slate-300" />
          ) : null}
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      VRAM snapshot unavailable. Pause the ROM to capture tiles.
    </p>
  );
}
