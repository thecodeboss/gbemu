import { Clock } from "./clock.js";
import { SystemBus } from "./bus.js";

const SOUND_REGISTER_START = 0xff10;
const SOUND_REGISTER_END = 0xff3f;
const PCM12_REGISTER = 0xff76;
const PCM34_REGISTER = 0xff77;

const CYCLES_512HZ = 8192;
const MAX_SAMPLE_VALUE = 0x7f;
const DEFAULT_SAMPLE_RATE = 48_000;
const MAX_BUFFER_SECONDS = 2;
const MASTER_CLOCK_HZ = 4_194_304;
const FRAME_RATE_HZ = MASTER_CLOCK_HZ / Clock.FRAME_CYCLES;
const HIGH_PASS_BASE_DMG = 0.999958;
const HIGH_PASS_BASE_CGB = 0.998943;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeMixedSample(value: number): number {
  const centered = value / (MAX_SAMPLE_VALUE / 2);
  return clamp(centered, -1, 1);
}

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

export class Apu {
  #bus: SystemBus;

  #sampleRate = DEFAULT_SAMPLE_RATE;
  #cyclesPerSample = Clock.FRAME_CYCLES / (DEFAULT_SAMPLE_RATE / 60);
  #nextSampleCycle = this.#cyclesPerSample;
  #nextFrameSequencerCycle = CYCLES_512HZ;
  #frameSequencerStep = 0;
  #cycleCounter = 0;
  #highPassLeftCap = 0;
  #highPassRightCap = 0;
  #highPassCharge = 0.996;

  #nr50 = 0x77;
  #nr51 = 0xf3;
  #powerOn = true;

  #leftEnable = { sweep: false, tone: false, wave: false, noise: false };
  #rightEnable = { sweep: false, tone: false, wave: false, noise: false };

  #sampleQueue: number[] = [];

  #sweepChannel = new SweepChannel();
  #toneChannel = new ToneChannel();
  #waveChannel = new WaveChannel();
  #noiseChannel = new NoiseChannel();

  constructor(bus: SystemBus) {
    this.#bus = bus;
    this.setOutputSampleRate(DEFAULT_SAMPLE_RATE);
    this.reset();
    this.#bus.attachApu?.(this);
  }

  reset(): void {
    this.#cycleCounter = 0;
    this.#nextSampleCycle = this.#cyclesPerSample;
    this.#sampleQueue.length = 0;
    this.#highPassLeftCap = 0;
    this.#highPassRightCap = 0;

    this.#nr50 = 0x77;
    this.#nr51 = 0xf3;
    this.#powerOn = true;
    this.#applyStereoPanning(this.#nr51);

    this.#sweepChannel.reset();
    this.#toneChannel.reset();
    this.#waveChannel.reset();
    this.#noiseChannel.reset();

    this.#resetFrameSequencerTiming();
  }

  setOutputSampleRate(rate: number): void {
    const nextRate =
      Number.isFinite(rate) && rate > 0
        ? Math.floor(rate)
        : DEFAULT_SAMPLE_RATE;
    this.#sampleRate = nextRate;
    const samplesPerFrame = Math.max(
      1,
      Math.floor(this.#sampleRate / FRAME_RATE_HZ),
    );
    this.#cyclesPerSample = Clock.FRAME_CYCLES / samplesPerFrame;
    this.#nextSampleCycle = this.#cycleCounter + this.#cyclesPerSample;
    this.#highPassCharge = this.#computeHighPassCharge();
    this.clearAudioBuffers();
  }

  tick(cpuCycles: number): void {
    if (cpuCycles <= 0) {
      return;
    }

    const ticksPerCpu = this.#bus.getTicksPerCpuCycle();
    let remaining = cpuCycles * ticksPerCpu;

    while (remaining > 0) {
      const targetCycle = Math.min(
        this.#cycleCounter + remaining,
        Math.min(this.#nextSampleCycle, this.#nextFrameSequencerCycle),
      );
      const delta = Math.max(0, targetCycle - this.#cycleCounter);

      if (delta > 0) {
        if (this.#powerOn) {
          this.#tickChannels(delta);
        }
        this.#cycleCounter += delta;
        remaining -= delta;
      } else {
        // Ensure forward progress in case of rounding issues.
        this.#cycleCounter += 1;
        remaining -= 1;
      }

      while (this.#cycleCounter >= this.#nextFrameSequencerCycle) {
        this.#runFrameSequencer();
        this.#nextFrameSequencerCycle += CYCLES_512HZ;
      }

      while (this.#cycleCounter >= this.#nextSampleCycle) {
        this.#mixSample();
        this.#nextSampleCycle += this.#cyclesPerSample;
      }
    }
  }

  clearAudioBuffers(): void {
    this.#sampleQueue.length = 0;
  }

  flushSamples(
    requestedSampleRate: number,
    requestedFrames: number,
  ): Float32Array {
    const frames = Math.max(0, Math.floor(requestedFrames));
    if (frames === 0) {
      return new Float32Array(0);
    }

    if (requestedSampleRate !== this.#sampleRate) {
      const ratio = this.#sampleRate / requestedSampleRate;
      const neededSourceFrames = Math.ceil(frames * ratio);
      const source = this.#dequeueFrames(neededSourceFrames);
      return this.#resampleFrames(source, frames, ratio);
    }

    const source = this.#dequeueFrames(frames);
    return new Float32Array(source);
  }

  readRegister(address: number): number | null {
    if (address < SOUND_REGISTER_START || address > SOUND_REGISTER_END) {
      return null;
    }
    const offset = address - SOUND_REGISTER_START;

    if (offset < 20) {
      const channelIndex = Math.floor(offset / 5);
      const reg = offset % 5;
      switch (channelIndex) {
        case 0:
          return this.#sweepChannel.getreg(reg) & 0xff;
        case 1:
          return this.#toneChannel.getreg(reg) & 0xff;
        case 2:
          return this.#waveChannel.getreg(reg) & 0xff;
        case 3:
          return this.#noiseChannel.getreg(reg) & 0xff;
        default:
          return 0xff;
      }
    }

    if (offset === 20) {
      return this.#nr50 & 0xff;
    }
    if (offset === 21) {
      return this.#nr51 & 0xff;
    }
    if (offset === 22) {
      const channelFlags =
        (this.#sweepChannel.enable ? 0x01 : 0) |
        (this.#toneChannel.enable ? 0x02 : 0) |
        (this.#waveChannel.enable ? 0x04 : 0) |
        (this.#noiseChannel.enable ? 0x08 : 0);
      const powerFlag = this.#powerOn ? 0x80 : 0x00;
      return 0x70 | powerFlag | channelFlags;
    }

    if (offset < 32) {
      return 0xff;
    }

    if (offset < 48) {
      return this.#waveChannel.getWaveByte(
        this.#bus.isCgbHardware(),
        offset - 32,
      );
    }

    return 0xff;
  }

  writeRegister(address: number, value: number): void {
    if (address < SOUND_REGISTER_START || address > SOUND_REGISTER_END) {
      return;
    }
    const offset = address - SOUND_REGISTER_START;
    const byteValue = value & 0xff;
    const cgbHardware = this.#bus.isCgbHardware();

    if (offset < 20) {
      if (this.#powerOn) {
        const channelIndex = Math.floor(offset / 5);
        const reg = offset % 5;
        switch (channelIndex) {
          case 0:
            this.#sweepChannel.setreg(reg, byteValue);
            break;
          case 1:
            this.#toneChannel.setreg(reg, byteValue);
            break;
          case 2:
            this.#waveChannel.setreg(reg, byteValue);
            break;
          case 3:
            this.#noiseChannel.setreg(reg, byteValue);
            break;
          default:
            break;
        }
      }
      return;
    }

    if (offset === 20) {
      if (this.#powerOn) {
        this.#nr50 = byteValue & 0xff;
      }
      return;
    }

    if (offset === 21) {
      if (this.#powerOn) {
        this.#nr51 = byteValue & 0xff;
        this.#applyStereoPanning(this.#nr51);
      }
      return;
    }

    if (offset === 22) {
      if ((byteValue & 0x80) === 0) {
        this.#powerOff();
      } else {
        if (!this.#powerOn) {
          this.#resetFrameSequencerTiming();
        }
        this.#powerOn = true;
      }
      return;
    }

    if (offset < 32) {
      return;
    }

    if (offset < 48) {
      this.#waveChannel.setWaveByte(
        this.#bus.isCgbHardware(),
        offset - 32,
        byteValue,
      );
    }
  }

  readPcm12(): number {
    return (
      (this.#sweepChannel.sample() & 0x0f) |
      ((this.#toneChannel.sample() & 0x0f) << 4)
    );
  }

  readPcm34(): number {
    return (
      (this.#waveChannel.sample() & 0x0f) |
      ((this.#noiseChannel.sample() & 0x0f) << 4)
    );
  }

  #dequeueFrames(frames: number): number[] {
    const availableFrames = Math.floor(this.#sampleQueue.length / 2);
    const framesToEmit = Math.min(frames, availableFrames);
    const missingFrames = Math.max(0, frames - framesToEmit);
    const taken =
      framesToEmit > 0 ? this.#sampleQueue.splice(0, framesToEmit * 2) : [];

    if (missingFrames > 0) {
      const padding = new Array(missingFrames * 2).fill(0);
      return taken.concat(padding);
    }
    return taken;
  }

  #resampleFrames(
    source: number[],
    targetFrames: number,
    ratio: number,
  ): Float32Array {
    if (targetFrames <= 0) {
      return new Float32Array(0);
    }
    const output = new Float32Array(targetFrames * 2);
    if (source.length === 0) {
      return output;
    }

    const sourceFrames = Math.max(1, Math.floor(source.length / 2));
    for (let i = 0; i < targetFrames; i += 1) {
      const position = i * ratio;
      const index = Math.floor(position);
      const frac = position - index;
      const base = Math.min(index, sourceFrames - 1) * 2;
      const nextBase = Math.min(index + 1, sourceFrames - 1) * 2;

      const left =
        (source[base] ?? 0) * (1 - frac) + (source[nextBase] ?? 0) * frac;
      const right =
        (source[base + 1] ?? 0) * (1 - frac) +
        (source[nextBase + 1] ?? 0) * frac;

      output[i * 2] = left;
      output[i * 2 + 1] = right;
    }
    return output;
  }

  #tickChannels(cycles: number): void {
    if (!this.#powerOn) {
      return;
    }
    this.#sweepChannel.tick(cycles);
    this.#toneChannel.tick(cycles);
    this.#waveChannel.tick(cycles);
    this.#noiseChannel.tick(cycles);
  }

  #runFrameSequencer(): void {
    const step = this.#frameSequencerStep;

    if (step === 0 || step === 2 || step === 4 || step === 6) {
      this.#sweepChannel.tickLength();
      this.#toneChannel.tickLength();
      this.#waveChannel.tickLength();
      this.#noiseChannel.tickLength();
    }

    if (step === 2 || step === 6) {
      this.#sweepChannel.tickSweep();
    }

    if (step === 7) {
      this.#sweepChannel.tickEnvelope();
      this.#toneChannel.tickEnvelope();
      this.#noiseChannel.tickEnvelope();
    }

    this.#frameSequencerStep = (step + 1) & 0x07;
  }

  #mixSample(): void {
    let left = 0;
    let right = 0;

    const dacsEnabled = this.#dacsEnabled();
    if (this.#powerOn) {
      if (this.#leftEnable.sweep) {
        left += this.#sweepChannel.sample();
      }
      if (this.#leftEnable.tone) {
        left += this.#toneChannel.sample();
      }
      if (this.#leftEnable.wave) {
        left += this.#waveChannel.sample();
      }
      if (this.#leftEnable.noise) {
        left += this.#noiseChannel.sample();
      }

      if (this.#rightEnable.sweep) {
        right += this.#sweepChannel.sample();
      }
      if (this.#rightEnable.tone) {
        right += this.#toneChannel.sample();
      }
      if (this.#rightEnable.wave) {
        right += this.#waveChannel.sample();
      }
      if (this.#rightEnable.noise) {
        right += this.#noiseChannel.sample();
      }
    }

    const leftClamped = clamp(left, 0, MAX_SAMPLE_VALUE);
    const rightClamped = clamp(right, 0, MAX_SAMPLE_VALUE);

    const leftLevel = ((this.#nr50 >> 4) & 0x07) + 1;
    const rightLevel = (this.#nr50 & 0x07) + 1;

    const leftSample = normalizeMixedSample(leftClamped) * (leftLevel / 8);
    const rightSample = normalizeMixedSample(rightClamped) * (rightLevel / 8);

    const filteredLeft = this.#applyHighPass(leftSample, dacsEnabled, "left");
    const filteredRight = this.#applyHighPass(
      rightSample,
      dacsEnabled,
      "right",
    );

    this.#pushSample(clamp(filteredLeft, -1, 1), clamp(filteredRight, -1, 1));
  }

  #pushSample(left: number, right: number): void {
    const maxFrames = this.#sampleRate * MAX_BUFFER_SECONDS;
    if (this.#sampleQueue.length / 2 > maxFrames) {
      const excess = this.#sampleQueue.length - maxFrames * 2;
      this.#sampleQueue.splice(0, excess);
    }
    this.#sampleQueue.push(left, right);
  }

  #applyStereoPanning(mask: number): void {
    this.#rightEnable = {
      sweep: (mask & 0x01) !== 0,
      tone: (mask & 0x02) !== 0,
      wave: (mask & 0x04) !== 0,
      noise: (mask & 0x08) !== 0,
    };
    this.#leftEnable = {
      sweep: (mask & 0x10) !== 0,
      tone: (mask & 0x20) !== 0,
      wave: (mask & 0x40) !== 0,
      noise: (mask & 0x80) !== 0,
    };
  }

  #powerOff(): void {
    this.#powerOn = false;
    this.#nr50 = 0;
    this.#nr51 = 0;
    this.#applyStereoPanning(0);
    this.#sweepChannel.reset();
    this.#toneChannel.reset();
    this.#waveChannel.powerOff();
    this.#noiseChannel.reset();
    this.#highPassLeftCap = 0;
    this.#highPassRightCap = 0;
  }

  #resetFrameSequencerTiming(): void {
    const divCounter = this.#bus.getDividerCounter();
    const framePeriod = CYCLES_512HZ << (this.#bus.isDoubleSpeed() ? 1 : 0); // DIV bit 4 (bit 5 in double-speed) falling edge
    const remainder = divCounter % framePeriod;
    const cyclesUntilEdge =
      remainder === 0 ? framePeriod : framePeriod - remainder;
    this.#frameSequencerStep = 0;
    this.#nextFrameSequencerCycle = this.#cycleCounter + cyclesUntilEdge;
  }

  handleDividerReset(divApuBitWasHigh: boolean): void {
    if (divApuBitWasHigh) {
      this.#runFrameSequencer();
    }
    const previousStep = this.#frameSequencerStep;
    this.#resetFrameSequencerTiming();
    this.#frameSequencerStep = previousStep;
  }

  debugGetChannelState(): {
    frameSequencerStep: number;
    sweep: { enable: number; lengthTimer: number; lengthEnable: number };
    tone: { enable: number; lengthTimer: number; lengthEnable: number };
    wave: { enable: number; lengthTimer: number; lengthEnable: number };
    noise: { enable: number; lengthTimer: number; lengthEnable: number };
  } {
    return {
      frameSequencerStep: this.#frameSequencerStep,
      sweep: {
        enable: this.#sweepChannel.enable,
        lengthTimer: this.#sweepChannel.lengthTimer,
        lengthEnable: this.#sweepChannel.lengthEnable,
      },
      tone: {
        enable: this.#toneChannel.enable,
        lengthTimer: this.#toneChannel.lengthTimer,
        lengthEnable: this.#toneChannel.lengthEnable,
      },
      wave: {
        enable: this.#waveChannel.enable,
        lengthTimer: this.#waveChannel.lengthTimer,
        lengthEnable: this.#waveChannel.lengthEnable,
      },
      noise: {
        enable: this.#noiseChannel.enable,
        lengthTimer: this.#noiseChannel.lengthTimer,
        lengthEnable: this.#noiseChannel.lengthEnable,
      },
    };
  }

  #dacsEnabled(): boolean {
    const sweepDac =
      this.#sweepChannel.envelopeVolume > 0 ||
      this.#sweepChannel.envelopeDirection !== 0;
    const toneDac =
      this.#toneChannel.envelopeVolume > 0 ||
      this.#toneChannel.envelopeDirection !== 0;
    const waveDac = this.#waveChannel.dacPower !== 0;
    const noiseDac =
      this.#noiseChannel.envelopeVolume > 0 ||
      this.#noiseChannel.envelopeDirection !== 0;
    return sweepDac || toneDac || waveDac || noiseDac;
  }

  #applyHighPass(
    input: number,
    dacsEnabled: boolean,
    channel: "left" | "right",
  ): number {
    if (!dacsEnabled) {
      if (channel === "left") {
        this.#highPassLeftCap = 0;
      } else {
        this.#highPassRightCap = 0;
      }
      return 0;
    }

    if (channel === "left") {
      const out = input - this.#highPassLeftCap;
      this.#highPassLeftCap = input - out * this.#highPassCharge;
      return out;
    }

    const out = input - this.#highPassRightCap;
    this.#highPassRightCap = input - out * this.#highPassCharge;
    return out;
  }

  #computeHighPassCharge(): number {
    const base = this.#bus.isCgbHardware()
      ? HIGH_PASS_BASE_CGB
      : HIGH_PASS_BASE_DMG;
    return Math.pow(base, MASTER_CLOCK_HZ / this.#sampleRate);
  }
}

export type { SystemBus } from "./bus.js";
export const AUDIO_PCM12_REGISTER = PCM12_REGISTER;
export const AUDIO_PCM34_REGISTER = PCM34_REGISTER;
