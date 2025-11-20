import { DMG_PALETTE } from "@gbemu/core";

export const TILE_SIZE = 8;
export const TILE_BYTES = 16;

export function decodeTileImage(
  memorySnapshot: Uint8Array,
  offset: number,
  scale: number,
): ImageData {
  const drawSize = TILE_SIZE * scale;
  const pixels = new Uint8ClampedArray(drawSize * drawSize * 4);

  for (let row = 0; row < TILE_SIZE; row += 1) {
    const loByte = memorySnapshot[offset + row * 2] ?? 0;
    const hiByte = memorySnapshot[offset + row * 2 + 1] ?? 0;

    for (let col = 0; col < TILE_SIZE; col += 1) {
      const bitMask = 1 << (7 - col);
      const colorIndex =
        (hiByte & bitMask ? 2 : 0) | (loByte & bitMask ? 1 : 0);
      const color = DMG_PALETTE[colorIndex];

      const destX = col * scale;
      const destY = row * scale;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const pixelIndex = ((destY + y) * drawSize + (destX + x)) * 4;
          pixels[pixelIndex] = color[0];
          pixels[pixelIndex + 1] = color[1];
          pixels[pixelIndex + 2] = color[2];
          pixels[pixelIndex + 3] = color[3];
        }
      }
    }
  }

  return new ImageData(pixels, drawSize, drawSize);
}
