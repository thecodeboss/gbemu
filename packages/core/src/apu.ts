import { SystemBus } from "./bus.js";

export interface AudioSample {
  left: number;
  right: number;
}

const NR10_ADDRESS = 0xff10;
const NR11_ADDRESS = 0xff11;
const NR12_ADDRESS = 0xff12;
const NR13_ADDRESS = 0xff13;
const NR14_ADDRESS = 0xff14;
const NR21_ADDRESS = 0xff16;
const NR22_ADDRESS = 0xff17;
const NR23_ADDRESS = 0xff18;
const NR24_ADDRESS = 0xff19;
const NR30_ADDRESS = 0xff1a;
const NR31_ADDRESS = 0xff1b;
const NR32_ADDRESS = 0xff1c;
const NR33_ADDRESS = 0xff1d;
const NR34_ADDRESS = 0xff1e;
const NR41_ADDRESS = 0xff20;
const NR42_ADDRESS = 0xff21;
const NR43_ADDRESS = 0xff22;
const NR44_ADDRESS = 0xff23;
const NR50_ADDRESS = 0xff24;
const NR51_ADDRESS = 0xff25;
const NR52_ADDRESS = 0xff26;
const WAVE_TABLE_START = 0xff30;
const WAVE_TABLE_END = 0xff3f;

const MASTER_CLOCK_HZ = 4_194_304;
const FRAME_SEQUENCER_RATE = 512;
const FRAME_SEQUENCER_PERIOD = MASTER_CLOCK_HZ / FRAME_SEQUENCER_RATE; // 8192 master cycles.
const INTERNAL_SAMPLE_RATE = 44_100;
const HIGH_PASS_CUTOFF_HZ = 90;
const NR52_CONSTANT_BITS = 0x70;
const NOISE_DIVISOR_TABLE = [8, 16, 32, 48, 64, 80, 96, 112];
const MAX_RAW_BACKLOG_SAMPLES = 2_000; // Cap raw backlog to ~45 ms at 44.1 kHz.
const DUTY_PATTERNS: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 1], // 12.5%
  [1, 0, 0, 0, 0, 0, 0, 1], // 25%
  [1, 0, 0, 0, 0, 1, 1, 1], // 50%
  [0, 1, 1, 1, 1, 1, 1, 0], // 75%
];
const MASTER_GAIN = 0.5; // Keep headroom for multiple channels.

class HighPassFilter {
  #alpha: number;
  #prevInput: AudioSample = { left: 0, right: 0 };
  #prevOutput: AudioSample = { left: 0, right: 0 };

  constructor(sampleRate: number, cutoffHz: number) {
    this.#alpha = this.#computeAlpha(sampleRate, cutoffHz);
  }

  setSampleRate(sampleRate: number): void {
    this.#alpha = this.#computeAlpha(sampleRate, HIGH_PASS_CUTOFF_HZ);
    this.reset();
  }

  reset(): void {
    this.#prevInput = { left: 0, right: 0 };
    this.#prevOutput = { left: 0, right: 0 };
  }

  process(sample: AudioSample): AudioSample {
    const left =
      this.#alpha *
      (this.#prevOutput.left + sample.left - this.#prevInput.left);
    const right =
      this.#alpha *
      (this.#prevOutput.right + sample.right - this.#prevInput.right);
    this.#prevInput = { ...sample };
    this.#prevOutput = { left, right };
    return { left, right };
  }

  #computeAlpha(sampleRate: number, cutoffHz: number): number {
    if (sampleRate <= 0) {
      return 0;
    }
    return Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  }
}

interface Channel1State {
  enabled: boolean;
  dacEnabled: boolean;
  duty: number;
  dutyPosition: number;
  lengthCounter: number;
  lengthEnabled: boolean;
  frequency: number;
  frequencyTimer: number;
  sweepPeriod: number;
  sweepTimer: number;
  sweepShift: number;
  sweepNegate: boolean;
  sweepShadowFrequency: number;
  sweepEnabled: boolean;
  envelopeInitialVolume: number;
  envelopeVolume: number;
  envelopeDirection: 1 | -1;
  envelopePeriod: number;
  envelopeTimer: number;
}

interface Channel2State {
  enabled: boolean;
  dacEnabled: boolean;
  duty: number;
  dutyPosition: number;
  lengthCounter: number;
  lengthEnabled: boolean;
  frequency: number;
  frequencyTimer: number;
  envelopeInitialVolume: number;
  envelopeVolume: number;
  envelopeDirection: 1 | -1;
  envelopePeriod: number;
  envelopeTimer: number;
}

interface Channel3State {
  enabled: boolean;
  dacEnabled: boolean;
  lengthCounter: number;
  lengthEnabled: boolean;
  frequency: number;
  frequencyTimer: number;
  sampleIndex: number;
  volumeCode: number;
}

interface Channel4State {
  enabled: boolean;
  dacEnabled: boolean;
  lengthCounter: number;
  lengthEnabled: boolean;
  envelopeInitialVolume: number;
  envelopeVolume: number;
  envelopeDirection: 1 | -1;
  envelopePeriod: number;
  envelopeTimer: number;
  clockShift: number;
  dividingRatio: number;
  widthMode7Bit: boolean;
  frequencyTimer: number;
  lfsr: number;
}

export class Apu {
  #bus: SystemBus;
  #masterEnabled = true;
  #internalSampleRate = INTERNAL_SAMPLE_RATE;
  #targetSampleRate = INTERNAL_SAMPLE_RATE;
  #cyclesPerSample = MASTER_CLOCK_HZ / INTERNAL_SAMPLE_RATE;
  #frameSequencerCounter = 0;
  #frameSequencerStep = 0;
  #sampleCycleCounter = 0;
  #rawLeft: number[] = [];
  #rawRight: number[] = [];
  #rawOffset = 0;
  #resampleCursor = 0;
  #lastSample: AudioSample = { left: 0, right: 0 };
  #filter = new HighPassFilter(INTERNAL_SAMPLE_RATE, HIGH_PASS_CUTOFF_HZ);
  #nr50 = 0;
  #nr51 = 0;
  #prevRegisters = {
    nr10: 0,
    nr11: 0,
    nr12: 0,
    nr13: 0,
    nr14: 0,
    nr21: 0,
    nr22: 0,
    nr23: 0,
    nr24: 0,
    nr30: 0,
    nr31: 0,
    nr32: 0,
    nr33: 0,
    nr34: 0,
    nr41: 0,
    nr42: 0,
    nr43: 0,
    nr44: 0,
    nr50: 0,
    nr51: 0,
    nr52: 0,
  };
  constructor(bus: SystemBus) {
    this.#bus = bus;
    this.#masterEnabled = (bus.readByte(NR52_ADDRESS) & 0x80) !== 0;
    this.#syncRegisterCache(true);
  }
  #channel1: Channel1State = {
    enabled: false,
    dacEnabled: true,
    duty: 0,
    dutyPosition: 0,
    lengthCounter: 64,
    lengthEnabled: false,
    frequency: 0,
    frequencyTimer: 0,
    sweepPeriod: 0,
    sweepTimer: 0,
    sweepShift: 0,
    sweepNegate: false,
    sweepShadowFrequency: 0,
    sweepEnabled: false,
    envelopeInitialVolume: 0,
    envelopeVolume: 0,
    envelopeDirection: -1,
    envelopePeriod: 0,
    envelopeTimer: 0,
  };
  #channel2: Channel2State = {
    enabled: false,
    dacEnabled: true,
    duty: 0,
    dutyPosition: 0,
    lengthCounter: 64,
    lengthEnabled: false,
    frequency: 0,
    frequencyTimer: 0,
    envelopeInitialVolume: 0,
    envelopeVolume: 0,
    envelopeDirection: -1,
    envelopePeriod: 0,
    envelopeTimer: 0,
  };
  #channel3: Channel3State = {
    enabled: false,
    dacEnabled: false,
    lengthCounter: 256,
    lengthEnabled: false,
    frequency: 0,
    frequencyTimer: 0,
    sampleIndex: 0,
    volumeCode: 0,
  };
  #channel4: Channel4State = {
    enabled: false,
    dacEnabled: false,
    lengthCounter: 64,
    lengthEnabled: false,
    envelopeInitialVolume: 0,
    envelopeVolume: 0,
    envelopeDirection: -1,
    envelopePeriod: 0,
    envelopeTimer: 0,
    clockShift: 0,
    dividingRatio: 0,
    widthMode7Bit: false,
    frequencyTimer: 0,
    lfsr: 0x7fff,
  };

  setOutputSampleRate(sampleRate: number): void {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      return;
    }
    this.#targetSampleRate = sampleRate;
    this.#filter.setSampleRate(sampleRate);
  }

  clearAudioBuffers(): void {
    this.#clearRawBuffers();
    this.#resampleCursor = 0;
    this.#lastSample = { left: 0, right: 0 };
    this.#filter.reset();
  }

  reset(): void {
    this.#frameSequencerCounter = 0;
    this.#frameSequencerStep = 0;
    this.#sampleCycleCounter = 0;
    this.#clearRawBuffers();
    this.#resampleCursor = 0;
    this.#lastSample = { left: 0, right: 0 };
    this.#filter.reset();
    this.#channel1 = {
      enabled: false,
      dacEnabled: true,
      duty: 0,
      dutyPosition: 0,
      lengthCounter: 64,
      lengthEnabled: false,
      frequency: 0,
      frequencyTimer: this.#computeFrequencyTimer(0),
      sweepPeriod: 0,
      sweepTimer: 0,
      sweepShift: 0,
      sweepNegate: false,
      sweepShadowFrequency: 0,
      sweepEnabled: false,
      envelopeInitialVolume: 0,
      envelopeVolume: 0,
      envelopeDirection: -1,
      envelopePeriod: 0,
      envelopeTimer: 0,
    };
    this.#channel2 = {
      enabled: false,
      dacEnabled: true,
      duty: 0,
      dutyPosition: 0,
      lengthCounter: 64,
      lengthEnabled: false,
      frequency: 0,
      frequencyTimer: this.#computeFrequencyTimer(0),
      envelopeInitialVolume: 0,
      envelopeVolume: 0,
      envelopeDirection: -1,
      envelopePeriod: 0,
      envelopeTimer: 0,
    };
    this.#channel3 = {
      enabled: false,
      dacEnabled: false,
      lengthCounter: 256,
      lengthEnabled: false,
      frequency: 0,
      frequencyTimer: this.#computeFrequencyTimer(0),
      sampleIndex: 0,
      volumeCode: 0,
    };
    this.#channel4 = {
      enabled: false,
      dacEnabled: false,
      lengthCounter: 64,
      lengthEnabled: false,
      envelopeInitialVolume: 0,
      envelopeVolume: 0,
      envelopeDirection: -1,
      envelopePeriod: 0,
      envelopeTimer: 0,
      clockShift: 0,
      dividingRatio: 0,
      widthMode7Bit: false,
      frequencyTimer: NOISE_DIVISOR_TABLE[0],
      lfsr: 0x7fff,
    };
    this.#channel4.frequencyTimer = this.#computeNoisePeriod();
    this.#syncRegisterCache(true);
  }

  tick(cycles: number): void {
    if (cycles <= 0) {
      return;
    }

    this.#syncPowerState();
    this.#syncRegisterCache();

    if (!this.#masterEnabled) {
      return;
    }

    const masterCycles = cycles * 4;
    this.#advanceFrameSequencer(masterCycles);
    this.#stepChannel1(masterCycles);
    this.#stepChannel2(masterCycles);
    this.#stepChannel3(masterCycles);
    this.#stepChannel4(masterCycles);
    this.#mixOutputSamples(masterCycles);
    this.#updateStatusRegister();
  }

  flushSamples(
    targetSampleRate: number,
    targetSampleCount: number,
  ): Float32Array {
    if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
      return new Float32Array(0);
    }
    if (targetSampleCount <= 0) {
      return new Float32Array(0);
    }

    if (targetSampleRate !== this.#targetSampleRate) {
      this.setOutputSampleRate(targetSampleRate);
    }

    const inputRate = this.#internalSampleRate;
    const step = inputRate / targetSampleRate;
    const output = new Float32Array(targetSampleCount * 2);

    for (let i = 0; i < targetSampleCount; i += 1) {
      const sample = this.#dequeueResampledSample(step);
      const filtered = this.#filter.process(sample);
      output[i * 2] = filtered.left;
      output[i * 2 + 1] = filtered.right;
    }

    return output;
  }

  #syncPowerState(): void {
    const nr52Value = this.#bus.readByte(NR52_ADDRESS) & 0xff;
    const masterOn = (nr52Value & 0x80) !== 0;

    if (masterOn === this.#masterEnabled) {
      return;
    }

    this.#masterEnabled = masterOn;

    if (!masterOn) {
      this.#channel1.enabled = false;
      this.#channel1.lengthCounter = 0;
      this.#channel1.dacEnabled = false;
      this.#channel2.enabled = false;
      this.#channel2.lengthCounter = 0;
      this.#channel2.dacEnabled = false;
      this.#channel3.enabled = false;
      this.#channel3.lengthCounter = 0;
      this.#channel3.dacEnabled = false;
      this.#channel4.enabled = false;
      this.#channel4.lengthCounter = 0;
      this.#channel4.dacEnabled = false;
      this.#clearRawBuffers();
      this.#filter.reset();
      this.#sampleCycleCounter = 0;
      this.#frameSequencerCounter = 0;
      this.#frameSequencerStep = 0;
      this.#resampleCursor = 0;
      this.#lastSample = { left: 0, right: 0 };
      this.#writePowerOffRegisters(nr52Value & 0x7f);
      this.#prevRegisters = {
        nr10: 0,
        nr11: 0,
        nr12: 0,
        nr13: 0,
        nr14: 0,
        nr21: 0,
        nr22: 0,
        nr23: 0,
        nr24: 0,
        nr30: 0,
        nr31: 0,
        nr32: 0,
        nr33: 0,
        nr34: 0,
        nr41: 0,
        nr42: 0,
        nr43: 0,
        nr44: 0,
        nr50: 0,
        nr51: 0,
        nr52: nr52Value & 0x7f,
      };
      return;
    }

    // Powering back on.
    this.#frameSequencerCounter = 0;
    this.#frameSequencerStep = 0;
    this.#sampleCycleCounter = 0;
    this.#resampleCursor = 0;
    this.#filter.reset();
    this.#lastSample = { left: 0, right: 0 };
    this.#prevRegisters = {
      nr10: 0,
      nr11: 0,
      nr12: 0,
      nr13: 0,
      nr14: 0,
      nr21: 0,
      nr22: 0,
      nr23: 0,
      nr24: 0,
      nr30: 0,
      nr31: 0,
      nr32: 0,
      nr33: 0,
      nr34: 0,
      nr41: 0,
      nr42: 0,
      nr43: 0,
      nr44: 0,
      nr50: 0,
      nr51: 0,
      nr52: nr52Value,
    };
    this.#channel1.enabled = false;
    this.#channel2.enabled = false;
    this.#channel3.enabled = false;
    this.#channel4.enabled = false;
    this.#syncRegisterCache(true);
  }

  #syncRegisterCache(force = false): void {
    if (!this.#masterEnabled) {
      return;
    }

    const nr10 = this.#bus.readByte(NR10_ADDRESS) & 0xff;
    if (force || nr10 !== this.#prevRegisters.nr10) {
      this.#updateChannel1Sweep(nr10);
      this.#prevRegisters.nr10 = nr10;
    }

    const nr11 = this.#bus.readByte(NR11_ADDRESS) & 0xff;
    if (force || nr11 !== this.#prevRegisters.nr11) {
      this.#updateChannel1Length(nr11);
      this.#prevRegisters.nr11 = nr11;
    }

    const nr12 = this.#bus.readByte(NR12_ADDRESS) & 0xff;
    if (force || nr12 !== this.#prevRegisters.nr12) {
      this.#updateChannel1Envelope(nr12);
      this.#prevRegisters.nr12 = nr12;
    }

    const nr13 = this.#bus.readByte(NR13_ADDRESS) & 0xff;
    if (force || nr13 !== this.#prevRegisters.nr13) {
      this.#updateChannel1FrequencyLow(nr13);
      this.#prevRegisters.nr13 = nr13;
    }

    const nr14 = this.#bus.readByte(NR14_ADDRESS) & 0xff;
    const triggerRequested = (nr14 & 0x80) !== 0;
    const shouldTrigger = triggerRequested && !force;
    if (force || triggerRequested || nr14 !== this.#prevRegisters.nr14) {
      this.#updateChannel1FrequencyHigh(nr14);
      const masked = nr14 & ~0x80; // Treat trigger as write-only so repeated writes retrigger.
      this.#prevRegisters.nr14 = masked;
      if (triggerRequested || force) {
        this.#bus.writeByte(NR14_ADDRESS, masked);
      }
      if (shouldTrigger) {
        this.#triggerChannel1();
      }
    }

    const nr21 = this.#bus.readByte(NR21_ADDRESS) & 0xff;
    if (force || nr21 !== this.#prevRegisters.nr21) {
      this.#updateChannel2Length(nr21);
      this.#prevRegisters.nr21 = nr21;
    }

    const nr22 = this.#bus.readByte(NR22_ADDRESS) & 0xff;
    if (force || nr22 !== this.#prevRegisters.nr22) {
      this.#updateChannel2Envelope(nr22);
      this.#prevRegisters.nr22 = nr22;
    }

    const nr23 = this.#bus.readByte(NR23_ADDRESS) & 0xff;
    if (force || nr23 !== this.#prevRegisters.nr23) {
      this.#updateChannel2FrequencyLow(nr23);
      this.#prevRegisters.nr23 = nr23;
    }

    const nr24 = this.#bus.readByte(NR24_ADDRESS) & 0xff;
    const ch2TriggerRequested = (nr24 & 0x80) !== 0;
    const ch2ShouldTrigger = ch2TriggerRequested && !force;
    if (force || ch2TriggerRequested || nr24 !== this.#prevRegisters.nr24) {
      this.#updateChannel2FrequencyHigh(nr24);
      const masked = nr24 & ~0x80;
      this.#prevRegisters.nr24 = masked;
      if (ch2TriggerRequested || force) {
        this.#bus.writeByte(NR24_ADDRESS, masked);
      }
      if (ch2ShouldTrigger) {
        this.#triggerChannel2();
      }
    }

    const nr30 = this.#bus.readByte(NR30_ADDRESS) & 0xff;
    if (force || nr30 !== this.#prevRegisters.nr30) {
      this.#updateChannel3Dac(nr30);
      this.#prevRegisters.nr30 = nr30;
    }

    const nr31 = this.#bus.readByte(NR31_ADDRESS) & 0xff;
    if (force || nr31 !== this.#prevRegisters.nr31) {
      this.#updateChannel3Length(nr31);
      this.#prevRegisters.nr31 = nr31;
    }

    const nr32 = this.#bus.readByte(NR32_ADDRESS) & 0xff;
    if (force || nr32 !== this.#prevRegisters.nr32) {
      this.#updateChannel3Volume(nr32);
      this.#prevRegisters.nr32 = nr32;
    }

    const nr33 = this.#bus.readByte(NR33_ADDRESS) & 0xff;
    if (force || nr33 !== this.#prevRegisters.nr33) {
      this.#updateChannel3FrequencyLow(nr33);
      this.#prevRegisters.nr33 = nr33;
    }

    const nr34 = this.#bus.readByte(NR34_ADDRESS) & 0xff;
    const ch3TriggerRequested = (nr34 & 0x80) !== 0;
    const ch3ShouldTrigger = ch3TriggerRequested && !force;
    if (force || ch3TriggerRequested || nr34 !== this.#prevRegisters.nr34) {
      this.#updateChannel3FrequencyHigh(nr34);
      const masked = nr34 & ~0x80;
      this.#prevRegisters.nr34 = masked;
      if (ch3TriggerRequested || force) {
        this.#bus.writeByte(NR34_ADDRESS, masked);
      }
      if (ch3ShouldTrigger) {
        this.#triggerChannel3();
      }
    }

    const nr41 = this.#bus.readByte(NR41_ADDRESS) & 0xff;
    if (force || nr41 !== this.#prevRegisters.nr41) {
      this.#updateChannel4Length(nr41);
      this.#prevRegisters.nr41 = nr41;
    }

    const nr42 = this.#bus.readByte(NR42_ADDRESS) & 0xff;
    if (force || nr42 !== this.#prevRegisters.nr42) {
      this.#updateChannel4Envelope(nr42);
      this.#prevRegisters.nr42 = nr42;
    }

    const nr43 = this.#bus.readByte(NR43_ADDRESS) & 0xff;
    if (force || nr43 !== this.#prevRegisters.nr43) {
      this.#updateChannel4Noise(nr43);
      this.#prevRegisters.nr43 = nr43;
    }

    const nr44 = this.#bus.readByte(NR44_ADDRESS) & 0xff;
    const ch4TriggerRequested = (nr44 & 0x80) !== 0;
    const ch4ShouldTrigger = ch4TriggerRequested && !force;
    if (force || ch4TriggerRequested || nr44 !== this.#prevRegisters.nr44) {
      this.#updateChannel4Control(nr44);
      const masked = nr44 & ~0x80;
      this.#prevRegisters.nr44 = masked;
      if (ch4TriggerRequested || force) {
        this.#bus.writeByte(NR44_ADDRESS, masked);
      }
      if (ch4ShouldTrigger) {
        this.#triggerChannel4();
      }
    }

    const nr50 = this.#bus.readByte(NR50_ADDRESS) & 0xff;
    if (force || nr50 !== this.#prevRegisters.nr50) {
      this.#nr50 = nr50;
      this.#prevRegisters.nr50 = nr50;
    }

    const nr51 = this.#bus.readByte(NR51_ADDRESS) & 0xff;
    if (force || nr51 !== this.#prevRegisters.nr51) {
      this.#nr51 = nr51;
      this.#prevRegisters.nr51 = nr51;
    }
  }

  #updateChannel1Sweep(nr10: number): void {
    this.#channel1.sweepPeriod = (nr10 >> 4) & 0x07;
    this.#channel1.sweepNegate = (nr10 & 0x08) !== 0;
    this.#channel1.sweepShift = nr10 & 0x07;
  }

  #updateChannel1Length(nr11: number): void {
    this.#channel1.duty = (nr11 >> 6) & 0x03;
    const lengthData = nr11 & 0x3f;
    const nextLength = 64 - lengthData;
    this.#channel1.lengthCounter = nextLength === 0 ? 64 : nextLength;
  }

  #updateChannel1Envelope(nr12: number): void {
    const initialVolume = (nr12 >> 4) & 0x0f;
    const direction: 1 | -1 = (nr12 & 0x08) !== 0 ? 1 : -1;
    const period = nr12 & 0x07;
    this.#channel1.envelopeInitialVolume = initialVolume;
    this.#channel1.envelopeDirection = direction;
    this.#channel1.envelopePeriod = period;
    if ((nr12 & 0xf8) === 0) {
      this.#channel1.dacEnabled = false;
      this.#channel1.enabled = false;
      return;
    }
    this.#channel1.dacEnabled = true;
  }

  #updateChannel1FrequencyLow(nr13: number): void {
    const frequency = ((this.#prevRegisters.nr14 & 0x07) << 8) | nr13;
    this.#channel1.frequency = frequency & 0x7ff;
  }

  #updateChannel1FrequencyHigh(nr14: number): void {
    const frequency = ((nr14 & 0x07) << 8) | this.#prevRegisters.nr13;
    this.#channel1.frequency = frequency & 0x7ff;
    this.#channel1.lengthEnabled = (nr14 & 0x40) !== 0;
    this.#channel1.frequencyTimer = this.#computeFrequencyTimer(
      this.#channel1.frequency,
    );
  }

  #triggerChannel1(): void {
    if (!this.#channel1.dacEnabled) {
      this.#channel1.enabled = false;
      return;
    }

    if (this.#channel1.lengthCounter === 0) {
      this.#channel1.lengthCounter = 64;
    }

    this.#channel1.enabled = true;
    this.#channel1.dutyPosition = 0;
    this.#channel1.frequencyTimer = this.#computeFrequencyTimer(
      this.#channel1.frequency,
    );

    this.#channel1.envelopeVolume = this.#channel1.envelopeInitialVolume;
    this.#channel1.envelopeTimer =
      this.#channel1.envelopePeriod === 0
        ? 0
        : this.#channel1.envelopePeriod || 8;

    this.#channel1.sweepShadowFrequency = this.#channel1.frequency;
    this.#channel1.sweepEnabled =
      this.#channel1.sweepPeriod > 0 || this.#channel1.sweepShift > 0;
    this.#channel1.sweepTimer = this.#channel1.sweepEnabled
      ? this.#channel1.sweepPeriod || 8
      : 0;

    if (this.#channel1.sweepShift > 0) {
      const next = this.#calculateSweepTarget();
      if (next > 0x7ff) {
        this.#channel1.enabled = false;
      }
    }
  }

  #updateChannel2Length(nr21: number): void {
    this.#channel2.duty = (nr21 >> 6) & 0x03;
    const lengthData = nr21 & 0x3f;
    const nextLength = 64 - lengthData;
    this.#channel2.lengthCounter = nextLength === 0 ? 64 : nextLength;
  }

  #updateChannel2Envelope(nr22: number): void {
    const initialVolume = (nr22 >> 4) & 0x0f;
    const direction: 1 | -1 = (nr22 & 0x08) !== 0 ? 1 : -1;
    const period = nr22 & 0x07;
    this.#channel2.envelopeInitialVolume = initialVolume;
    this.#channel2.envelopeDirection = direction;
    this.#channel2.envelopePeriod = period;
    if ((nr22 & 0xf8) === 0) {
      this.#channel2.dacEnabled = false;
      this.#channel2.enabled = false;
      return;
    }
    this.#channel2.dacEnabled = true;
  }

  #updateChannel2FrequencyLow(nr23: number): void {
    const frequency = ((this.#prevRegisters.nr24 & 0x07) << 8) | nr23;
    this.#channel2.frequency = frequency & 0x7ff;
  }

  #updateChannel2FrequencyHigh(nr24: number): void {
    const frequency = ((nr24 & 0x07) << 8) | this.#prevRegisters.nr23;
    this.#channel2.frequency = frequency & 0x7ff;
    this.#channel2.lengthEnabled = (nr24 & 0x40) !== 0;
    this.#channel2.frequencyTimer = this.#computeFrequencyTimer(
      this.#channel2.frequency,
    );
  }

  #triggerChannel2(): void {
    if (!this.#channel2.dacEnabled) {
      this.#channel2.enabled = false;
      return;
    }

    if (this.#channel2.lengthCounter === 0) {
      this.#channel2.lengthCounter = 64;
    }

    this.#channel2.enabled = true;
    this.#channel2.dutyPosition = 0;
    this.#channel2.frequencyTimer = this.#computeFrequencyTimer(
      this.#channel2.frequency,
    );

    this.#channel2.envelopeVolume = this.#channel2.envelopeInitialVolume;
    this.#channel2.envelopeTimer =
      this.#channel2.envelopePeriod === 0
        ? 0
        : this.#channel2.envelopePeriod || 8;
  }

  #updateChannel3Dac(nr30: number): void {
    const enabled = (nr30 & 0x80) !== 0;
    this.#channel3.dacEnabled = enabled;
    if (!enabled) {
      this.#channel3.enabled = false;
    }
  }

  #updateChannel3Length(nr31: number): void {
    const nextLength = 256 - (nr31 & 0xff);
    this.#channel3.lengthCounter = nextLength === 0 ? 256 : nextLength;
  }

  #updateChannel3Volume(nr32: number): void {
    this.#channel3.volumeCode = (nr32 >> 5) & 0x03;
  }

  #updateChannel3FrequencyLow(nr33: number): void {
    const frequency = ((this.#prevRegisters.nr34 & 0x07) << 8) | nr33;
    this.#channel3.frequency = frequency & 0x7ff;
  }

  #updateChannel3FrequencyHigh(nr34: number): void {
    const frequency = ((nr34 & 0x07) << 8) | this.#prevRegisters.nr33;
    this.#channel3.frequency = frequency & 0x7ff;
    this.#channel3.lengthEnabled = (nr34 & 0x40) !== 0;
    this.#channel3.frequencyTimer = this.#computeFrequencyTimer(
      this.#channel3.frequency,
    );
  }

  #triggerChannel3(): void {
    if (!this.#channel3.dacEnabled) {
      this.#channel3.enabled = false;
      return;
    }

    if (this.#channel3.lengthCounter === 0) {
      this.#channel3.lengthCounter = 256;
    }

    this.#channel3.enabled = true;
    this.#channel3.sampleIndex = 0;
    this.#channel3.frequencyTimer = this.#computeFrequencyTimer(
      this.#channel3.frequency,
    );
  }

  #updateChannel4Length(nr41: number): void {
    const lengthData = nr41 & 0x3f;
    const nextLength = 64 - lengthData;
    this.#channel4.lengthCounter = nextLength === 0 ? 64 : nextLength;
  }

  #updateChannel4Envelope(nr42: number): void {
    const initialVolume = (nr42 >> 4) & 0x0f;
    const direction: 1 | -1 = (nr42 & 0x08) !== 0 ? 1 : -1;
    const period = nr42 & 0x07;
    this.#channel4.envelopeInitialVolume = initialVolume;
    this.#channel4.envelopeDirection = direction;
    this.#channel4.envelopePeriod = period;
    if ((nr42 & 0xf8) === 0) {
      this.#channel4.dacEnabled = false;
      this.#channel4.enabled = false;
      return;
    }
    this.#channel4.dacEnabled = true;
  }

  #updateChannel4Noise(nr43: number): void {
    this.#channel4.dividingRatio = nr43 & 0x07;
    this.#channel4.widthMode7Bit = (nr43 & 0x08) !== 0;
    this.#channel4.clockShift = (nr43 >> 4) & 0x0f;
    this.#channel4.frequencyTimer = this.#computeNoisePeriod();
  }

  #updateChannel4Control(nr44: number): void {
    this.#channel4.lengthEnabled = (nr44 & 0x40) !== 0;
    this.#channel4.frequencyTimer = this.#computeNoisePeriod();
  }

  #triggerChannel4(): void {
    if (!this.#channel4.dacEnabled) {
      this.#channel4.enabled = false;
      return;
    }

    if (this.#channel4.lengthCounter === 0) {
      this.#channel4.lengthCounter = 64;
    }

    this.#channel4.enabled = true;
    this.#channel4.envelopeVolume = this.#channel4.envelopeInitialVolume;
    this.#channel4.envelopeTimer =
      this.#channel4.envelopePeriod === 0
        ? 0
        : this.#channel4.envelopePeriod || 8;
    this.#channel4.frequencyTimer = this.#computeNoisePeriod();
    this.#channel4.lfsr = 0x7fff;
  }

  #advanceFrameSequencer(masterCycles: number): void {
    this.#frameSequencerCounter += masterCycles;
    while (this.#frameSequencerCounter >= FRAME_SEQUENCER_PERIOD) {
      this.#frameSequencerCounter -= FRAME_SEQUENCER_PERIOD;
      this.#frameSequencerStep = (this.#frameSequencerStep + 1) & 0x07;
      this.#clockFrameSequencerStep(this.#frameSequencerStep);
    }
  }

  #clockFrameSequencerStep(step: number): void {
    switch (step) {
      case 0:
      case 2:
      case 4:
      case 6:
        this.#clockChannel1Length();
        this.#clockChannel2Length();
        this.#clockChannel3Length();
        this.#clockChannel4Length();
        if (step === 2 || step === 6) {
          this.#clockChannel1Sweep();
        }
        break;
      case 7:
        this.#clockChannel1Envelope();
        this.#clockChannel2Envelope();
        this.#clockChannel4Envelope();
        break;
      default:
        break;
    }
  }

  #clockChannel1Length(): void {
    if (!this.#channel1.lengthEnabled || this.#channel1.lengthCounter === 0) {
      return;
    }
    this.#channel1.lengthCounter -= 1;
    if (this.#channel1.lengthCounter === 0) {
      this.#channel1.enabled = false;
    }
  }

  #clockChannel1Sweep(): void {
    if (!this.#channel1.sweepEnabled) {
      return;
    }
    if (this.#channel1.sweepTimer > 0) {
      this.#channel1.sweepTimer -= 1;
    }
    if (this.#channel1.sweepTimer > 0) {
      return;
    }

    this.#channel1.sweepTimer = this.#channel1.sweepPeriod || 8;

    const nextFrequency = this.#calculateSweepTarget();
    if (nextFrequency > 0x7ff) {
      this.#channel1.enabled = false;
      return;
    }

    if (this.#channel1.sweepShift > 0) {
      this.#applyFrequency(nextFrequency);
      this.#channel1.sweepShadowFrequency = nextFrequency;
      const overflowCheck = this.#calculateSweepTarget();
      if (overflowCheck > 0x7ff) {
        this.#channel1.enabled = false;
      }
    }
  }

  #clockChannel1Envelope(): void {
    if (
      this.#channel1.envelopePeriod === 0 ||
      this.#channel1.envelopeTimer === 0
    ) {
      return;
    }
    this.#channel1.envelopeTimer -= 1;
    if (this.#channel1.envelopeTimer > 0) {
      return;
    }

    this.#channel1.envelopeTimer =
      this.#channel1.envelopePeriod === 0
        ? 0
        : this.#channel1.envelopePeriod || 8;

    if (
      this.#channel1.envelopeDirection > 0 &&
      this.#channel1.envelopeVolume < 15
    ) {
      this.#channel1.envelopeVolume += 1;
    } else if (
      this.#channel1.envelopeDirection < 0 &&
      this.#channel1.envelopeVolume > 0
    ) {
      this.#channel1.envelopeVolume -= 1;
    } else {
      this.#channel1.envelopeTimer = 0;
    }
  }

  #clockChannel2Length(): void {
    if (!this.#channel2.lengthEnabled || this.#channel2.lengthCounter === 0) {
      return;
    }
    this.#channel2.lengthCounter -= 1;
    if (this.#channel2.lengthCounter === 0) {
      this.#channel2.enabled = false;
    }
  }

  #clockChannel3Length(): void {
    if (!this.#channel3.lengthEnabled || this.#channel3.lengthCounter === 0) {
      return;
    }
    this.#channel3.lengthCounter -= 1;
    if (this.#channel3.lengthCounter === 0) {
      this.#channel3.enabled = false;
    }
  }

  #clockChannel4Length(): void {
    if (!this.#channel4.lengthEnabled || this.#channel4.lengthCounter === 0) {
      return;
    }
    this.#channel4.lengthCounter -= 1;
    if (this.#channel4.lengthCounter === 0) {
      this.#channel4.enabled = false;
    }
  }

  #clockChannel2Envelope(): void {
    if (
      this.#channel2.envelopePeriod === 0 ||
      this.#channel2.envelopeTimer === 0
    ) {
      return;
    }
    this.#channel2.envelopeTimer -= 1;
    if (this.#channel2.envelopeTimer > 0) {
      return;
    }

    this.#channel2.envelopeTimer =
      this.#channel2.envelopePeriod === 0
        ? 0
        : this.#channel2.envelopePeriod || 8;

    if (
      this.#channel2.envelopeDirection > 0 &&
      this.#channel2.envelopeVolume < 15
    ) {
      this.#channel2.envelopeVolume += 1;
    } else if (
      this.#channel2.envelopeDirection < 0 &&
      this.#channel2.envelopeVolume > 0
    ) {
      this.#channel2.envelopeVolume -= 1;
    } else {
      this.#channel2.envelopeTimer = 0;
    }
  }

  #clockChannel4Envelope(): void {
    if (
      this.#channel4.envelopePeriod === 0 ||
      this.#channel4.envelopeTimer === 0
    ) {
      return;
    }
    this.#channel4.envelopeTimer -= 1;
    if (this.#channel4.envelopeTimer > 0) {
      return;
    }

    this.#channel4.envelopeTimer =
      this.#channel4.envelopePeriod === 0
        ? 0
        : this.#channel4.envelopePeriod || 8;

    if (
      this.#channel4.envelopeDirection > 0 &&
      this.#channel4.envelopeVolume < 15
    ) {
      this.#channel4.envelopeVolume += 1;
    } else if (
      this.#channel4.envelopeDirection < 0 &&
      this.#channel4.envelopeVolume > 0
    ) {
      this.#channel4.envelopeVolume -= 1;
    } else {
      this.#channel4.envelopeTimer = 0;
    }
  }

  #stepChannel1(masterCycles: number): void {
    if (!this.#channel1.enabled || !this.#channel1.dacEnabled) {
      return;
    }
    let remaining = masterCycles;
    while (remaining > 0) {
      const step = Math.min(remaining, this.#channel1.frequencyTimer);
      this.#channel1.frequencyTimer -= step;
      remaining -= step;
      if (this.#channel1.frequencyTimer <= 0) {
        this.#channel1.frequencyTimer += this.#computeFrequencyTimer(
          this.#channel1.frequency,
        );
        this.#channel1.dutyPosition = (this.#channel1.dutyPosition + 1) & 0x07;
      }
    }
  }

  #stepChannel2(masterCycles: number): void {
    if (!this.#channel2.enabled || !this.#channel2.dacEnabled) {
      return;
    }
    let remaining = masterCycles;
    while (remaining > 0) {
      const step = Math.min(remaining, this.#channel2.frequencyTimer);
      this.#channel2.frequencyTimer -= step;
      remaining -= step;
      if (this.#channel2.frequencyTimer <= 0) {
        this.#channel2.frequencyTimer += this.#computeFrequencyTimer(
          this.#channel2.frequency,
        );
        this.#channel2.dutyPosition = (this.#channel2.dutyPosition + 1) & 0x07;
      }
    }
  }

  #stepChannel3(masterCycles: number): void {
    if (!this.#channel3.enabled || !this.#channel3.dacEnabled) {
      return;
    }
    let remaining = masterCycles;
    while (remaining > 0) {
      const step = Math.min(remaining, this.#channel3.frequencyTimer);
      this.#channel3.frequencyTimer -= step;
      remaining -= step;
      if (this.#channel3.frequencyTimer <= 0) {
        this.#channel3.frequencyTimer += this.#computeFrequencyTimer(
          this.#channel3.frequency,
        );
        this.#channel3.sampleIndex = (this.#channel3.sampleIndex + 1) & 0x1f;
      }
    }
  }

  #stepChannel4(masterCycles: number): void {
    if (!this.#channel4.enabled || !this.#channel4.dacEnabled) {
      return;
    }
    let remaining = masterCycles;
    while (remaining > 0) {
      const step = Math.min(remaining, this.#channel4.frequencyTimer);
      this.#channel4.frequencyTimer -= step;
      remaining -= step;
      if (this.#channel4.frequencyTimer <= 0) {
        this.#channel4.frequencyTimer += this.#computeNoisePeriod();
        this.#clockNoiseLfsr();
      }
    }
  }

  #mixOutputSamples(masterCycles: number): void {
    this.#sampleCycleCounter += masterCycles;
    while (this.#sampleCycleCounter >= this.#cyclesPerSample) {
      this.#sampleCycleCounter -= this.#cyclesPerSample;
      this.#pushRawSample(this.#mixChannels());
    }
  }

  #mixChannels(): AudioSample {
    const channel1Output = this.#sampleChannel1();
    const channel2Output = this.#sampleChannel2();
    const channel3Output = this.#sampleChannel3();
    const channel4Output = this.#sampleChannel4();

    let leftSum = 0;
    let rightSum = 0;
    let leftCount = 0;
    let rightCount = 0;

    if ((this.#nr51 & 0x10) !== 0) {
      leftSum += channel1Output;
      leftCount += 1;
    }
    if ((this.#nr51 & 0x20) !== 0) {
      leftSum += channel2Output;
      leftCount += 1;
    }
    if ((this.#nr51 & 0x40) !== 0) {
      leftSum += channel3Output;
      leftCount += 1;
    }
    if ((this.#nr51 & 0x80) !== 0) {
      leftSum += channel4Output;
      leftCount += 1;
    }

    if ((this.#nr51 & 0x01) !== 0) {
      rightSum += channel1Output;
      rightCount += 1;
    }
    if ((this.#nr51 & 0x02) !== 0) {
      rightSum += channel2Output;
      rightCount += 1;
    }
    if ((this.#nr51 & 0x04) !== 0) {
      rightSum += channel3Output;
      rightCount += 1;
    }
    if ((this.#nr51 & 0x08) !== 0) {
      rightSum += channel4Output;
      rightCount += 1;
    }

    const leftVolume = ((this.#nr50 >> 4) & 0x07) / 7;
    const rightVolume = (this.#nr50 & 0x07) / 7;

    let left =
      (leftCount > 0 ? leftSum / leftCount : 0) * leftVolume * MASTER_GAIN;
    let right =
      (rightCount > 0 ? rightSum / rightCount : 0) * rightVolume * MASTER_GAIN;

    if (!Number.isFinite(left)) left = 0;
    if (!Number.isFinite(right)) right = 0;

    left = Math.max(-1, Math.min(1, left));
    right = Math.max(-1, Math.min(1, right));

    return { left, right };
  }

  #sampleChannel1(): number {
    return this.#sampleSquareWave(
      this.#channel1.enabled,
      this.#channel1.dacEnabled,
      this.#channel1.duty,
      this.#channel1.dutyPosition,
      this.#channel1.envelopeVolume,
    );
  }

  #sampleChannel2(): number {
    return this.#sampleSquareWave(
      this.#channel2.enabled,
      this.#channel2.dacEnabled,
      this.#channel2.duty,
      this.#channel2.dutyPosition,
      this.#channel2.envelopeVolume,
    );
  }

  #sampleSquareWave(
    enabled: boolean,
    dacEnabled: boolean,
    duty: number,
    dutyPosition: number,
    volume: number,
  ): number {
    if (!enabled || !dacEnabled) {
      return 0;
    }
    const dutyPattern = DUTY_PATTERNS[duty] ?? DUTY_PATTERNS[0];
    const signal = dutyPattern[dutyPosition] ?? 0;
    const wave = signal ? 1 : -1;
    return (wave * volume) / 15;
  }

  #sampleChannel3(): number {
    if (!this.#channel3.enabled || !this.#channel3.dacEnabled) {
      return 0;
    }
    const volumeCode = this.#channel3.volumeCode & 0x03;
    if (volumeCode === 0) {
      return 0;
    }
    const sample = this.#readWaveSample(this.#channel3.sampleIndex);
    const shift = volumeCode - 1;
    const scaled = sample >> shift;
    const normalized = (scaled / 15) * 2 - 1;
    return normalized;
  }

  #sampleChannel4(): number {
    if (!this.#channel4.enabled || !this.#channel4.dacEnabled) {
      return 0;
    }
    const bit = ~this.#channel4.lfsr & 0x01;
    const wave = bit ? 1 : -1;
    return (wave * this.#channel4.envelopeVolume) / 15;
  }

  #readWaveSample(sampleIndex: number): number {
    const index = sampleIndex & 0x1f;
    const byteIndex = index >> 1;
    const address = Math.min(WAVE_TABLE_END, WAVE_TABLE_START + byteIndex);
    const byte = this.#bus.readByte(address) & 0xff;
    if ((index & 0x01) === 0) {
      return (byte >> 4) & 0x0f;
    }
    return byte & 0x0f;
  }

  #clockNoiseLfsr(): void {
    const xor = (this.#channel4.lfsr ^ (this.#channel4.lfsr >> 1)) & 0x01;
    let next = (this.#channel4.lfsr >> 1) | (xor << 14);
    if (this.#channel4.widthMode7Bit) {
      next = (next & ~(1 << 6)) | (xor << 6);
    }
    this.#channel4.lfsr = next & 0x7fff;
  }

  #computeNoisePeriod(): number {
    const divisor =
      NOISE_DIVISOR_TABLE[this.#channel4.dividingRatio & 0x07] ??
      NOISE_DIVISOR_TABLE[0];
    const period = divisor << this.#channel4.clockShift;
    return Math.max(1, period);
  }

  #pushRawSample(sample: AudioSample): void {
    this.#rawLeft.push(sample.left);
    this.#rawRight.push(sample.right);
    this.#lastSample = sample;
    this.#trimRawBacklog();
  }

  #dequeueResampledSample(step: number): AudioSample {
    const available = this.#rawLeft.length - this.#rawOffset;
    if (available <= 0) {
      return this.#lastSample;
    }

    const baseIndex = Math.floor(this.#resampleCursor);
    const frac = this.#resampleCursor - baseIndex;
    const idx0 = this.#rawOffset + baseIndex;
    const idx1 = Math.min(idx0 + 1, this.#rawLeft.length - 1);

    const left0 = this.#rawLeft[idx0] ?? this.#lastSample.left;
    const left1 = this.#rawLeft[idx1] ?? left0;
    const right0 = this.#rawRight[idx0] ?? this.#lastSample.right;
    const right1 = this.#rawRight[idx1] ?? right0;

    const left = left0 + (left1 - left0) * frac;
    const right = right0 + (right1 - right0) * frac;

    this.#resampleCursor += step;
    this.#consumeRawIfNeeded();

    this.#lastSample = { left, right };
    return this.#lastSample;
  }

  #consumeRawIfNeeded(): void {
    const consumed = Math.floor(this.#resampleCursor);
    if (consumed <= 0) {
      return;
    }
    this.#rawOffset += consumed;
    this.#resampleCursor -= consumed;

    if (this.#rawOffset > 2048 && this.#rawOffset * 2 > this.#rawLeft.length) {
      this.#rawLeft = this.#rawLeft.slice(this.#rawOffset);
      this.#rawRight = this.#rawRight.slice(this.#rawOffset);
      this.#rawOffset = 0;
    }
  }

  #clearRawBuffers(): void {
    this.#rawLeft.length = 0;
    this.#rawRight.length = 0;
    this.#rawOffset = 0;
  }

  #trimRawBacklog(): void {
    const backlog = this.#rawLeft.length - this.#rawOffset;
    if (backlog <= MAX_RAW_BACKLOG_SAMPLES) {
      return;
    }
    const drop = backlog - MAX_RAW_BACKLOG_SAMPLES;
    const start = this.#rawOffset + drop;
    this.#rawLeft = this.#rawLeft.slice(start);
    this.#rawRight = this.#rawRight.slice(start);
    this.#rawOffset = 0;
    this.#resampleCursor = 0;
  }

  #calculateSweepTarget(): number {
    if (this.#channel1.sweepShift === 0) {
      return this.#channel1.sweepShadowFrequency;
    }
    const delta =
      this.#channel1.sweepShadowFrequency >> this.#channel1.sweepShift;
    if (this.#channel1.sweepNegate) {
      return this.#channel1.sweepShadowFrequency - delta;
    }
    return this.#channel1.sweepShadowFrequency + delta;
  }

  #applyFrequency(nextFrequency: number): void {
    this.#channel1.frequency = nextFrequency & 0x7ff;
    this.#channel1.frequencyTimer = this.#computeFrequencyTimer(
      this.#channel1.frequency,
    );
    const nr14Base = this.#bus.readByte(NR14_ADDRESS) & 0x78;
    const nr14 = (nr14Base & 0x78) | ((nextFrequency >> 8) & 0x07);
    const nr13 = nextFrequency & 0xff;
    this.#prevRegisters.nr13 = nr13;
    this.#prevRegisters.nr14 = nr14;
    this.#bus.writeByte(NR13_ADDRESS, nr13);
    this.#bus.writeByte(NR14_ADDRESS, nr14);
  }

  #computeFrequencyTimer(frequency: number): number {
    const period = (2048 - Math.max(0, Math.min(2047, frequency))) * 4;
    return Math.max(4, period);
  }

  #writePowerOffRegisters(nr52Value: number): void {
    for (const address of [
      NR10_ADDRESS,
      NR11_ADDRESS,
      NR12_ADDRESS,
      NR13_ADDRESS,
      NR14_ADDRESS,
      NR21_ADDRESS,
      NR22_ADDRESS,
      NR23_ADDRESS,
      NR24_ADDRESS,
      NR30_ADDRESS,
      NR31_ADDRESS,
      NR32_ADDRESS,
      NR33_ADDRESS,
      NR34_ADDRESS,
      NR41_ADDRESS,
      NR42_ADDRESS,
      NR43_ADDRESS,
      NR44_ADDRESS,
      NR50_ADDRESS,
      NR51_ADDRESS,
    ]) {
      this.#bus.writeByte(address, 0);
    }
    this.#bus.writeByte(NR52_ADDRESS, (nr52Value & 0x80) | NR52_CONSTANT_BITS);
    this.#prevRegisters = {
      nr10: 0,
      nr11: 0,
      nr12: 0,
      nr13: 0,
      nr14: 0,
      nr21: 0,
      nr22: 0,
      nr23: 0,
      nr24: 0,
      nr30: 0,
      nr31: 0,
      nr32: 0,
      nr33: 0,
      nr34: 0,
      nr41: 0,
      nr42: 0,
      nr43: 0,
      nr44: 0,
      nr50: 0,
      nr51: 0,
      nr52: nr52Value & 0x7f,
    };
    this.#nr50 = 0;
    this.#nr51 = 0;
  }

  #updateStatusRegister(): void {
    const activeChannelBits =
      (this.#channel1.enabled && this.#channel1.dacEnabled ? 0x01 : 0) |
      (this.#channel2.enabled && this.#channel2.dacEnabled ? 0x02 : 0) |
      (this.#channel3.enabled && this.#channel3.dacEnabled ? 0x04 : 0) |
      (this.#channel4.enabled && this.#channel4.dacEnabled ? 0x08 : 0);
    const base = this.#bus.readByte(NR52_ADDRESS) & 0x80;
    const next = base | NR52_CONSTANT_BITS | activeChannelBits;
    this.#bus.writeByte(NR52_ADDRESS, next);
  }
}
