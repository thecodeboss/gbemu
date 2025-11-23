import { InterruptType } from "./cpu.js";
import { SystemBus } from "./bus.js";
import { DMG_PALETTE } from "./palette.js";

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

type PpuMode = PpuLcdStatus["mode"];

const LCDC_ADDRESS = 0xff40;
const STAT_ADDRESS = 0xff41;
const SCY_ADDRESS = 0xff42;
const SCX_ADDRESS = 0xff43;
const LY_ADDRESS = 0xff44;
const LYC_ADDRESS = 0xff45;
const BGP_ADDRESS = 0xff47;
const OBP0_ADDRESS = 0xff48;
const OBP1_ADDRESS = 0xff49;
const WY_ADDRESS = 0xff4a;
const WX_ADDRESS = 0xff4b;

const DOTS_PER_CPU_CYCLE = 4;
const DOTS_PER_LINE = 456;
const TOTAL_SCANLINES = 154;
const VBLANK_START_LINE = 144;
const VBLANK_END_LINE = 153;

const MODE2_OAM_DOTS = 80;
const MODE3_XFER_DOTS = 172;

const STAT_COINCIDENCE_FLAG = 0x04;
const STAT_MODE_BITS_MASK = 0x03;
const STAT_HBLANK_INTERRUPT = 0x08;
const STAT_VBLANK_INTERRUPT = 0x10;
const STAT_OAM_INTERRUPT = 0x20;
const STAT_LYC_INTERRUPT = 0x40;

const LCDC_BG_ENABLE_FLAG = 0x01;
const LCDC_OBJ_ENABLE_FLAG = 0x02;
const LCDC_OBJ_SIZE_FLAG = 0x04;
const LCDC_BG_TILE_MAP_FLAG = 0x08;
const LCDC_TILE_DATA_FLAG = 0x10;
const LCDC_WINDOW_ENABLE_FLAG = 0x20;
const LCDC_WINDOW_TILE_MAP_FLAG = 0x40;
const LCDC_ENABLE_FLAG = 0x80;

const MAX_SPRITES_PER_LINE = 10;
const TILE_MAP_WIDTH = 32;
const TILE_HEIGHT = 8;
const TILE_STRIDE = 16;

export class Ppu {
  #framebuffer: Framebuffer = {
    width: DEFAULT_SCREEN_WIDTH,
    height: DEFAULT_SCREEN_HEIGHT,
    data: new Uint8ClampedArray(
      DEFAULT_SCREEN_WIDTH * DEFAULT_SCREEN_HEIGHT * 4,
    ),
  };
  #bus: SystemBus | null = null;
  #currentMode: PpuMode = "vblank";
  #lineDot = 0;
  #ly = 0;
  #lycCoincidence = false;
  #lcdActive = false;
  #frameReady = false;
  #bgLineColorIndices = new Uint8Array(DEFAULT_SCREEN_WIDTH);
  #windowLineCounter = 0;

  connectBus(bus: SystemBus): void {
    this.#bus = bus;
  }

  reset(): void {
    this.#framebuffer.data.fill(0);
    this.#lineDot = 0;
    this.#ly = 0;
    this.#lycCoincidence = false;
    this.#ensureLcdcEnabled();
    this.#setMode("oam");
    this.#writeLyRegister(0);
    this.#lcdActive = this.#isLcdEnabled();
    this.#frameReady = true;
    this.#windowLineCounter = 0;
    this.#bgLineColorIndices.fill(0);
  }

  tick(cycles: number): void {
    if (!this.#bus || cycles <= 0) {
      return;
    }

    this.#updateLyCompareFlag();

    if (!this.#isLcdEnabled()) {
      this.#resetWhenLcdDisabled();
      return;
    }

    if (!this.#lcdActive) {
      this.#onLcdEnabled();
    }

    let remainingDots = cycles * DOTS_PER_CPU_CYCLE;

    while (remainingDots > 0) {
      const dotsUntilTransition = this.#dotsUntilNextTransition();
      const step = Math.min(dotsUntilTransition, remainingDots);
      this.#lineDot += step;
      remainingDots -= step;

      if (this.#lineDot >= DOTS_PER_LINE) {
        this.#lineDot -= DOTS_PER_LINE;
        this.#handleLineComplete();
        continue;
      }

      if (step === dotsUntilTransition) {
        this.#advanceModeWithinLine();
      }
    }
  }

  getFramebuffer(): Framebuffer {
    return this.#framebuffer;
  }

  consumeFrame(): Framebuffer | null {
    if (!this.#frameReady) {
      return null;
    }
    this.#frameReady = false;
    return {
      width: this.#framebuffer.width,
      height: this.#framebuffer.height,
      data: new Uint8ClampedArray(this.#framebuffer.data),
    };
  }

  getStatus(): PpuLcdStatus {
    return {
      mode: this.#currentMode,
      ly: this.#ly,
      lyc: this.#bus?.readByte(LYC_ADDRESS) ?? 0,
      lcdEnabled: this.#isLcdEnabled(),
    };
  }

  #isLcdEnabled(): boolean {
    if (!this.#bus) {
      return false;
    }
    const lcdc = this.#bus.readByte(LCDC_ADDRESS);
    return (lcdc & LCDC_ENABLE_FLAG) !== 0;
  }

  #resetWhenLcdDisabled(): void {
    const wasActive = this.#lcdActive;
    this.#lineDot = 0;
    if (this.#ly !== 0) {
      this.#writeLyRegister(0);
    }
    this.#setMode("hblank");
    this.#lcdActive = false;
    if (wasActive) {
      this.#frameReady = true;
    }
    this.#windowLineCounter = 0;
  }

  #onLcdEnabled(): void {
    this.#lcdActive = true;
    this.#lineDot = 0;
    this.#writeLyRegister(0);
    this.#setMode("oam");
    this.#frameReady = false;
    this.#windowLineCounter = 0;
  }

  #ensureLcdcEnabled(): void {
    if (!this.#bus) {
      return;
    }
    const lcdc = this.#bus.readByte(LCDC_ADDRESS);
    if ((lcdc & LCDC_ENABLE_FLAG) === 0) {
      this.#bus.writeByte(LCDC_ADDRESS, lcdc | LCDC_ENABLE_FLAG);
    }
  }

  #dotsUntilNextTransition(): number {
    const modeEnd = (() => {
      switch (this.#currentMode) {
        case "oam":
          return MODE2_OAM_DOTS;
        case "xfer":
          return MODE2_OAM_DOTS + MODE3_XFER_DOTS;
        case "hblank":
        case "vblank":
        default:
          return DOTS_PER_LINE;
      }
    })();
    const remaining = modeEnd - this.#lineDot;
    return remaining > 0 ? remaining : 1;
  }

  #advanceModeWithinLine(): void {
    if (this.#currentMode === "oam") {
      this.#setMode("xfer");
    } else if (this.#currentMode === "xfer") {
      this.#renderScanline();
      this.#setMode("hblank");
    }
  }

  #handleLineComplete(): void {
    const nextLy = this.#ly + 1;
    if (nextLy >= TOTAL_SCANLINES) {
      this.#writeLyRegister(0);
      this.#setMode("oam");
      this.#frameReady = true;
      this.#windowLineCounter = 0;
      return;
    }

    this.#writeLyRegister(nextLy);

    if (this.#ly >= VBLANK_START_LINE && this.#ly <= VBLANK_END_LINE) {
      this.#setMode("vblank");
    } else {
      this.#setMode("oam");
    }
  }

  #renderScanline(): void {
    const bus = this.#bus;
    if (!bus) {
      return;
    }
    const ly = this.#ly;
    if (ly < 0 || ly >= DEFAULT_SCREEN_HEIGHT) {
      const wy = bus.readByte(WY_ADDRESS);
      if (ly < wy) {
        this.#windowLineCounter = 0;
      }
      return;
    }

    const lcdc = bus.readByte(LCDC_ADDRESS);
    const windowEnabled = (lcdc & LCDC_WINDOW_ENABLE_FLAG) !== 0;
    const wy = bus.readByte(WY_ADDRESS);
    const rawWx = bus.readByte(WX_ADDRESS);
    const wx = rawWx - 7;
    const windowVisible = windowEnabled && wy <= ly && rawWx <= 166;
    const windowLine = windowVisible ? this.#windowLineCounter & 0xff : 0;

    const bgPalette = this.#decodePalette(BGP_ADDRESS);
    this.#bgLineColorIndices.fill(0);

    if ((lcdc & LCDC_BG_ENABLE_FLAG) !== 0) {
      this.#renderBackgroundAndWindow({
        lcdc,
        scx: bus.readByte(SCX_ADDRESS),
        scy: bus.readByte(SCY_ADDRESS),
        wx,
        windowVisible,
        windowLine,
        bgPalette,
      });
    } else {
      this.#fillBgLineWithShade(bgPalette[0]);
    }

    if (windowVisible) {
      this.#windowLineCounter = Math.min(this.#windowLineCounter + 1, 0xff);
    } else if (ly < wy || !windowEnabled || rawWx > 166) {
      this.#windowLineCounter = 0;
    }

    if ((lcdc & LCDC_OBJ_ENABLE_FLAG) !== 0) {
      this.#renderSprites({
        lcdc,
        objPalette0: this.#decodePalette(OBP0_ADDRESS),
        objPalette1: this.#decodePalette(OBP1_ADDRESS),
      });
    }
  }

  #renderBackgroundAndWindow(params: {
    lcdc: number;
    scx: number;
    scy: number;
    wx: number;
    windowVisible: boolean;
    windowLine: number;
    bgPalette: [number, number, number, number];
  }): void {
    const { lcdc, scx, scy, wx, windowVisible, windowLine, bgPalette } = params;
    const bus = this.#bus;
    if (!bus) {
      return;
    }
    const ly = this.#ly;
    const width = this.#framebuffer.width;
    const baseOffset = ly * width * 4;
    const useTileData8000 = (lcdc & LCDC_TILE_DATA_FLAG) !== 0;
    const bgTileMapBase =
      (lcdc & LCDC_BG_TILE_MAP_FLAG) !== 0 ? 0x9c00 : 0x9800;
    const windowTileMapBase =
      (lcdc & LCDC_WINDOW_TILE_MAP_FLAG) !== 0 ? 0x9c00 : 0x9800;

    for (let x = 0; x < width; x += 1) {
      const useWindow = windowVisible && x >= wx;
      const sourceX = useWindow ? (x - wx) & 0xff : (scx + x) & 0xff;
      const sourceY = useWindow ? windowLine & 0xff : (scy + ly) & 0xff;
      const tileMapBase = useWindow ? windowTileMapBase : bgTileMapBase;
      const colorBits = this.#sampleTilePixel(
        tileMapBase,
        useTileData8000,
        sourceX,
        sourceY,
      );
      const shade = bgPalette[colorBits];
      const offset = baseOffset + x * 4;
      this.#bgLineColorIndices[x] = colorBits;
      this.#writePixel(offset, shade);
    }
  }

  #renderSprites(params: {
    lcdc: number;
    objPalette0: [number, number, number, number];
    objPalette1: [number, number, number, number];
  }): void {
    const { lcdc, objPalette0, objPalette1 } = params;
    const bus = this.#bus;
    if (!bus) {
      return;
    }
    const ly = this.#ly;
    if (ly < 0 || ly >= DEFAULT_SCREEN_HEIGHT) {
      return;
    }
    const spriteHeight = (lcdc & LCDC_OBJ_SIZE_FLAG) !== 0 ? 16 : 8;
    const width = this.#framebuffer.width;
    const baseOffset = ly * width * 4;
    let spritesRendered = 0;

    for (let index = 0; index < 40; index += 1) {
      const oamAddress = 0xfe00 + index * 4;
      const spriteY = bus.readByte(oamAddress) - 16;
      const spriteX = bus.readByte(oamAddress + 1) - 8;
      let tileIndex = bus.readByte(oamAddress + 2);
      const attributes = bus.readByte(oamAddress + 3);

      if (ly < spriteY || ly >= spriteY + spriteHeight) {
        continue;
      }

      if (spritesRendered >= MAX_SPRITES_PER_LINE) {
        break;
      }
      spritesRendered += 1;

      let line = ly - spriteY;
      const yFlip = (attributes & 0x40) !== 0;
      const xFlip = (attributes & 0x20) !== 0;
      const bgPriority = (attributes & 0x80) !== 0;
      if (yFlip) {
        line = spriteHeight - 1 - line;
      }

      if (spriteHeight === 16) {
        tileIndex &= 0xfe;
      }

      const tileOffset = Math.floor(line / TILE_HEIGHT);
      const tileLine = line % TILE_HEIGHT;
      const tileBase = 0x8000 + (tileIndex + tileOffset) * TILE_STRIDE;
      const rowAddress = tileBase + tileLine * 2;
      const low = bus.readByte(rowAddress);
      const high = bus.readByte(rowAddress + 1);
      const palette = (attributes & 0x10) !== 0 ? objPalette1 : objPalette0;

      for (let pixel = 0; pixel < 8; pixel += 1) {
        const targetX = spriteX + pixel;
        if (targetX < 0 || targetX >= width) {
          continue;
        }

        const bitIndex = xFlip ? pixel : 7 - pixel;
        const colorBits =
          (((high >> bitIndex) & 0x01) << 1) | ((low >> bitIndex) & 0x01);
        if (colorBits === 0) {
          continue;
        }
        if (bgPriority && this.#bgLineColorIndices[targetX] !== 0) {
          continue;
        }

        const shade = palette[colorBits];
        const offset = baseOffset + targetX * 4;
        this.#writePixel(offset, shade);
      }
    }
  }

  #sampleTilePixel(
    tileMapBase: number,
    useTileData8000: boolean,
    x: number,
    y: number,
  ): number {
    const bus = this.#bus;
    if (!bus) {
      return 0;
    }
    const tileColumn = (x >> 3) & (TILE_MAP_WIDTH - 1);
    const tileRow = (y >> 3) & (TILE_MAP_WIDTH - 1);
    const tileIndexAddress =
      tileMapBase + tileRow * TILE_MAP_WIDTH + tileColumn;
    let tileNumber = bus.readByte(tileIndexAddress);
    let tileAddress: number;
    if (useTileData8000) {
      tileAddress = 0x8000 + tileNumber * TILE_STRIDE;
    } else {
      tileNumber = (tileNumber << 24) >> 24;
      tileAddress = 0x9000 + tileNumber * TILE_STRIDE;
    }
    const line = y & 0x07;
    const base = tileAddress + line * 2;
    const low = bus.readByte(base);
    const high = bus.readByte(base + 1);
    const bitIndex = 7 - (x & 0x07);
    return (((high >> bitIndex) & 0x01) << 1) | ((low >> bitIndex) & 0x01);
  }

  #decodePalette(address: number): [number, number, number, number] {
    const bus = this.#bus;
    if (!bus) {
      return [0, 1, 2, 3];
    }
    const value = bus.readByte(address);
    const palette: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i += 1) {
      palette[i] = (value >> (i * 2)) & 0x03;
    }
    return palette;
  }

  #fillBgLineWithShade(shade: number): void {
    const width = this.#framebuffer.width;
    const baseOffset = this.#ly * width * 4;
    for (let x = 0; x < width; x += 1) {
      this.#bgLineColorIndices[x] = 0;
      this.#writePixel(baseOffset + x * 4, shade);
    }
  }

  #writePixel(offset: number, shade: number): void {
    const color = DMG_PALETTE[shade & 0x03];
    this.#framebuffer.data[offset] = color[0];
    this.#framebuffer.data[offset + 1] = color[1];
    this.#framebuffer.data[offset + 2] = color[2];
    this.#framebuffer.data[offset + 3] = color[3];
  }

  #writeLyRegister(value: number): void {
    this.#ly = value % TOTAL_SCANLINES;
    if (this.#bus) {
      this.#bus.writeByte(LY_ADDRESS, this.#ly);
    }
    this.#updateLyCompareFlag();
  }

  #setMode(nextMode: PpuMode): void {
    if (this.#currentMode === nextMode) {
      return;
    }
    this.#currentMode = nextMode;
    this.#writeStatModeBits();
    this.#handleModeInterrupts(nextMode);
  }

  #writeStatModeBits(): void {
    if (!this.#bus) {
      return;
    }
    const modeValue = this.#modeToBits(this.#currentMode);
    const stat = this.#bus.readByte(STAT_ADDRESS);
    const next = (stat & ~STAT_MODE_BITS_MASK) | modeValue;
    this.#bus.writeByte(STAT_ADDRESS, next);
  }

  #modeToBits(mode: PpuMode): number {
    switch (mode) {
      case "hblank":
        return 0;
      case "vblank":
        return 1;
      case "oam":
        return 2;
      case "xfer":
        return 3;
      default:
        return 0;
    }
  }

  #handleModeInterrupts(mode: PpuMode): void {
    if (!this.#bus) {
      return;
    }
    const stat = this.#bus.readByte(STAT_ADDRESS);
    switch (mode) {
      case "hblank":
        if ((stat & STAT_HBLANK_INTERRUPT) !== 0) {
          this.#requestInterrupt("lcdStat");
        }
        break;
      case "vblank":
        this.#requestInterrupt("vblank");
        if ((stat & STAT_VBLANK_INTERRUPT) !== 0) {
          this.#requestInterrupt("lcdStat");
        }
        break;
      case "oam":
        if ((stat & STAT_OAM_INTERRUPT) !== 0) {
          this.#requestInterrupt("lcdStat");
        }
        break;
      case "xfer":
        // Mode 3 does not trigger STAT interrupts.
        break;
      default:
        break;
    }
  }

  #requestInterrupt(type: InterruptType): void {
    this.#bus?.requestInterrupt(type);
  }

  #updateLyCompareFlag(): void {
    if (!this.#bus) {
      return;
    }
    const lyc = this.#bus.readByte(LYC_ADDRESS);
    const match = this.#ly === lyc;
    const stat = this.#bus.readByte(STAT_ADDRESS);
    const nextStat = match
      ? stat | STAT_COINCIDENCE_FLAG
      : stat & ~STAT_COINCIDENCE_FLAG;
    if (nextStat !== stat) {
      this.#bus.writeByte(STAT_ADDRESS, nextStat);
    }

    if (match && !this.#lycCoincidence && (stat & STAT_LYC_INTERRUPT) !== 0) {
      this.#requestInterrupt("lcdStat");
    }
    this.#lycCoincidence = match;
  }
}
