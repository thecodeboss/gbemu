import * as Comlink from "comlink";
import type { EmulatorFactory } from "./host.js";
import { createWorkerHost } from "./host.js";

declare const self: DedicatedWorkerGlobalScope;

export function initializeEmulatorWorker(factory: EmulatorFactory): void {
  const host = createWorkerHost(factory);
  Comlink.expose(host);
}

export type { EmulatorWorkerApi, WorkerCallbacks } from "./host.js";
