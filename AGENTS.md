# GBEmu Monorepo Guide

This document orients automation agents and new contributors to the Game Boy Color emulator workspace. It covers repository layout, build targets, runtime architecture, and key reference material.

## Workspace Basics

- Package manager: `pnpm` (see `packageManager` in the root `package.json`).
- TypeScript project references link the packages (root `tsconfig.json` references `packages/core` and `packages/runtime`; `apps/web` composes its own configs).
- Source is distributed across three workspaces:
  - `packages/core` – platform-agnostic emulator logic (currently a stub implementation with full type contracts).
  - `packages/runtime` – browser-only integrations (Web Workers, Canvas, AudioWorklet, persistence helpers).
  - `apps/web` – React/Vite UI for selecting ROMs and hosting the runtime client.
- Tooling: Vite (aliased to `rolldown-vite`), ESLint (flat config), TypeScript strict mode everywhere.
- Human-facing overview: see `README.md`. Keep README and this guide aligned when tooling, commands, or package responsibilities shift.

## Install & Build

Run all commands from repo root unless noted.

```bash
pnpm install                    # bootstrap workspace
pnpm --filter @gbemu/core build # emit core type declarations (tsc)
pnpm --filter @gbemu/runtime build
pnpm --filter @gbemu/web dev    # start Vite dev server at apps/web
pnpm --filter @gbemu/web build  # type-check + bundle web app
pnpm lint   # run ESLint across all code
```

No automated tests exist yet (root `test` script is a placeholder). Add package-level tests alongside relevant implementations before enabling CI.

## Package Reference

### `@gbemu/core` (`packages/core`)

- Exposes TypeScript interfaces for CPU, PPU, APU, system buses, clocks, cartridges (`mbc.ts`), and the overarching `Emulator` contract (`emulator.ts`).
- `runtime.ts` defines the message protocol shared between workers and the host (`EmulatorWorkerRequestMap`, `EmulatorWorkerEventMap`).
- `stub-emulator.ts` provides a temporary emulator that:
  - Implements minimal CPU/PPU/APU/bus behavior sufficient to exercise the runtime pipeline.
  - Parses ROM metadata (`parseRomInfo`) but does not execute real instructions.
  - Generates blank audio/video output and supports save serialization with simple RAM banks.
- Export surface collected in `src/index.ts`; package compiles to `dist/` via `pnpm --filter @gbemu/core build`.
- Future real emulator work should replace the stub while satisfying the existing interfaces. Reference hardware documentation at [gbdev.io/pandocs/CPU_Registers_and_Flags.html](https://gbdev.io/pandocs/CPU_Registers_and_Flags.html).

### `@gbemu/runtime` (`packages/runtime`)

- Entry module (`src/index.ts`) re-exports runtime utilities for consumers.
- Worker layer:
  - `src/worker/index.ts` exposes `initializeEmulatorWorker`, wiring Comlink.
  - `src/worker/host.ts` implements `EmulatorWorkerApi`, managing emulator lifecycle, forwarding events to the UI via `WorkerCallbacks`, and ensuring transferable payloads (ROMs, saves, frames, audio samples) copy across thread boundaries.
  - `src/worker/emulator-worker.ts` is the actual worker entry. It currently constructs the stub emulator but is the place to swap in the real implementation.
- Main thread client:
  - `src/main/runtime-client.ts` provides `createRuntimeClient`, which instantiates the worker, sets up a `Canvas2DRenderer`, and initialises `createEmulatorAudioNode`. It also optionally persists saves via `SaveStorageAdapter`.
- Rendering/audio/persistence helpers:
  - `src/video/canvas2d-renderer.ts` wraps a `<canvas>` and handles resizing, drawing frames, and clearing.
  - `src/audio/node.ts` sets up an `AudioWorkletNode` (`worklet-processor.ts` implements the processor) and exposes a queue-based audio API.
  - `src/save/storage.ts` serializes saves to base64 strings with timestamps; callers provide adapter implementations (e.g., IndexedDB, localStorage).
- Shared constants live in `src/constants.ts`.
- Build target: `pnpm --filter @gbemu/runtime build` (tsc emits type declarations and JS to `dist/`).

### `@gbemu/web` (`apps/web`)

- Vite + React front-end (`vite.config.ts` aliases `@gbemu/runtime` to the source tree for hot development).
- `src/App.tsx` manages ROM selection, runtime client lifecycle, and simple UI state machine (`menu` → `loading` → `running`/`error`).
- Loads worker and audio worklet via `new URL("@gbemu/runtime/src/...")` so Vite bundles the TypeScript modules.
- Uses `DEFAULT_CANVAS_WIDTH/HEIGHT` from the runtime package to size the display.
- Styling in `src/index.css`; entry point `src/main.tsx`.
- Development loop: `pnpm --filter @gbemu/web dev`, then open the provided Vite URL.

## Runtime Data Flow

1. The UI calls `createRuntimeClient` with a `Worker` constructor, `AudioContext`, `canvas`, and optional save storage.
2. The runtime sets up:
   - A message channel that Comlink uses to forward worker callbacks (video/audio/save/log/error).
   - A `Canvas2DRenderer` that writes RGBA buffers directly into the canvas.
   - An `EmulatorAudioNode` audio worklet that consumes interleaved stereo samples.
3. When the worker initialises, it wraps callbacks via Comlink and lazy-constructs the emulator implementation supplied by the factory.
4. Emulator events (`onVideoFrame`, `onAudioSamples`, `onSaveData`) clone payloads before transferring them back to the main thread.
5. Persisted saves can be transparently reloaded via `RuntimeClient.loadPersistentSave()`, assuming a `SaveStorageAdapter` is provided and `autoPersistSaves` is enabled.

## Key Contracts & Extension Points

- `Emulator` interface (`packages/core/src/emulator.ts`) defines the minimum functionality required by the runtime. Any real emulator must honour lifecycle methods (`initialize`, `loadRom`, `start`, `pause`, `stepFrame`, `dispose`) and support optional callbacks for logging/error reporting.
- Worker protocol (`packages/core/src/runtime.ts`) enumerates every message type flowing between UI and worker. Keep this file in sync when adding commands/events.
- Save storage adapters must implement `{ read, write, clear }` returning/accepting base64-encoded payloads (`packages/runtime/src/save/storage.ts`).
- Audio pipeline expects interleaved stereo `Float32Array` frames at the sample rate specified by the emulator (`AudioBufferChunk.sampleRate`).
- Canvas renderer requires RGBA8888 buffers sized to match `frame.width` × `frame.height`.

## Future Work Notes

- Replace `createStubEmulator` with genuine CPU/PPU/APU implementations. Use the Pandocs reference and update the runtime only if threading contracts change.
- Add automated tests (unit tests in `packages/core`, integration tests for the runtime client, lint/test scripts at the root).
- Consider wiring persistent storage in the web app (e.g., IndexedDB-backed adapter) once real save data is available.

## External References

- Game Boy hardware documentation: [gbdev.io/pandocs/CPU_Registers_and_Flags.html](https://gbdev.io/pandocs/CPU_Registers_and_Flags.html)
- Comlink (thread bridge): https://github.com/GoogleChromeLabs/comlink
- Web Audio AudioWorklet docs: https://developer.mozilla.org/docs/Web/API/AudioWorklet

Keep this file updated as packages evolve so future agents have an accurate map of the codebase and workflows. Update `README.md` alongside any notable workflow or command changes so human contributors stay aligned.
