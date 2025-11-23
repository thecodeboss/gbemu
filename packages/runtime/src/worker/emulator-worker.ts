import { createEmulator } from "@gbemu/core";
import { initializeEmulatorWorker } from "./index.js";

initializeEmulatorWorker(
  async ({ callbacks, audioBufferSize, audioSampleRate }) => {
    return createEmulator({
      callbacks,
      audioBufferSize,
      audioSampleRate,
    });
  },
);
