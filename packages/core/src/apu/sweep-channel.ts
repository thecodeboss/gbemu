import { ToneChannel } from "./tone-channel.js";

class SweepChannel extends ToneChannel {
  sweepPace = 0;
  sweepDirection = 0;
  sweepMagnitude = 0;
  sweepTimer = 0;
  sweepEnable = false;
  shadow = 0;

  override reset(): void {
    super.reset();
    this.sweepPace = 0;
    this.sweepDirection = 0;
    this.sweepMagnitude = 0;
    this.sweepTimer = 0;
    this.sweepEnable = false;
    this.shadow = 0;
  }

  override getreg(reg: number): number {
    if (reg === 0) {
      return (
        ((this.sweepPace & 0x07) << 4) |
        ((this.sweepDirection & 0x01) << 3) |
        (this.sweepMagnitude & 0x07) |
        0x80
      );
    }
    return super.getreg(reg);
  }

  override setreg(reg: number, val: number): void {
    if (reg === 0) {
      const value = val & 0xff;
      this.sweepPace = (value >> 4) & 0x07;
      this.sweepDirection = (value >> 3) & 0x01;
      this.sweepMagnitude = value & 0x07;
    } else {
      super.setreg(reg, val);
    }
  }

  tickSweep(): void {
    if (this.sweepEnable && this.sweepPace) {
      this.sweepTimer -= 1;
      if (this.sweepTimer === 0) {
        if (this.sweep(true)) {
          this.sweepTimer = this.sweepPace;
          this.sweep(false);
        }
      }
    }
  }

  override trigger(): void {
    super.trigger();
    if (this.enable) {
      this.enable = 0x01;
    }
    this.shadow = this.soundPeriod & 0x7ff;
    this.sweepTimer = this.sweepPace || 8;
    this.sweepEnable = this.sweepPace !== 0 || this.sweepMagnitude !== 0;
    if (this.sweepMagnitude) {
      this.sweep(false);
    }
  }

  private sweep(apply: boolean): boolean {
    const change = this.shadow >> this.sweepMagnitude;
    const next =
      this.sweepDirection === 0 ? this.shadow + change : this.shadow - change;

    if (next >= 0x800) {
      this.enable = 0;
      return false;
    }

    if (apply && this.sweepMagnitude) {
      this.soundPeriod = next & 0x7ff;
      this.shadow = this.soundPeriod;
      this.period = Math.max(4, 4 * (0x800 - (this.soundPeriod & 0x7ff)));
      return true;
    }
    return true;
  }
}

export { SweepChannel };
