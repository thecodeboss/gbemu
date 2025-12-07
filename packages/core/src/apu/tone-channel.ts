class ToneChannel {
  private static readonly WAVETABLES: readonly number[][] = [
    [0, 0, 0, 0, 0, 0, 0, 1], // 12.5%
    [1, 0, 0, 0, 0, 0, 0, 1], // 25%
    [1, 0, 0, 0, 0, 1, 1, 1], // 50%
    [0, 1, 1, 1, 1, 1, 1, 0], // 75%
  ];

  waveDuty = 0;
  initLengthTimer = 0;
  envelopeVolume = 0;
  envelopeDirection = 0;
  envelopePace = 0;
  soundPeriod = 0;
  lengthEnable = 0;

  enable = 0;
  lengthTimer = 64;
  envelopeTimer = 0;
  periodTimer = 0;
  period = 4;
  waveFrame = 0;
  volume = 0;

  reset(): void {
    this.waveDuty = 0;
    this.initLengthTimer = 0;
    this.envelopeVolume = 0;
    this.envelopeDirection = 0;
    this.envelopePace = 0;
    this.soundPeriod = 0;
    this.lengthEnable = 0;

    this.enable = 0;
    this.lengthTimer = 64;
    this.envelopeTimer = 0;
    this.periodTimer = 0;
    this.period = 4;
    this.waveFrame = 0;
    this.volume = 0;
  }

  getreg(reg: number): number {
    switch (reg) {
      case 0:
        return 0;
      case 1:
        return (this.waveDuty << 6) | 0x3f;
      case 2:
        return (
          ((this.envelopeVolume & 0x0f) << 4) |
          ((this.envelopeDirection & 0x01) << 3) |
          (this.envelopePace & 0x07)
        );
      case 3:
        return 0xff;
      case 4:
        return 0xbf | ((this.lengthEnable & 0x01) << 6);
      default:
        return 0xff;
    }
  }

  setreg(reg: number, val: number): void {
    const value = val & 0xff;
    switch (reg) {
      case 0:
        break;
      case 1: {
        this.waveDuty = (value >> 6) & 0x03;
        this.initLengthTimer = value & 0x3f;
        this.lengthTimer = 64 - this.initLengthTimer;
        break;
      }
      case 2: {
        this.envelopeVolume = (value >> 4) & 0x0f;
        this.envelopeDirection = (value >> 3) & 0x01;
        this.envelopePace = value & 0x07;
        if (this.envelopeVolume === 0 && this.envelopeDirection === 0) {
          this.enable = 0;
        }
        break;
      }
      case 3: {
        this.soundPeriod = (this.soundPeriod & 0x700) | value;
        this.period = Math.max(4, 4 * (0x800 - (this.soundPeriod & 0x7ff)));
        break;
      }
      case 4: {
        this.lengthEnable = (value >> 6) & 0x01;
        this.soundPeriod =
          ((value << 8) & 0x0700) | (this.soundPeriod & 0x00ff);
        this.period = Math.max(4, 4 * (0x800 - (this.soundPeriod & 0x7ff)));
        if (value & 0x80) {
          this.trigger();
        }
        break;
      }
      default:
        break;
    }
  }

  tick(cycles: number): void {
    this.periodTimer -= cycles;
    while (this.periodTimer <= 0) {
      this.periodTimer += this.period;
      this.waveFrame = (this.waveFrame + 1) % 8;
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
    const table =
      ToneChannel.WAVETABLES[this.waveDuty] ?? ToneChannel.WAVETABLES[0];
    return this.volume * (table[this.waveFrame] ?? 0);
  }

  trigger(): void {
    this.enable = 0x02;
    this.lengthTimer = this.lengthTimer || 64;
    this.periodTimer = this.period;
    this.envelopeTimer = this.envelopePace;
    this.volume = this.envelopeVolume;
    if (this.envelopeVolume === 0 && this.envelopeDirection === 0) {
      this.enable = 0;
    }
  }
}

export { ToneChannel };
