import { createStubEmulator } from "@gbemu/core";
import { initializeEmulatorWorker } from "./index.js";

initializeEmulatorWorker(async ({ callbacks, audioBufferSize }) => {
  return createStubEmulator({
    callbacks,
    audioBufferSize,
  });
});
