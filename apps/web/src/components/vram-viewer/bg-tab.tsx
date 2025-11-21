import { useEffect, useRef } from "react";

import { DMG_PALETTE } from "@gbemu/core";

import { TILE_BYTES, TILE_SIZE } from "./tile-utils";

interface BgTabProps {
  memorySnapshot: Uint8Array | null;
}

const TILE_MAP_DIMENSION = 32;
const MAP_PIXEL_SIZE = TILE_MAP_DIMENSION * TILE_SIZE;
const TILE_GAP = 1;
const CANVAS_SIZE = MAP_PIXEL_SIZE + (TILE_MAP_DIMENSION - 1) * TILE_GAP;

const VIEWPORT_WIDTH = 160;
const VIEWPORT_HEIGHT = 144;
const BORDER_THICKNESS = 2;

const GRID_COLOR = "#888888";
const BORDER_COLOR = "#000000";

const LCDC_ADDRESS = 0xff40;
const SCY_ADDRESS = 0xff42;
const SCX_ADDRESS = 0xff43;
const BGP_ADDRESS = 0xff47;

const LCDC_BG_TILE_MAP_FLAG = 0x08;
const LCDC_TILE_DATA_FLAG = 0x10;

const BG_TILE_MAP0 = 0x9800;
const BG_TILE_MAP1 = 0x9c00;

type Palette = [number, number, number, number];

function decodePalette(registerValue: number): Palette {
  const palette: Palette = [0, 0, 0, 0];
  for (let index = 0; index < 4; index += 1) {
    palette[index] = (registerValue >> (index * 2)) & 0x03;
  }
  return palette;
}

function decodeTileImageWithPalette(
  memorySnapshot: Uint8Array,
  offset: number,
  palette: Palette,
): ImageData {
  const pixels = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);

  for (let row = 0; row < TILE_SIZE; row += 1) {
    const loByte = memorySnapshot[offset + row * 2] ?? 0;
    const hiByte = memorySnapshot[offset + row * 2 + 1] ?? 0;

    for (let col = 0; col < TILE_SIZE; col += 1) {
      const bitMask = 1 << (7 - col);
      const colorIndex =
        (hiByte & bitMask ? 2 : 0) | (loByte & bitMask ? 1 : 0);
      const shade = palette[colorIndex];
      const color = DMG_PALETTE[shade];
      const pixelIndex = (row * TILE_SIZE + col) * 4;
      pixels[pixelIndex] = color[0];
      pixels[pixelIndex + 1] = color[1];
      pixels[pixelIndex + 2] = color[2];
      pixels[pixelIndex + 3] = color[3];
    }
  }

  return new ImageData(pixels, TILE_SIZE, TILE_SIZE);
}

interface RangeSegment {
  start: number;
  length: number;
}

function splitRange(start: number, length: number): RangeSegment[] {
  if (length <= 0) {
    return [];
  }
  const normalizedStart =
    ((start % MAP_PIXEL_SIZE) + MAP_PIXEL_SIZE) % MAP_PIXEL_SIZE;
  const end = normalizedStart + length;
  if (end <= MAP_PIXEL_SIZE) {
    return [{ start: normalizedStart, length }];
  }
  return [
    { start: normalizedStart, length: MAP_PIXEL_SIZE - normalizedStart },
    { start: 0, length: end - MAP_PIXEL_SIZE },
  ];
}

function mapCoordToCanvas(value: number): number {
  const normalized =
    ((value % MAP_PIXEL_SIZE) + MAP_PIXEL_SIZE) % MAP_PIXEL_SIZE;
  const tile = Math.floor(normalized / TILE_SIZE);
  const offset = normalized % TILE_SIZE;
  return tile * (TILE_SIZE + TILE_GAP) + offset;
}

function measureCanvasSpan(start: number, length: number): number {
  const end = start + length - 1;
  return mapCoordToCanvas(end) - mapCoordToCanvas(start) + 1;
}

function drawWrappedRect(
  ctx: CanvasRenderingContext2D,
  xStart: number,
  xLength: number,
  yStart: number,
  yLength: number,
): void {
  const xSegments = splitRange(xStart, xLength);
  const ySegments = splitRange(yStart, yLength);

  for (const x of xSegments) {
    const destX = mapCoordToCanvas(x.start);
    const drawWidth = measureCanvasSpan(x.start, x.length);
    for (const y of ySegments) {
      const destY = mapCoordToCanvas(y.start);
      const drawHeight = measureCanvasSpan(y.start, y.length);
      ctx.fillRect(destX, destY, drawWidth, drawHeight);
    }
  }
}

export function BgTab({ memorySnapshot }: BgTabProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = GRID_COLOR;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (!memorySnapshot) {
      return;
    }

    const lcdc = memorySnapshot[LCDC_ADDRESS] ?? 0;
    const useTileData8000 = (lcdc & LCDC_TILE_DATA_FLAG) !== 0;
    const tileMapBase =
      (lcdc & LCDC_BG_TILE_MAP_FLAG) !== 0 ? BG_TILE_MAP1 : BG_TILE_MAP0;
    const bgPalette = decodePalette(memorySnapshot[BGP_ADDRESS] ?? 0);

    for (let row = 0; row < TILE_MAP_DIMENSION; row += 1) {
      for (let col = 0; col < TILE_MAP_DIMENSION; col += 1) {
        const tileIndexAddress = tileMapBase + row * TILE_MAP_DIMENSION + col;
        const tileIndex = memorySnapshot[tileIndexAddress] ?? 0;

        let tileAddress: number;
        if (useTileData8000) {
          tileAddress = 0x8000 + tileIndex * TILE_BYTES;
        } else {
          const signedIndex = (tileIndex << 24) >> 24;
          tileAddress = 0x9000 + signedIndex * TILE_BYTES;
        }

        if (
          tileAddress < 0 ||
          tileAddress + TILE_BYTES > memorySnapshot.length
        ) {
          continue;
        }

        const imageData = decodeTileImageWithPalette(
          memorySnapshot,
          tileAddress,
          bgPalette,
        );
        const destX = col * (TILE_SIZE + TILE_GAP);
        const destY = row * (TILE_SIZE + TILE_GAP);
        ctx.putImageData(imageData, destX, destY);
      }
    }

    const scx = memorySnapshot[SCX_ADDRESS] ?? 0;
    const scy = memorySnapshot[SCY_ADDRESS] ?? 0;
    ctx.fillStyle = BORDER_COLOR;

    drawWrappedRect(ctx, scx, VIEWPORT_WIDTH, scy, BORDER_THICKNESS);
    drawWrappedRect(
      ctx,
      scx,
      VIEWPORT_WIDTH,
      (scy + VIEWPORT_HEIGHT - BORDER_THICKNESS) % MAP_PIXEL_SIZE,
      BORDER_THICKNESS,
    );
    drawWrappedRect(ctx, scx, BORDER_THICKNESS, scy, VIEWPORT_HEIGHT);
    drawWrappedRect(
      ctx,
      (scx + VIEWPORT_WIDTH - BORDER_THICKNESS) % MAP_PIXEL_SIZE,
      BORDER_THICKNESS,
      scy,
      VIEWPORT_HEIGHT,
    );
  }, [memorySnapshot]);

  return memorySnapshot ? (
    <canvas
      ref={canvasRef}
      className="size-[289px] border border-border/60 bg-slate-200 [image-rendering:pixelated]"
    />
  ) : (
    <p className="text-sm text-muted-foreground">
      VRAM snapshot unavailable. Pause the ROM to capture the background map.
    </p>
  );
}
