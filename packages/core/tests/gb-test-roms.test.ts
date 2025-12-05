import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "vitest";

import {
  collectRomTestCases,
  makeTestCase,
  runMemoryBackedRomTest,
  runSerialRomTest,
} from "./gb-test-roms/harness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROM_ROOT = path.resolve(__dirname, "../../../roms/gb-test-roms");
const SERIAL_TIMEOUT_MS = 20_000;
const LONG_SERIAL_TIMEOUT_MS = 30_000;
const MEMORY_TIMEOUT_MS = 15_000;

const cpuInstrRoms = collectRomTestCases(
  path.join(ROM_ROOT, "cpu_instrs/individual"),
  "dmg",
  "cpu_instrs/individual",
);

const memTimingRoms = collectRomTestCases(
  path.join(ROM_ROOT, "mem_timing/individual"),
  "dmg",
  "mem_timing/individual",
);

const memTiming2Roms = collectRomTestCases(
  path.join(ROM_ROOT, "mem_timing-2/rom_singles"),
  "dmg",
  "mem_timing-2/rom_singles",
);

const dmgSoundRoms = collectRomTestCases(
  path.join(ROM_ROOT, "dmg_sound/rom_singles"),
  "dmg",
  "dmg_sound/rom_singles",
);

const cgbSoundRoms = collectRomTestCases(
  path.join(ROM_ROOT, "cgb_sound/rom_singles"),
  "cgb",
  "cgb_sound/rom_singles",
);

const oamBugRoms = collectRomTestCases(
  path.join(ROM_ROOT, "oam_bug/rom_singles"),
  "dmg",
  "oam_bug/rom_singles",
);

const interruptTimeRom = makeTestCase(
  ROM_ROOT,
  "interrupt_time/interrupt_time.gb",
  "cgb",
);

const suites = [
  {
    name: "cpu_instrs individual ROMs",
    roms: cpuInstrRoms,
    runner: runSerialRomTest,
    timeout: LONG_SERIAL_TIMEOUT_MS,
  },
  {
    name: "mem_timing individual ROMs",
    roms: memTimingRoms,
    runner: runSerialRomTest,
    timeout: SERIAL_TIMEOUT_MS,
  },
  {
    name: "mem_timing-2 ROM singles",
    roms: memTiming2Roms,
    runner: runMemoryBackedRomTest,
    timeout: MEMORY_TIMEOUT_MS,
  },
  {
    name: "dmg_sound ROM singles",
    roms: dmgSoundRoms,
    runner: runMemoryBackedRomTest,
    timeout: MEMORY_TIMEOUT_MS,
  },
  {
    name: "cgb_sound ROM singles",
    roms: cgbSoundRoms,
    runner: runMemoryBackedRomTest,
    timeout: MEMORY_TIMEOUT_MS,
  },
  {
    name: "oam_bug ROM singles",
    roms: oamBugRoms,
    runner: runMemoryBackedRomTest,
    timeout: MEMORY_TIMEOUT_MS,
  },
];

for (const suite of suites) {
  if (suite.roms.length === 0) {
    throw new Error(`No ROMs found for ${suite.name}`);
  }

  describe(`Blargg ${suite.name}`, () => {
    for (const rom of suite.roms) {
      test(
        rom.displayName,
        async () => {
          await suite.runner(rom, suite.timeout);
        },
        suite.timeout,
      );
    }
  });
}

describe("Blargg interrupt_time", () => {
  test(
    interruptTimeRom.displayName,
    async () => {
      await runSerialRomTest(interruptTimeRom, SERIAL_TIMEOUT_MS);
    },
    SERIAL_TIMEOUT_MS,
  );
});
