import { InterruptType } from "./cpu.js";
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

type PpuMode = PpuLcdStatus["mode"];

const LCDC_ADDRESS = 0xff40;
const STAT_ADDRESS = 0xff41;
const LY_ADDRESS = 0xff44;
const LYC_ADDRESS = 0xff45;

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

const LCDC_ENABLE_FLAG = 0x80;

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
    this.#lineDot = 0;
    if (this.#ly !== 0) {
      this.#writeLyRegister(0);
    }
    this.#setMode("hblank");
    this.#lcdActive = false;
  }

  #onLcdEnabled(): void {
    this.#lcdActive = true;
    this.#lineDot = 0;
    this.#writeLyRegister(0);
    this.#setMode("oam");
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
      this.#setMode("hblank");
    }
  }

  #handleLineComplete(): void {
    const nextLy = this.#ly + 1;
    if (nextLy >= TOTAL_SCANLINES) {
      this.#writeLyRegister(0);
      this.#setMode("oam");
      return;
    }

    this.#writeLyRegister(nextLy);

    if (this.#ly >= VBLANK_START_LINE && this.#ly <= VBLANK_END_LINE) {
      this.#setMode("vblank");
    } else {
      this.#setMode("oam");
    }
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
