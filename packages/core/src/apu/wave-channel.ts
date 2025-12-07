class WaveChannel {
  private wavetable = new Uint8Array(16).fill(0xff);

  dacPower = 0;
  initLengthTimer = 0;
  volReg = 0;
  soundPeriod = 0;
  lengthEnable = 0;

  enable = 0;
  lengthTimer = 256;
  periodTimer = 0;
  period = 4;
  waveFrame = 0;
  volumeShift = 0;

  reset(): void {
    this.waveFrame = 0;
    this.periodTimer = 0;
    this.period = 4;
    this.lengthTimer = 256;
    this.volumeShift = 0;
    this.enable = 0;
    this.lengthEnable = 0;
    this.soundPeriod = 0;
    this.initLengthTimer = 0;
    this.volReg = 0;
    this.dacPower = 0;
    this.wavetable.fill(0xff);
  }

  powerOff(): void {
    // Preserve wave RAM contents when the APU is powered off.
    this.dacPower = 0;
    this.initLengthTimer = 0;
    this.volReg = 0;
    this.soundPeriod = 0;
    this.lengthEnable = 0;

    this.enable = 0;
    this.lengthTimer = 256;
    this.periodTimer = 0;
    this.period = 4;
    this.waveFrame = 0;
    this.volumeShift = 0;
  }

  getreg(reg: number): number {
    switch (reg) {
      case 0:
        return (this.dacPower << 7) | 0x7f;
      case 1:
        return 0xff;
      case 2:
        return ((this.volReg & 0x03) << 5) | 0x9f;
      case 3:
        return 0xff;
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
        this.dacPower = (value >> 7) & 0x01;
        if (this.dacPower === 0) {
          this.enable = 0;
        }
        break;
      case 1:
        this.initLengthTimer = value;
        this.lengthTimer = 256 - this.initLengthTimer;
        break;
      case 2:
        this.volReg = (value >> 5) & 0x03;
        this.volumeShift = this.volReg > 0 ? this.volReg - 1 : 4;
        break;
      case 3:
        this.soundPeriod = (this.soundPeriod & 0x700) | value;
        this.period = Math.max(2, 2 * (0x800 - (this.soundPeriod & 0x7ff)));
        break;
      case 4:
        this.lengthEnable = (value >> 6) & 0x01;
        this.soundPeriod =
          ((value << 8) & 0x0700) | (this.soundPeriod & 0x00ff);
        this.period = Math.max(2, 2 * (0x800 - (this.soundPeriod & 0x7ff)));
        if (value & 0x80) {
          this.trigger();
        }
        break;
      default:
        break;
    }
  }

  getWaveByte(cgbHardware: boolean, offset: number): number {
    if (this.enable) {
      return cgbHardware ? this.wavetable[this.waveFrame % 16] : 0xff;
    }
    return this.wavetable[offset] ?? 0xff;
  }

  setWaveByte(cgbHardware: boolean, offset: number, val: number): void {
    const value = val & 0xff;
    if (this.enable) {
      if (cgbHardware) {
        this.wavetable[this.waveFrame % 16] = value;
      }
    } else {
      this.wavetable[offset] = value;
    }
  }

  tick(cycles: number): void {
    this.periodTimer -= cycles;
    while (this.periodTimer <= 0) {
      this.periodTimer += this.period;
      this.waveFrame = (this.waveFrame + 1) % 32;
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

  sample(): number {
    if (!this.enable || this.dacPower === 0) {
      return 0;
    }
    const sample = this.wavetable[Math.floor(this.waveFrame / 2)] ?? 0;
    const nibble = this.waveFrame % 2 === 0 ? sample >> 4 : sample & 0x0f;
    return (nibble >> this.volumeShift) & 0x0f;
  }

  trigger(): void {
    this.enable = this.dacPower ? 0x04 : 0;
    this.lengthTimer = this.lengthTimer || 256;
    this.periodTimer = this.period;
  }
}

export { WaveChannel };
