import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { Emulator, createEmulator } from "../src/emulator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCEPTANCE_ROM_DIR = path.resolve(
  __dirname,
  "../../../roms/mooneye-test-suite/acceptance",
);
const UNSUPPORTED_MARKERS = [
  "mgb",
  "sgb2",
  "sgb",
  "cgb",
  "agb",
  "ags",
  "boot_div",
  "boot_hwio",
  "boot_regs",
];
const PASS_PATTERN = [3, 5, 8, 13, 21, 34];
const FAIL_SENTINEL = 0x42;
const TEST_TIMEOUT_MS = 10_000;

interface RomTestCase {
  filePath: string;
  displayName: string;
}

function collectRomTestCases(): RomTestCase[] {
  const cases: RomTestCase[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !fullPath.endsWith(".gb")) {
        continue;
      }

      const relativePath = path.relative(ACCEPTANCE_ROM_DIR, fullPath);
      const normalized = relativePath.toLowerCase();
      if (UNSUPPORTED_MARKERS.some((marker) => normalized.includes(marker))) {
        continue;
      }

      cases.push({
        filePath: fullPath,
        displayName: relativePath.split(path.sep).join("/"),
      });
    }
  };

  walk(ACCEPTANCE_ROM_DIR);
  cases.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return cases;
}

function createTestEmulator(): Emulator {
  return createEmulator({
    callbacks: {
      onVideoFrame: () => {},
      onAudioSamples: () => {},
      onSaveData: () => {},
    },
  });
}

function formatRegisters(values: number[]): string {
  return values
    .map((value) => `0x${(value & 0xff).toString(16).padStart(2, "0")}`)
    .join(" ");
}

function runRomUntilCompletion(
  emulator: Emulator,
  rom: Uint8Array,
  timeoutMs: number,
): { registers: number[]; pass: boolean; fail: boolean; steps: number } {
  emulator.loadRom(rom);
  const deadline = performance.now() + timeoutMs;
  let steps = 0;

  while (performance.now() < deadline) {
    const pc = emulator.cpu.state.registers.pc & 0xffff;
    const opcode = emulator.bus.readByte(pc) & 0xff;

    if (opcode === 0x40) {
      // The Mooneye harness signals completion by executing LD B, B with result markers in the registers.
      const { b, c, d, e, h, l } = emulator.cpu.state.registers;
      const registers = [b, c, d, e, h, l].map((value) => value & 0xff);
      const pass = registers.every(
        (value, index) => value === PASS_PATTERN[index],
      );
      const fail = registers.every((value) => value === FAIL_SENTINEL);
      return { registers, pass, fail, steps };
    }

    const cycles = emulator.cpu.step();
    emulator.bus.tick(cycles);
    emulator.ppu.tick(cycles);
    emulator.apu.tick(cycles);
    for (let i = 0; i < cycles; i += 1) {
      emulator.clock.step();
    }
    steps += 1;
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms without executing LD B,B (steps: ${steps})`,
  );
}

const romTestCases = collectRomTestCases();

if (romTestCases.length === 0) {
  throw new Error(`No acceptance ROMs found in ${ACCEPTANCE_ROM_DIR}`);
}

describe("Mooneye acceptance ROMs", () => {
  for (const testCase of romTestCases) {
    test(
      testCase.displayName,
      async () => {
        const emulator = createTestEmulator();
        try {
          const romData = await readFile(testCase.filePath);
          const result = runRomUntilCompletion(
            emulator,
            new Uint8Array(romData),
            TEST_TIMEOUT_MS,
          );

          if (!result.pass) {
            const reason = result.fail
              ? "ROM reported failure sentinel (0x42)"
              : "ROM finished with unexpected register values";
            throw new Error(
              `${reason}; [B,C,D,E,H,L]=${formatRegisters(result.registers)} (steps: ${result.steps})`,
            );
          }

          expect(result.pass).toBe(true);
        } finally {
          emulator.dispose();
        }
      },
      TEST_TIMEOUT_MS,
    );
  }
});
