import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { Emulator, createEmulator } from "../../src/emulator.js";

export const PASS_PATTERN = [3, 5, 8, 13, 21, 34];
export const FAIL_SENTINEL = 0x42;
export const MOONEYE_TEST_TIMEOUT_MS = 10_000;

export interface RomTestCase {
  filePath: string;
  displayName: string;
}

export interface RomExecutionResult {
  registers: number[];
  pass: boolean;
  fail: boolean;
  steps: number;
}

export function collectRomTestCases(
  romDirectory: string,
  options: { unsupportedMarkers?: string[] } = {},
): RomTestCase[] {
  const cases: RomTestCase[] = [];
  const { unsupportedMarkers = [] } = options;

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

      const relativePath = path.relative(romDirectory, fullPath);
      const normalized = relativePath.toLowerCase();
      if (unsupportedMarkers.some((marker) => normalized.includes(marker))) {
        continue;
      }

      cases.push({
        filePath: fullPath,
        displayName: relativePath.split(path.sep).join("/"),
      });
    }
  };

  walk(romDirectory);
  cases.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return cases;
}

export function createTestEmulator(): Emulator {
  return createEmulator({
    callbacks: {
      onVideoFrame: () => {},
      onAudioSamples: () => {},
      onSaveData: () => {},
    },
  });
}

export function formatRegisters(values: number[]): string {
  return values
    .map((value) => `0x${(value & 0xff).toString(16).padStart(2, "0")}`)
    .join(" ");
}

export function runRomUntilCompletion(
  emulator: Emulator,
  rom: Uint8Array,
  timeoutMs: number,
): RomExecutionResult {
  emulator.loadRom(rom);
  const deadline = performance.now() + timeoutMs;
  let steps = 0;

  while (performance.now() < deadline) {
    const pc = emulator.cpu.state.registers.pc & 0xffff;
    const opcode = emulator.bus.readByte(pc) & 0xff;

    if (opcode === 0x40) {
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

export async function runMooneyeRomTest(
  testCase: RomTestCase,
  timeoutMs: number = MOONEYE_TEST_TIMEOUT_MS,
): Promise<void> {
  const emulator = createTestEmulator();
  try {
    const romData = await readFile(testCase.filePath);
    const result = runRomUntilCompletion(
      emulator,
      new Uint8Array(romData),
      timeoutMs,
    );

    if (!result.pass) {
      const reason = result.fail
        ? "ROM reported failure sentinel (0x42)"
        : "ROM finished with unexpected register values";
      throw new Error(
        `${reason}; [B,C,D,E,H,L]=${formatRegisters(result.registers)} (steps: ${result.steps})`,
      );
    }
  } finally {
    emulator.dispose();
  }
}
