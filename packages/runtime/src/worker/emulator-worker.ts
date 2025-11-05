import { createEmulator } from "@gbemu/core";
import { initializeEmulatorWorker } from "./index.js";

initializeEmulatorWorker(async ({ callbacks, audioBufferSize }) => {
  return createEmulator({
    callbacks,
    audioBufferSize,
  });
});
