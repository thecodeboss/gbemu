import { InterruptType } from "./cpu-instructions/constants.js";
import { SystemBus } from "./bus.js";
import { DMG_PALETTE } from "./palette.js";

type HardwareMode = "dmg" | "cgb";

type SpriteEntry = {
  oamIndex: number;
  rawX: number;
  x: number;
  y: number;
  tileIndex: number;
  attributes: number;
};

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
  #bus: SystemBus;
  #currentMode: PpuMode = "vblank";
  #lineDot = 0;
  #ly = 0;
  #lycCoincidence = false;
  #lcdActive = false;
  #frameReady = false;
  #bgLineColorIndices = new Uint8Array(DEFAULT_SCREEN_WIDTH);
  #windowLineCounter = 0;
  #xferX = 0;
  #windowLineForScanline = 0;
  #mode3DurationDots = MODE3_XFER_DOTS;
  #modeEndDot = MODE2_OAM_DOTS;
  #hardwareMode: HardwareMode = "dmg";
  #cgbMode = false;
  #dotsPerCpuCycle = DOTS_PER_CPU_CYCLE;
  #bgPriorityFlags = new Uint8Array(DEFAULT_SCREEN_WIDTH);
  #spriteBuffer: SpriteEntry[] = [];
  #spriteBufferLy = -1;
  #spriteBufferHeight = 8;
  #lineBgEnabled = false;
  #lineCompatCgb = false;
  #lineBgMasterEnabled = false;
  #lineWindowEnabled = false;
  #lineUseTileData8000 = false;
  #lineBgTileMapBase = 0x9800;
  #lineWindowTileMapBase = 0x9800;
  #lineWy = 0;
  #lineWx = 0;
  #lineWindowVisible = false;
  #lineBgPalette: [number, number, number, number] = [0, 0, 0, 0];
  #lineScx = 0;
  #lineScy = 0;
  #tileRowCacheNumber = -1;
  #tileRowCacheY = -1;
  #tileRowCacheBank = -1;
  #tileRowCacheUseTileData8000 = false;
  #tileRowCacheIsWindow = false;
  #tileRowCacheLow = 0;
  #tileRowCacheHigh = 0;

  constructor(bus: SystemBus) {
    this.#bus = bus;
  }

  setSystemMode(
    hardwareMode: HardwareMode,
    cgbMode: boolean,
    dotsPerCpuCycle?: number,
  ): void {
    this.#hardwareMode = hardwareMode;
    this.#cgbMode = cgbMode;
    this.#dotsPerCpuCycle = dotsPerCpuCycle ?? DOTS_PER_CPU_CYCLE;
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
    this.#xferX = 0;
    this.#windowLineForScanline = 0;
    this.#bgLineColorIndices.fill(0);
    this.#bgPriorityFlags.fill(0);
  }

  tick(cycles: number): void {
    if (cycles <= 0) {
      return;
    }

    this.#dotsPerCpuCycle = this.#bus.getTicksPerCpuCycle();
    this.#updateLyCompareFlag();

    if (!this.#isLcdEnabled()) {
      this.#resetWhenLcdDisabled();
      return;
    }

    if (!this.#lcdActive) {
      this.#onLcdEnabled();
    }

    let remainingDots = cycles * this.#dotsPerCpuCycle;

    while (remainingDots > 0) {
      const dotsUntilTransition = this.#dotsUntilNextTransition();
      const step = Math.min(dotsUntilTransition, remainingDots);
      if (this.#currentMode === "xfer") {
        this.#renderXferDots(step);
      }
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
      lyc: this.#bus.readByte(LYC_ADDRESS),
      lcdEnabled: this.#isLcdEnabled(),
    };
  }

  #isLcdEnabled(): boolean {
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
    this.#xferX = 0;
    this.#windowLineForScanline = 0;
    this.#mode3DurationDots = MODE3_XFER_DOTS;
    this.#modeEndDot = MODE2_OAM_DOTS;
    this.#bgPriorityFlags.fill(0);
  }

  #onLcdEnabled(): void {
    this.#lcdActive = true;
    this.#lineDot = 0;
    this.#writeLyRegister(0);
    this.#setMode("oam");
    this.#frameReady = false;
    this.#windowLineCounter = 0;
    this.#xferX = 0;
    this.#windowLineForScanline = 0;
    this.#mode3DurationDots = MODE3_XFER_DOTS;
    this.#modeEndDot = MODE2_OAM_DOTS;
    this.#bgPriorityFlags.fill(0);
  }

  #ensureLcdcEnabled(): void {
    const lcdc = this.#bus.readByte(LCDC_ADDRESS);
    if ((lcdc & LCDC_ENABLE_FLAG) === 0) {
      this.#bus.writeByte(LCDC_ADDRESS, lcdc | LCDC_ENABLE_FLAG);
    }
  }

  #dotsUntilNextTransition(): number {
    const remaining = this.#modeEndDot - this.#lineDot;
    return remaining > 0 ? remaining : 1;
  }

  #advanceModeWithinLine(): void {
    if (this.#currentMode === "oam") {
      this.#mode3DurationDots =
        MODE3_XFER_DOTS + this.#computeSpritePenaltyDots();
      this.#modeEndDot = MODE2_OAM_DOTS + this.#mode3DurationDots;
      this.#startXferLine();
      this.#setMode("xfer");
    } else if (this.#currentMode === "xfer") {
      this.#finalizeScanline();
      this.#modeEndDot = DOTS_PER_LINE;
      this.#setMode("hblank");
    }
  }

  #handleLineComplete(): void {
    const nextLy = this.#ly + 1;
    if (nextLy >= TOTAL_SCANLINES) {
      this.#writeLyRegister(0);
      this.#modeEndDot = MODE2_OAM_DOTS;
      this.#setMode("oam");
      this.#frameReady = true;
      this.#windowLineCounter = 0;
      return;
    }

    this.#writeLyRegister(nextLy);

    if (this.#ly >= VBLANK_START_LINE && this.#ly <= VBLANK_END_LINE) {
      this.#modeEndDot = DOTS_PER_LINE;
      this.#setMode("vblank");
    } else {
      this.#modeEndDot = MODE2_OAM_DOTS;
      this.#setMode("oam");
    }
  }

  #startXferLine(): void {
    this.#xferX = 0;
    this.#windowLineForScanline = this.#windowLineCounter & 0xff;
    this.#bgLineColorIndices.fill(0);
    this.#bgPriorityFlags.fill(0);
    this.#spriteBufferLy = -1;
    this.#tileRowCacheNumber = -1;
    this.#tileRowCacheY = -1;
    this.#tileRowCacheBank = -1;
    this.#tileRowCacheUseTileData8000 = false;
    this.#tileRowCacheIsWindow = false;
    this.#refreshLineParams();
  }

  #renderXferDots(dots: number): void {
    if (dots <= 0) {
      return;
    }
    const ly = this.#ly;
    if (ly < 0 || ly >= DEFAULT_SCREEN_HEIGHT) {
      if (ly < this.#lineWy) {
        this.#windowLineCounter = 0;
      }
      return;
    }

    const bgMasterEnabled = this.#lineBgMasterEnabled;
    const compatCgb = this.#lineCompatCgb;
    const windowVisible = this.#lineWindowVisible;
    const useTileData8000 = this.#lineUseTileData8000;
    const bgTileMapBase = this.#lineBgTileMapBase;
    const windowTileMapBase = this.#lineWindowTileMapBase;
    const wx = this.#lineWx - 7;
    const windowLine = windowVisible ? this.#windowLineForScanline & 0xff : 0;
    const bgPalette = this.#lineBgPalette;
    const scx = this.#lineScx;
    const scy = this.#lineScy;

    const width = this.#framebuffer.width;
    const baseOffset = ly * width * 4;
    let cachedTileLow = 0;
    let cachedTileHigh = 0;

    for (let i = 0; i < dots; i += 1) {
      const x = this.#xferX;
      this.#xferX = (this.#xferX + 1) & 0xffff;
      if (x >= width) {
        continue;
      }

      if (!bgMasterEnabled) {
        this.#bgLineColorIndices[x] = 0;
        this.#bgPriorityFlags[x] = 0;
        this.#writePixel(baseOffset + x * 4, DMG_PALETTE[bgPalette[0]]);
        continue;
      }

      const useWindow = windowVisible && x >= wx;
      const sourceX = useWindow ? (x - wx) & 0xff : (scx + x) & 0xff;
      const sourceY = useWindow ? windowLine : (scy + ly) & 0xff;
      const tileMapBase = useWindow ? windowTileMapBase : bgTileMapBase;
      const tileColumn = (sourceX >> 3) & (TILE_MAP_WIDTH - 1);
      const tileRow = (sourceY >> 3) & (TILE_MAP_WIDTH - 1);
      const tileIndexAddress =
        tileMapBase + tileRow * TILE_MAP_WIDTH + tileColumn;
      const tileNumber = this.#bus.readVram(tileIndexAddress, 0);
      const attrs = this.#cgbMode ? this.#bus.readVram(tileIndexAddress, 1) : 0;
      const paletteIndex = this.#cgbMode ? attrs & 0x07 : 0;
      const tileBank = this.#cgbMode ? (attrs & 0x08) >> 3 : 0;
      const xFlip = this.#cgbMode && (attrs & 0x20) !== 0;
      const yFlip = this.#cgbMode && (attrs & 0x40) !== 0;
      const bgPriority = this.#cgbMode && (attrs & 0x80) !== 0;
      const tileX = xFlip ? 7 - (sourceX & 0x07) : sourceX & 0x07;
      const tileY = yFlip ? 7 - (sourceY & 0x07) : sourceY & 0x07;
      const isWindow = useWindow;
      if (
        tileNumber !== this.#tileRowCacheNumber ||
        tileY !== this.#tileRowCacheY ||
        tileBank !== this.#tileRowCacheBank ||
        useTileData8000 !== this.#tileRowCacheUseTileData8000 ||
        isWindow !== this.#tileRowCacheIsWindow
      ) {
        let tileAddress: number;
        if (useTileData8000) {
          tileAddress = 0x8000 + tileNumber * TILE_STRIDE;
        } else {
          const signedTileNumber = (tileNumber << 24) >> 24;
          tileAddress = 0x9000 + signedTileNumber * TILE_STRIDE;
        }
        const base = tileAddress + tileY * 2;
        cachedTileLow = this.#bus.readVram(base, tileBank);
        cachedTileHigh = this.#bus.readVram(base + 1, tileBank);
        this.#tileRowCacheNumber = tileNumber;
        this.#tileRowCacheY = tileY;
        this.#tileRowCacheBank = tileBank;
        this.#tileRowCacheUseTileData8000 = useTileData8000;
        this.#tileRowCacheIsWindow = isWindow;
        this.#tileRowCacheLow = cachedTileLow;
        this.#tileRowCacheHigh = cachedTileHigh;
      } else {
        cachedTileLow = this.#tileRowCacheLow;
        cachedTileHigh = this.#tileRowCacheHigh;
      }
      const bitIndex = 7 - (tileX & 0x07);
      const colorBits =
        (((cachedTileHigh >> bitIndex) & 0x01) << 1) |
        ((cachedTileLow >> bitIndex) & 0x01);
      const offset = baseOffset + x * 4;
      this.#bgLineColorIndices[x] = colorBits;
      this.#bgPriorityFlags[x] = bgPriority ? 1 : 0;
      if (this.#cgbMode) {
        const color = this.#bus.getBgPaletteColor(paletteIndex, colorBits);
        this.#writePixel(offset, color);
      } else if (compatCgb) {
        const shade = bgPalette[colorBits];
        const color = this.#bus.getBgPaletteColor(0, shade);
        this.#writePixel(offset, color);
      } else {
        const shade = bgPalette[colorBits];
        this.#writePixel(offset, DMG_PALETTE[shade]);
      }
    }
  }

  #finalizeScanline(): void {
    const bus = this.#bus;
    const lcdc = bus.readByte(LCDC_ADDRESS);

    if (
      this.#ly >= 0 &&
      this.#ly < DEFAULT_SCREEN_HEIGHT &&
      (lcdc & LCDC_OBJ_ENABLE_FLAG) !== 0
    ) {
      this.#renderSprites({
        lcdc,
        objPalette0: this.#cgbMode
          ? undefined
          : this.#decodePalette(OBP0_ADDRESS),
        objPalette1: this.#cgbMode
          ? undefined
          : this.#decodePalette(OBP1_ADDRESS),
      });
    }

    this.#updateWindowLineCounter(lcdc);
  }

  #computeSpritePenaltyDots(): number {
    const lcdc = this.#bus.readByte(LCDC_ADDRESS);
    const sprites = this.#getSpritesForLine(lcdc);
    const spriteHeight = this.#spriteBufferHeight;
    let penalty = 0;
    let spritesOnLine = 0;

    for (
      let i = 0;
      i < sprites.length && spritesOnLine < MAX_SPRITES_PER_LINE;
      i += 1
    ) {
      const sprite = sprites[i];
      if (sprite.rawX >= 168) {
        continue;
      }
      if (this.#ly < sprite.y || this.#ly >= sprite.y + spriteHeight) {
        continue;
      }
      spritesOnLine += 1;
      if (spritesOnLine === 1) {
        const alignmentBonus = sprite.rawX % 8 < 4 ? 2 : 0;
        penalty += 6 + alignmentBonus;
      } else {
        penalty += 6;
      }
    }

    return penalty;
  }

  #updateWindowLineCounter(lcdc: number): void {
    const wy = this.#bus.readByte(WY_ADDRESS);
    const rawWx = this.#bus.readByte(WX_ADDRESS);
    const windowEnabled = (lcdc & LCDC_WINDOW_ENABLE_FLAG) !== 0;
    const windowVisible = windowEnabled && wy <= this.#ly && rawWx <= 166;
    if (windowVisible) {
      this.#windowLineCounter = Math.min(this.#windowLineCounter + 1, 0xff);
    } else if (this.#ly < wy || !windowEnabled || rawWx > 166) {
      this.#windowLineCounter = 0;
    }
  }

  #getSpritesForLine(lcdc: number): SpriteEntry[] {
    const spriteHeight = (lcdc & LCDC_OBJ_SIZE_FLAG) !== 0 ? 16 : 8;
    if (
      this.#spriteBufferLy === this.#ly &&
      this.#spriteBufferHeight === spriteHeight
    ) {
      return this.#spriteBuffer;
    }

    const sprites: SpriteEntry[] = [];
    for (let index = 0; index < 40; index += 1) {
      const oamAddress = 0xfe00 + index * 4;
      const spriteY = this.#bus.readByte(oamAddress) - 16;
      const spriteXRaw = this.#bus.readByte(oamAddress + 1);
      const spriteX = spriteXRaw - 8;
      const tileIndex = this.#bus.readByte(oamAddress + 2);
      const attributes = this.#bus.readByte(oamAddress + 3);

      sprites.push({
        oamIndex: index,
        rawX: spriteXRaw,
        x: spriteX,
        y: spriteY,
        tileIndex,
        attributes,
      });
    }

    this.#spriteBuffer = sprites;
    this.#spriteBufferLy = this.#ly;
    this.#spriteBufferHeight = spriteHeight;
    return this.#spriteBuffer;
  }

  #refreshLineParams(): void {
    const lcdc = this.#bus.readByte(LCDC_ADDRESS);
    this.#lineBgEnabled = (lcdc & LCDC_BG_ENABLE_FLAG) !== 0;
    this.#lineCompatCgb = this.#hardwareMode === "cgb" && !this.#cgbMode;
    this.#lineBgMasterEnabled =
      this.#cgbMode || this.#lineCompatCgb ? true : this.#lineBgEnabled;
    this.#lineWindowEnabled = (lcdc & LCDC_WINDOW_ENABLE_FLAG) !== 0;
    this.#lineUseTileData8000 = (lcdc & LCDC_TILE_DATA_FLAG) !== 0;
    this.#lineBgTileMapBase =
      (lcdc & LCDC_BG_TILE_MAP_FLAG) !== 0 ? 0x9c00 : 0x9800;
    this.#lineWindowTileMapBase =
      (lcdc & LCDC_WINDOW_TILE_MAP_FLAG) !== 0 ? 0x9c00 : 0x9800;
    this.#lineWy = this.#bus.readByte(WY_ADDRESS);
    this.#lineWx = this.#bus.readByte(WX_ADDRESS);
    this.#lineWindowVisible =
      this.#lineWindowEnabled &&
      this.#lineWy <= this.#ly &&
      this.#lineWx <= 166;
    this.#lineBgPalette = this.#decodePalette(BGP_ADDRESS);
    this.#lineScx = this.#bus.readByte(SCX_ADDRESS);
    this.#lineScy = this.#bus.readByte(SCY_ADDRESS);
  }

  #renderSprites(params: {
    lcdc: number;
    objPalette0?: [number, number, number, number];
    objPalette1?: [number, number, number, number];
  }): void {
    const { lcdc, objPalette0, objPalette1 } = params;
    const ly = this.#ly;
    if (ly < 0 || ly >= DEFAULT_SCREEN_HEIGHT) {
      return;
    }

    const compatCgb = this.#hardwareMode === "cgb" && !this.#cgbMode;
    const spriteHeight = (lcdc & LCDC_OBJ_SIZE_FLAG) !== 0 ? 16 : 8;
    const width = this.#framebuffer.width;
    const baseOffset = ly * width * 4;
    const sprites = this.#getSpritesForLine(lcdc);

    const renderOrder = this.#cgbMode
      ? sprites
      : [...sprites].sort((a, b) => {
          if (a.x === b.x) {
            return a.oamIndex - b.oamIndex;
          }
          return a.x - b.x;
        });

    let rendered = 0;
    for (const sprite of renderOrder) {
      if (sprite.rawX >= 168) {
        continue;
      }
      if (ly < sprite.y || ly >= sprite.y + spriteHeight) {
        continue;
      }
      rendered += 1;
      if (rendered > MAX_SPRITES_PER_LINE) {
        break;
      }
      let { tileIndex } = sprite;
      const { attributes } = sprite;
      let line = ly - sprite.y;
      const yFlip = (attributes & 0x40) !== 0;
      const xFlip = (attributes & 0x20) !== 0;
      const bgPriority = (attributes & 0x80) !== 0;
      const tileBank = this.#cgbMode ? (attributes & 0x08) >> 3 : 0;
      const paletteIndex = this.#cgbMode
        ? attributes & 0x07
        : (attributes & 0x10) !== 0
          ? 1
          : 0;

      if (yFlip) {
        line = spriteHeight - 1 - line;
      }

      if (spriteHeight === 16) {
        tileIndex &= 0xfe;
      }

      const tileOffset = Math.floor(line / TILE_HEIGHT);
      const tileLine = line % TILE_HEIGHT;
      const activeTile = tileIndex + tileOffset;

      for (let pixel = 0; pixel < 8; pixel += 1) {
        const targetX = sprite.x + pixel;
        if (targetX < 0 || targetX >= width) {
          continue;
        }

        const tileX = xFlip ? 7 - pixel : pixel;
        const colorBits = this.#sampleTilePixel(
          activeTile,
          true,
          tileX,
          tileLine,
          tileBank,
        );
        if (colorBits === 0) {
          continue;
        }

        const bgColor = this.#bgLineColorIndices[targetX] ?? 0;
        const bgPriorityFlag = this.#bgPriorityFlags[targetX] !== 0;
        const masterBgPriority = (lcdc & LCDC_BG_ENABLE_FLAG) !== 0;

        if (!this.#cgbMode) {
          if (bgPriority && bgColor !== 0) {
            continue;
          }
        } else {
          if (
            bgColor !== 0 &&
            masterBgPriority &&
            (bgPriorityFlag || bgPriority)
          ) {
            continue;
          }
        }

        const offset = baseOffset + targetX * 4;
        if (this.#cgbMode) {
          const color = this.#bus.getObjPaletteColor(paletteIndex, colorBits);
          this.#writePixel(offset, color);
        } else if (compatCgb) {
          const shadePalette = paletteIndex === 1 ? objPalette1 : objPalette0;
          const shade = shadePalette?.[colorBits] ?? 0;
          const color = this.#bus.getObjPaletteColor(paletteIndex, shade);
          this.#writePixel(offset, color);
        } else {
          const palette = paletteIndex === 1 ? objPalette1 : objPalette0;
          const shade = palette?.[colorBits] ?? 0;
          this.#writePixel(offset, DMG_PALETTE[shade]);
        }
      }
    }
  }

  #sampleTilePixel(
    tileNumber: number,
    useTileData8000: boolean,
    x: number,
    y: number,
    vramBank: number,
  ): number {
    const bus = this.#bus;
    let tileAddress: number;
    if (useTileData8000) {
      tileAddress = 0x8000 + tileNumber * TILE_STRIDE;
    } else {
      const signedTileNumber = (tileNumber << 24) >> 24;
      tileAddress = 0x9000 + signedTileNumber * TILE_STRIDE;
    }
    const line = y & 0x07;
    const base = tileAddress + line * 2;
    const low = this.#cgbMode
      ? bus.readVram(base, vramBank)
      : bus.readVram(base, 0);
    const high = this.#cgbMode
      ? bus.readVram(base + 1, vramBank)
      : bus.readVram(base + 1, 0);
    const bitIndex = 7 - (x & 0x07);
    return (((high >> bitIndex) & 0x01) << 1) | ((low >> bitIndex) & 0x01);
  }

  #decodePalette(address: number): [number, number, number, number] {
    const bus = this.#bus;
    const value = bus.readByte(address);
    const palette: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i += 1) {
      palette[i] = (value >> (i * 2)) & 0x03;
    }
    return palette;
  }

  #writePixel(offset: number, color: [number, number, number, number]): void {
    this.#framebuffer.data[offset] = color[0];
    this.#framebuffer.data[offset + 1] = color[1];
    this.#framebuffer.data[offset + 2] = color[2];
    this.#framebuffer.data[offset + 3] = color[3];
  }

  #writeLyRegister(value: number): void {
    this.#ly = value % TOTAL_SCANLINES;
    this.#bus.writeByte(LY_ADDRESS, this.#ly);
    this.#updateLyCompareFlag();
    this.#spriteBufferLy = -1;
  }

  #setMode(nextMode: PpuMode): void {
    if (this.#currentMode === nextMode) {
      return;
    }
    this.#currentMode = nextMode;
    this.#writeStatModeBits();
    this.#handleModeInterrupts(nextMode);
    if (nextMode === "hblank") {
      this.#bus.handleHblankHdma();
    }
  }

  #writeStatModeBits(): void {
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
    this.#bus.requestInterrupt(type);
  }

  #updateLyCompareFlag(): void {
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
