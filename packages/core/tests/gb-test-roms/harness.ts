import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { Emulator, EmulatorMode } from "../../src/emulator.js";
import { createTestEmulator } from "../mooneye/harness.js";

export interface GbRomTestCase {
  filePath: string;
  displayName: string;
  mode: EmulatorMode;
}

const SERIAL_DATA_ADDRESS = 0xff01;
const SERIAL_CONTROL_ADDRESS = 0xff02;
const MEMORY_RESULT_ADDRESS = 0xa000;
const MEMORY_SIGNATURE_ADDRESS = 0xa001;
const MEMORY_TEXT_ADDRESS = 0xa004;
const MEMORY_RUNNING_VALUE = 0x80;
const MEMORY_SIGNATURE = [0xde, 0xb0, 0x61];
const FOREVER_LOOP_OPCODE = 0x18;
const FOREVER_LOOP_OPERAND = 0xfe;
const FOREVER_LOOP_CONFIRMATION_STEPS = 500;

export function collectRomTestCases(
  directory: string,
  mode: EmulatorMode,
  suitePrefix: string,
): GbRomTestCase[] {
  const cases: GbRomTestCase[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".gb")) {
      continue;
    }
    const displayName = suitePrefix
      ? `${suitePrefix}/${entry.name}`
      : entry.name;
    cases.push({
      filePath: path.join(directory, entry.name),
      displayName,
      mode,
    });
  }
  cases.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return cases;
}

function tapSerialOutput(emulator: Emulator): {
  readText: () => string;
  restore: () => void;
} {
  const bus = emulator.bus as unknown as {
    writeByte: (
      address: number,
      value: number,
      ticksAhead?: number,
      suppressCallbacks?: boolean,
    ) => void;
  };
  const originalWriteByte = bus.writeByte.bind(bus);
  const serialBytes: number[] = [];
  let lastDataByte = 0;

  bus.writeByte = (
    address: number,
    value: number,
    ticksAhead = 0,
    suppressCallbacks = false,
  ) => {
    const mappedAddress = address & 0xffff;
    if (mappedAddress === SERIAL_DATA_ADDRESS) {
      lastDataByte = value & 0xff;
    } else if (
      mappedAddress === SERIAL_CONTROL_ADDRESS &&
      (value & 0x80) !== 0
    ) {
      serialBytes.push(lastDataByte & 0xff);
    }
    originalWriteByte(address, value, ticksAhead, suppressCallbacks);
  };

  return {
    readText: () => String.fromCharCode(...serialBytes),
    restore: () => {
      bus.writeByte = originalWriteByte;
    },
  };
}

function stepEmulator(emulator: Emulator): number {
  const cycles = emulator.cpu.step();
  emulator.bus.tick(cycles);
  emulator.ppu.tick(cycles);
  emulator.apu.tick(cycles);
  for (let i = 0; i < cycles; i += 1) {
    emulator.clock.step();
  }
  return cycles;
}

function truncateSerialOutput(text: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function hasReachedForeverLoop(
  emulator: Emulator,
  previous: { pc: number; repeats: number },
): { pc: number; repeats: number; hitLoop: boolean } {
  const pc = emulator.cpu.state.registers.pc & 0xffff;
  const opcode = emulator.bus.readByte(pc) & 0xff;
  const operand = emulator.bus.readByte((pc + 1) & 0xffff) & 0xff;

  if (
    opcode === FOREVER_LOOP_OPCODE &&
    operand === FOREVER_LOOP_OPERAND &&
    pc === previous.pc
  ) {
    const repeats = previous.repeats + 1;
    return {
      pc,
      repeats,
      hitLoop: repeats > FOREVER_LOOP_CONFIRMATION_STEPS,
    };
  }

  const repeats = opcode === FOREVER_LOOP_OPCODE && operand === FOREVER_LOOP_OPERAND ? 1 : 0;
  return { pc, repeats, hitLoop: false };
}

function readTextOutMemory(emulator: Emulator, limit = 1024): string {
  const bytes: number[] = [];
  for (let offset = 0; offset < limit; offset += 1) {
    const value = emulator.bus.readByte(MEMORY_TEXT_ADDRESS + offset) & 0xff;
    if (value === 0) {
      break;
    }
    bytes.push(value);
  }
  return String.fromCharCode(...bytes);
}

export async function runSerialRomTest(
  testCase: GbRomTestCase,
  timeoutMs: number,
): Promise<void> {
  const emulator = createTestEmulator(testCase.mode);
  const { readText, restore } = tapSerialOutput(emulator);
  let loopState = { pc: -1, repeats: 0, hitLoop: false };
  let steps = 0;

  try {
    const romData = await readFile(testCase.filePath);
    emulator.loadRom(new Uint8Array(romData));

    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      stepEmulator(emulator);
      steps += 1;

      loopState = hasReachedForeverLoop(emulator, loopState);
      const serialLog = readText();
      const lowerLog = serialLog.toLowerCase();
      if (lowerLog.includes("passed")) {
        return;
      }
      if (lowerLog.includes("fail")) {
        throw new Error(
          `ROM reported failure via serial output; log="${truncateSerialOutput(serialLog)}" (steps=${steps})`,
        );
      }
      if (loopState.hitLoop) {
        throw new Error(
          `ROM halted without reporting pass; log="${truncateSerialOutput(serialLog)}" (steps=${steps})`,
        );
      }
    }

    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for serial pass; log="${truncateSerialOutput(readText())}" (steps=${steps})`,
    );
  } finally {
    restore();
    emulator.dispose();
  }
}

export async function runMemoryBackedRomTest(
  testCase: GbRomTestCase,
  timeoutMs: number,
): Promise<void> {
  const emulator = createTestEmulator(testCase.mode);
  const { readText: readSerial, restore } = tapSerialOutput(emulator);
  let signatureSeen = false;
  let steps = 0;
  let passSeen = false;

  try {
    const romData = await readFile(testCase.filePath);
    emulator.loadRom(new Uint8Array(romData));

    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      const serialLog = readSerial();
      const lowerSerial = serialLog.toLowerCase();
      if (lowerSerial.includes("fail")) {
        throw new Error(
          `ROM reported failure via serial output; log="${truncateSerialOutput(serialLog)}" (steps=${steps})`,
        );
      }
      passSeen = passSeen || lowerSerial.includes("passed");

      const textOut = readTextOutMemory(emulator);
      const lowerText = textOut.toLowerCase();

      if (lowerText.includes("failed")) {
        throw new Error(
          `ROM reported failure via text output; log="${truncateSerialOutput(textOut)}" (steps=${steps})`,
        );
      }
      passSeen = passSeen || lowerText.includes("passed");

      const signatureMatches = MEMORY_SIGNATURE.every(
        (byte, index) =>
          (emulator.bus.readByte(MEMORY_SIGNATURE_ADDRESS + index) & 0xff) === byte,
      );
      signatureSeen = signatureSeen || signatureMatches;

      const status = emulator.bus.readByte(MEMORY_RESULT_ADDRESS) & 0xff;
      if (signatureSeen && status !== MEMORY_RUNNING_VALUE) {
        if (status === 0 && !passSeen) {
          throw new Error(
            `ROM stopped with status 0 but without reporting pass; text="${truncateSerialOutput(textOut)}", serial="${truncateSerialOutput(serialLog)}" (steps=${steps})`,
          );
        }
        if (status !== 0) {
          throw new Error(
            `ROM reported failure code 0x${status.toString(16)}; output="${truncateSerialOutput(textOut)}" (steps=${steps})`,
          );
        }
        return;
      }

      stepEmulator(emulator);
      steps += 1;
    }

    const status = emulator.bus.readByte(MEMORY_RESULT_ADDRESS) & 0xff;
    const textOut = readTextOutMemory(emulator);
    const serialLog = readSerial();
    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for memory-backed result; status=0x${status.toString(16)}, signatureSeen=${signatureSeen}, output="${truncateSerialOutput(textOut)}", serial="${truncateSerialOutput(serialLog)}" (steps=${steps})`,
    );
  } finally {
    restore();
    emulator.dispose();
  }
}

export function makeTestCase(
  root: string,
  relativePath: string,
  mode: EmulatorMode,
): GbRomTestCase {
  return {
    filePath: path.join(root, relativePath),
    displayName: relativePath.split(path.sep).join("/"),
    mode,
  };
}
