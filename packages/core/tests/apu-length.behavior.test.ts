import { describe, expect, test } from "vitest";

import { createEmulator } from "../src/emulator.js";

const NR10 = 0xff10;
const NR11 = 0xff11;
const NR12 = 0xff12;
const NR13 = 0xff13;
const NR14 = 0xff14;
const NR21 = 0xff16;
const NR22 = 0xff17;
const NR23 = 0xff18;
const NR24 = 0xff19;
const NR30 = 0xff1a;
const NR31 = 0xff1b;
const NR32 = 0xff1c;
const NR33 = 0xff1d;
const NR34 = 0xff1e;
const NR41 = 0xff20;
const NR42 = 0xff21;
const NR43 = 0xff22;
const NR44 = 0xff23;
const NR52 = 0xff26;

const CYCLES_512HZ = 8192;

describe("APU length counter", () => {
  test("channel status clears when length reaches zero", () => {
    const emulator = createEmulator({
      mode: "dmg",
      callbacks: {
        onVideoFrame: () => {},
        onAudioSamples: () => {},
        onSaveData: () => {},
      },
    });

    // Match the ROM shell init.
    emulator.bus.writeByte(NR52, 0x00);
    emulator.bus.writeByte(NR52, 0x80);
    emulator.bus.writeByte(0xff25, 0xff); // NR51
    emulator.bus.writeByte(0xff24, 0x77); // NR50

    const { apu, bus } = emulator;
    const ticksPerCpu = bus.getTicksPerCpuCycle();
    const sequencerStepCycles = CYCLES_512HZ / ticksPerCpu;

    const cases = [
      {
        name: "square 1",
        mask: 0x01,
        setup: () => {
          bus.writeByte(NR14, 0x40); // length enable
          bus.writeByte(NR11, 0xfc); // length timer = 4
          bus.writeByte(NR12, 0xf0); // DAC on
          bus.writeByte(NR13, 0x00);
          bus.writeByte(NR10, 0x00);
          bus.writeByte(NR14, 0xc0); // trigger + length enable
        },
      },
      {
        name: "square 2",
        mask: 0x02,
        setup: () => {
          bus.writeByte(NR24, 0x40); // length enable
          bus.writeByte(NR21, 0xfc); // length timer = 4
          bus.writeByte(NR22, 0xf0); // DAC on
          bus.writeByte(NR23, 0x00);
          bus.writeByte(NR24, 0xc0); // trigger + length enable
        },
      },
      {
        name: "wave",
        mask: 0x04,
        setup: () => {
          bus.writeByte(NR30, 0x80); // DAC on
          bus.writeByte(NR34, 0x40); // length enable
          bus.writeByte(NR31, 0xfc); // length timer = 4
          bus.writeByte(NR32, 0x20); // non-zero volume shift
          bus.writeByte(NR33, 0x00);
          bus.writeByte(NR34, 0xc0); // trigger + length enable
        },
      },
      {
        name: "noise",
        mask: 0x08,
        setup: () => {
          bus.writeByte(NR44, 0x40); // length enable
          bus.writeByte(NR41, 0xfc); // length timer = 4
          bus.writeByte(NR42, 0xf0); // DAC on
          bus.writeByte(NR43, 0x00);
          bus.writeByte(NR44, 0xc0); // trigger + length enable
        },
      },
    ];

    for (const testCase of cases) {
      bus.writeByte(NR52, 0x00);
      bus.writeByte(NR52, 0x80);
      bus.writeByte(0xff25, 0xff);
      bus.writeByte(0xff24, 0x77);

      testCase.setup();
      expect(bus.readByte(NR52) & testCase.mask).toBe(testCase.mask);

      // After three length clocks the channel should still be on.
      for (let i = 0; i < 5; i += 1) {
        apu.tick(sequencerStepCycles);
      }
      expect(bus.readByte(NR52) & testCase.mask).toBe(testCase.mask);

      // The fourth length clock should clear the status bit.
      for (let i = 0; i < 2; i += 1) {
        apu.tick(sequencerStepCycles);
      }
      expect(bus.readByte(NR52) & testCase.mask).toBe(0);
    }

    emulator.dispose();
  });
});
