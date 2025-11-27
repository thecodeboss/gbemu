import { createEmulator } from "@gbemu/core";
import { initializeEmulatorWorker } from "./index.js";

initializeEmulatorWorker(
  async ({ callbacks, audioBufferSize, audioSampleRate, mode }) => {
    return createEmulator({
      callbacks,
      audioBufferSize,
      audioSampleRate,
      mode,
    });
  },
);
