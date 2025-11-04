import type { SystemBus } from "./bus.js";

export interface AudioSample {
  left: number;
  right: number;
}

export interface Apu {
  connectBus(bus: SystemBus): void;
  reset(): void;
  tick(cycles: number): void;
  flushSamples(): AudioSample[];
}
