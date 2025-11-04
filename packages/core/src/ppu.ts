import type { SystemBus } from "./bus.js";

export interface Framebuffer {
  width: number;
  height: number;
  /** RGBA8888 pixel buffer. */
  data: Uint8ClampedArray;
}

export interface PpuLcdStatus {
  mode: "hblank" | "vblank" | "oam" | "xfer";
  ly: number;
  lyc: number;
  lcdEnabled: boolean;
}

export interface Ppu {
  connectBus(bus: SystemBus): void;
  reset(): void;
  tick(cycles: number): void;
  getFramebuffer(): Framebuffer;
  getStatus(): PpuLcdStatus;
}
