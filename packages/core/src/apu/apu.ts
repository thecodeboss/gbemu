import { SystemBus } from "../bus.js";
import { Clock } from "../clock.js";
import {
  CYCLES_512HZ,
  DEFAULT_SAMPLE_RATE,
  FRAME_RATE_HZ,
  HIGH_PASS_BASE_CGB,
  HIGH_PASS_BASE_DMG,
  MAX_BUFFER_SECONDS,
  MAX_SAMPLE_VALUE,
  MASTER_CLOCK_HZ,
  PCM12_REGISTER,
  PCM34_REGISTER,
  SOUND_REGISTER_END,
  SOUND_REGISTER_START,
} from "./constants.js";
import { NoiseChannel } from "./noise-channel.js";
import { SweepChannel } from "./sweep-channel.js";
import { ToneChannel } from "./tone-channel.js";
import { clamp, normalizeMixedSample } from "./utils.js";
import { WaveChannel } from "./wave-channel.js";

class Apu {
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

export { Apu };
export type { SystemBus } from "../bus.js";
export const AUDIO_PCM12_REGISTER = PCM12_REGISTER;
export const AUDIO_PCM34_REGISTER = PCM34_REGISTER;
