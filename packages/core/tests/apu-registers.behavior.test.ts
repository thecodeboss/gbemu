import { describe, expect, test } from "vitest";

import { createEmulator } from "../src/emulator.js";

const SOUND_START = 0xff10;

// Masks copied from blargg's 01-registers.s (NR10-NR52, then 9 unused sound regs, then 16 wave RAM bytes).
const REGISTER_MASKS = [
  0x80,
  0x3f,
  0x00,
  0xff,
  0xbf, // NR10–NR14
  0xff,
  0x3f,
  0x00,
  0xff,
  0xbf, // NR20–NR24
  0x7f,
  0xff,
  0x9f,
  0xff,
  0xbf, // NR30–NR34
  0xff,
  0xff,
  0x00,
  0x00,
  0xbf, // NR40–NR44
  0x00,
  0x00,
  0x70, // NR50–NR52
  0xff,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff, // unused sound regs FF27–FF2F
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00, // wave RAM
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
];

describe("APU register write/read masks", () => {
  test("matches blargg 01-registers expectations in CGB mode", () => {
    const emulator = createEmulator({
      mode: "cgb",
      callbacks: {
        onVideoFrame: () => {},
        onAudioSamples: () => {},
        onSaveData: () => {},
      },
    });

    // Match the ROM's reset routine.
    emulator.bus.writeByte(0xff26, 0x00); // NR52 off
    emulator.bus.writeByte(0xff26, 0x80); // NR52 on
    emulator.bus.writeByte(0xff25, 0xff); // NR51
    emulator.bus.writeByte(0xff24, 0x77); // NR50

    const failures: string[] = [];

    for (const data of [0x00, 0x01]) {
      for (let offset = 0; offset < REGISTER_MASKS.length; offset += 1) {
        const address = SOUND_START + offset;
        const mask = REGISTER_MASKS[offset];

        // Skip NR52 per the ROM.
        if (address === 0xff26) {
          continue;
        }

        emulator.bus.writeByte(address, data);
        const observed = emulator.bus.readByte(address) & 0xff;
        const expected = (mask | data) & 0xff;
        if (observed !== expected) {
          failures.push(
            `0x${address.toString(16)} wrote 0x${data.toString(16)}, expected 0x${expected.toString(16)}, got 0x${observed.toString(16)}`,
          );
        }

        // Mute + disable wave like the ROM does each iteration.
        emulator.bus.writeByte(0xff25, 0x00);
        emulator.bus.writeByte(0xff1a, 0x00);
      }
    }

    expect(failures).toEqual([]);
    emulator.dispose();
  });
});
