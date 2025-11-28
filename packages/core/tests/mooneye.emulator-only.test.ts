import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "vitest";

import {
  MOONEYE_TEST_TIMEOUT_MS,
  collectRomTestCases,
  runMooneyeRomTest,
} from "./mooneye/harness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMULATOR_ONLY_ROM_DIR = path.resolve(
  __dirname,
  "../../../roms/mooneye-test-suite/emulator-only",
);

const romTestCases = collectRomTestCases(EMULATOR_ONLY_ROM_DIR);

if (romTestCases.length === 0) {
  throw new Error(`No emulator-only ROMs found in ${EMULATOR_ONLY_ROM_DIR}`);
}

describe("Mooneye emulator-only ROMs", () => {
  for (const testCase of romTestCases) {
    test(
      testCase.displayName,
      async () => {
        await runMooneyeRomTest(testCase, MOONEYE_TEST_TIMEOUT_MS);
      },
      MOONEYE_TEST_TIMEOUT_MS,
    );
  }
});
