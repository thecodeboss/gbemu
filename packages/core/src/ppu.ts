import { SystemBus } from "./bus.js";

export const DEFAULT_SCREEN_WIDTH = 160;
export const DEFAULT_SCREEN_HEIGHT = 144;

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

export class Ppu {
  #framebuffer: Framebuffer = {
    width: DEFAULT_SCREEN_WIDTH,
    height: DEFAULT_SCREEN_HEIGHT,
    data: new Uint8ClampedArray(
      DEFAULT_SCREEN_WIDTH * DEFAULT_SCREEN_HEIGHT * 4,
    ),
  };

  connectBus(_bus: SystemBus): void {
    // No-op for stub.
  }

  reset(): void {
    this.#framebuffer.data.fill(0);
  }

  tick(_cycles: number): void {
    // No timing logic in stub.
  }

  getFramebuffer(): Framebuffer {
    return this.#framebuffer;
  }

  getStatus(): PpuLcdStatus {
    return {
      mode: "vblank",
      ly: 0,
      lyc: 0,
      lcdEnabled: true,
    };
  }
}
