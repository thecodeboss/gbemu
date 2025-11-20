import { useEffect, useRef } from "react";

import { decodeTileImage, TILE_BYTES, TILE_SIZE } from "./tile-utils";

interface OamTabProps {
  memorySnapshot: Uint8Array | null;
}

const OAM_START = 0xfe00;
const OAM_ENTRY_SIZE = 4;
const OAM_ENTRY_COUNT = 40;
const OAM_TILE_SCALE = 4;
const OAM_TILE_DRAW_SIZE = TILE_SIZE * OAM_TILE_SCALE;
const SPRITE_TILE_BASE = 0x8000;

function formatHex(value: number) {
  return `${value.toString(16).padStart(2, "0").toUpperCase()}`;
}

export function OamTab({ memorySnapshot }: OamTabProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (!memorySnapshot) {
      return;
    }

    for (let index = 0; index < OAM_ENTRY_COUNT; index += 1) {
      const canvas = canvasRefs.current[index];
      if (!canvas) {
        continue;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        continue;
      }

      const oamOffset = OAM_START + index * OAM_ENTRY_SIZE;
      const tileIndex = memorySnapshot[oamOffset + 2] ?? 0;
      const tileOffset = SPRITE_TILE_BASE + tileIndex * TILE_BYTES;
      if (tileOffset + TILE_BYTES > memorySnapshot.length) {
        continue;
      }

      const imageData = decodeTileImage(
        memorySnapshot,
        tileOffset,
        OAM_TILE_SCALE,
      );

      canvas.width = OAM_TILE_DRAW_SIZE;
      canvas.height = OAM_TILE_DRAW_SIZE;
      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(imageData, 0, 0);
    }
  }, [memorySnapshot]);

  if (!memorySnapshot) {
    return (
      <p className="text-sm text-muted-foreground">
        OAM snapshot unavailable. Pause the ROM to capture sprite data.
      </p>
    );
  }

  return (
    <div className="grid w-full grid-cols-8 gap-px bg-slate-200 p-px">
      {Array.from({ length: OAM_ENTRY_COUNT }, (_, index) => {
        const oamOffset = OAM_START + index * OAM_ENTRY_SIZE;
        const byte0 = memorySnapshot[oamOffset] ?? 0;
        const byte1 = memorySnapshot[oamOffset + 1] ?? 0;
        const byte2 = memorySnapshot[oamOffset + 2] ?? 0;
        const byte3 = memorySnapshot[oamOffset + 3] ?? 0;

        return (
          <div
            key={index}
            className="flex flex-col items-center bg-background p-2"
          >
            <canvas
              ref={(node) => {
                canvasRefs.current[index] = node;
              }}
              className="h-8 w-8 border border-border/60 bg-slate-200 [image-rendering:pixelated]"
            />
            <div className="mt-1 grid grid-cols-2 gap-x-1 text-[10px] leading-3.5 text-muted-foreground">
              <span className="font-mono">{formatHex(byte0)}</span>
              <span className="font-mono">{formatHex(byte1)}</span>
              <span className="font-mono">{formatHex(byte2)}</span>
              <span className="font-mono">{formatHex(byte3)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
