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

const ACCEPTANCE_ROM_DIR = path.resolve(
  __dirname,
  "../../../roms/mooneye-test-suite/acceptance",
);
const UNSUPPORTED_MARKERS = [
  "mgb",
  "sgb2",
  "sgb",
  "agb",
  "ags",
  "boot_div",
  "boot_hwio",
  "boot_regs",
];
const romTestCases = collectRomTestCases(ACCEPTANCE_ROM_DIR, {
  unsupportedMarkers: UNSUPPORTED_MARKERS,
});

if (romTestCases.length === 0) {
  throw new Error(`No acceptance ROMs found in ${ACCEPTANCE_ROM_DIR}`);
}

describe("Mooneye acceptance ROMs", () => {
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
