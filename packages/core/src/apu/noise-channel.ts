class NoiseChannel {
  private static readonly DIVTABLE: readonly number[] = [
    8, 16, 32, 48, 64, 80, 96, 112,
  ];

  initLengthTimer = 0;
  envelopeVolume = 0;
  envelopeDirection = 0;
  envelopePace = 0;
  clockShift = 0;
  registerWidth = 0;
  clockDiv = 0;
  lengthEnable = 0;

  enable = 0;
  lengthTimer = 64;
  periodTimer = 0;
  envelopeTimer = 0;
  period = 8;
  shiftRegister = 1;
  lfsrFeed = 0x4000;
  volume = 0;

  reset(): void {
    this.initLengthTimer = 0;
    this.envelopeVolume = 0;
    this.envelopeDirection = 0;
    this.envelopePace = 0;
    this.clockShift = 0;
    this.registerWidth = 0;
    this.clockDiv = 0;
    this.lengthEnable = 0;

    this.enable = 0;
    this.lengthTimer = 64;
    this.periodTimer = 0;
    this.envelopeTimer = 0;
    this.period = 8;
    this.shiftRegister = 1;
    this.lfsrFeed = 0x4000;
    this.volume = 0;
  }

  getreg(reg: number): number {
    switch (reg) {
      case 0:
        return 0xff;
      case 1:
        return 0xff;
      case 2:
        return (
          ((this.envelopeVolume & 0x0f) << 4) |
          ((this.envelopeDirection & 0x01) << 3) |
          (this.envelopePace & 0x07)
        );
      case 3:
        return (
          ((this.clockShift & 0x0f) << 4) |
          ((this.registerWidth & 0x01) << 3) |
          (this.clockDiv & 0x07)
        );
      case 4:
        return ((this.lengthEnable & 0x01) << 6) | 0xbf;
      default:
        return 0xff;
    }
  }

  setreg(reg: number, val: number): void {
    const value = val & 0xff;
    switch (reg) {
      case 0:
        break;
      case 1:
        this.initLengthTimer = value & 0x3f;
        this.lengthTimer = 64 - this.initLengthTimer;
        break;
      case 2:
        this.envelopeVolume = (value >> 4) & 0x0f;
        this.envelopeDirection = (value >> 3) & 0x01;
        this.envelopePace = value & 0x07;
        if (this.envelopeVolume === 0 && this.envelopeDirection === 0) {
          this.enable = 0;
        }
        break;
      case 3:
        this.clockShift = (value >> 4) & 0x0f;
        this.registerWidth = (value >> 3) & 0x01;
        this.clockDiv = value & 0x07;
        this.period =
          (NoiseChannel.DIVTABLE[this.clockDiv] ?? 8) << this.clockShift;
        this.lfsrFeed = this.registerWidth ? 0x4040 : 0x4000;
        break;
      case 4:
        this.lengthEnable = (value >> 6) & 0x01;
        if (value & 0x80) {
          this.trigger();
        }
        break;
      default:
        break;
    }
  }

  tick(cycles: number): void {
    this.periodTimer -= cycles;
    while (this.periodTimer <= 0) {
      this.periodTimer += this.period;
      let tap = this.shiftRegister;
      this.shiftRegister >>= 1;
      tap ^= this.shiftRegister;
      if (tap & 0x01) {
        this.shiftRegister |= this.lfsrFeed;
      } else {
        this.shiftRegister &= ~this.lfsrFeed;
      }
    }
  }

  tickLength(): void {
    if (this.lengthEnable && this.lengthTimer > 0) {
      this.lengthTimer -= 1;
      if (this.lengthTimer === 0) {
        this.enable = 0;
      }
    }
  }

  tickEnvelope(): void {
    if (this.envelopeTimer !== 0) {
      this.envelopeTimer -= 1;
      if (this.envelopeTimer === 0) {
        const delta = this.envelopeDirection ? 1 : -1;
        const nextVolume = this.volume + delta;
        if (nextVolume < 0 || nextVolume > 15) {
          this.envelopeTimer = 0;
        } else {
          this.envelopeTimer = this.envelopePace;
          this.volume = nextVolume;
        }
      }
    }
  }

  sample(): number {
    if (!this.enable) {
      return 0;
    }
    return (this.shiftRegister & 0x01) === 0 ? this.volume : 0;
  }

  trigger(): void {
    this.enable = 0x08;
    this.lengthTimer = this.lengthTimer || 64;
    this.periodTimer = this.period;
    this.envelopeTimer = this.envelopePace;
    this.volume = this.envelopeVolume;
    this.shiftRegister = 0x7fff;
    if (this.envelopeVolume === 0 && this.envelopeDirection === 0) {
      this.enable = 0;
    }
  }
}

export { NoiseChannel };
