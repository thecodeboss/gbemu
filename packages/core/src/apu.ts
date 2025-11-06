import { SystemBus } from "./bus.js";

export interface AudioSample {
  left: number;
  right: number;
}

export class Apu {
  connectBus(_bus: SystemBus): void {
    // No-op for stub.
  }

  reset(): void {
    // Nothing to reset.
  }

  tick(_cycles: number): void {
    // No timing logic in stub.
  }

  flushSamples(): AudioSample[] {
    return [];
  }
}
