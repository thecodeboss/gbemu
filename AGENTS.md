# GBEmu Monorepo Guide

This document orients automation agents and new contributors to the Game Boy Color emulator workspace. It covers repository layout, build targets, runtime architecture, and key reference material. ALWAYS keep this file updated as you make changes.

## Workspace Basics

- Package manager: `pnpm` (see `packageManager` in the root `package.json`).
- TypeScript project references link the packages (root `tsconfig.json` references `packages/core` and `packages/runtime`; `apps/web` composes its own configs).
- Source is distributed across three workspaces:
  - `packages/core` – platform-agnostic emulator logic (currently a stub implementation with full type contracts).
  - `packages/runtime` – browser-only integrations (Web Workers, Canvas, AudioWorklet, persistence helpers).
  - `apps/web` – React/Vite UI for selecting ROMs and hosting the runtime client.
- Tooling: `rolldown-vite` (Vite's compatibility build that swaps Rollup for the Rust-powered Rolldown bundler per https://vite.dev/guide/rolldown), ESLint (flat config), TypeScript strict mode everywhere.
- Human-facing overview: see `README.md`. Keep README and this guide aligned when tooling, commands, or package responsibilities shift.

## Install & Build

Run all commands from repo root unless noted.

```bash
pnpm install                    # bootstrap workspace
pnpm --filter @gbemu/core build # emit core type declarations (tsc)
pnpm --filter @gbemu/runtime build
pnpm --filter @gbemu/web dev    # start Vite dev server at apps/web
pnpm --filter @gbemu/web build  # type-check + bundle web app
pnpm lint   # runs `eslint . --fix` then `prettier --cache --write .` (expect safe writes)
```

## Linting & Formatting

- ESLint uses the flat config in `eslint.config.mjs`. All `ts/tsx` files extend `@eslint/js` recommended rules plus `@typescript-eslint` recommended, share browser globals, and enable the `unicorn` plugin.
- Key repo-wide rules: `@typescript-eslint/no-unused-vars` warns but ignores `_`-prefixed arguments, `@typescript-eslint/consistent-type-imports` prefers value imports (type annotations still allowed), and `unicorn/filename-case` enforces consistent casing.
- `apps/web` adds React-specific configs (`eslint-plugin-react`, `react-hooks`, and `react-refresh`) so hooks rules and Fast Refresh safety checks will fire in that subtree.
- Running `pnpm lint` will modify files automatically because of the `--fix` flag and subsequent Prettier write step, so review those changes before committing.

No automated tests exist yet (root `test` script is a placeholder). Add package-level tests alongside relevant implementations before enabling CI.

## Package Reference

### `@gbemu/core` (`packages/core`)

- Exposes TypeScript interfaces for CPU, PPU, APU, system buses, clocks, cartridges (`mbc.ts`), and the overarching `Emulator` contract (`emulator.ts`).
- `runtime.ts` defines the message protocol shared between workers and the host (`EmulatorWorkerRequestMap`, `EmulatorWorkerEventMap`).
- `emulator.ts` currently holds the stubbed `Emulator` class that:
  - Implements minimal CPU/PPU/APU/bus behavior sufficient to exercise the runtime pipeline.
  - Parses ROM metadata (`parseRomInfo`) but does not execute real instructions.
  - Pipes real PPU output via `Ppu#consumeFrame()` (scanline renderer that respects LCD modes, BG/window scroll, and sprite priority) while still faking CPU/APU timing; audio remains a silent placeholder and saves stick to simple RAM banks.
- Debug helpers: `Emulator#getCpuState()` clones registers/flags/IME/cycle state and `Emulator#getMemorySnapshot()` returns a copy of the 64 KiB bus image so tooling can display live diagnostics safely.
- `src/rom/` groups all ROM helpers: `info.ts` parses cartridge metadata (`parseRomInfo`), `sizes.ts` handles ROM/RAM sizing helpers, `disassemble.ts` produces structured `Instruction` objects, and `format.ts` renders them via `formatDisassembledRom`; `index.ts` re-exports the public surface for consumers.
- `ppu.ts` emulates the LCD controller mode state machine (OAM → XFER → HBLANK/VBLANK), updates LY/STAT, fetches tile data from VRAM, renders background/window layers plus up to 10 sprites per scanline into an RGBA framebuffer, and exposes `consumeFrame()` so the emulator can copy completed frames. When LCDC bit 7 disables the LCD, it now emits a single blank frame on the transition but otherwise keeps the flag cleared so the CPU loop continues to advance at full speed instead of short-circuiting every tick.
- `emulator.ts` keeps the frame watchdog warning quiet while the LCD is disabled (it still advances timing via the max-cycle escape hatch so ROMs that intentionally disable the LCD keep running at the same cadence).
- Breakpoints are managed inside `Emulator#setBreakpoints()`, which stores 16-bit offsets, pauses the run loop when the CPU PC matches one while running, and triggers `callbacks.onBreakpointHit` after pausing so hosts can flip into break mode without racing the UI.
- CPU resets now seed the DMG power-on register/flag values (AF=$01B0, BC=$0013, DE=$00D8, HL=$014D, SP=$FFFE) and `SystemBus#loadCartridge()` preloads every DMG hardware register (`$FF00`–`$FFFF`) with the defaults listed in [Pan Docs’ Power-Up Sequence](https://gbdev.io/pandocs/Power_Up_Sequence.html), so debuggers and runtime clients read realistic state right after a ROM loads.
- Cartridge mappers now live in `packages/core/src/mbc.ts`. The factory inspects header byte `$147` to pick a controller (ROM-only or `MBC3` today) and `SystemBus#loadCartridge(rom, mbc)` wires it into the bus so writes to `$2000`–`$3FFF` update the switchable ROM bank (`$4000`–`$7FFF`) and `$4000`–`$5FFF` selects the currently mirrored external RAM bank for `$A000`–`$BFFF`.
- Export surface collected in `src/index.ts`; package compiles to `dist/` via `pnpm --filter @gbemu/core build`.
- Future real emulator work should replace the stub while satisfying the existing interfaces. Reference hardware documentation at [gbdev.io/pandocs/CPU_Registers_and_Flags.html](https://gbdev.io/pandocs/CPU_Registers_and_Flags.html).

### `@gbemu/runtime` (`packages/runtime`)

- Entry module (`src/index.ts`) re-exports runtime utilities for consumers.
- Worker layer:
  - `src/worker/index.ts` exposes `initializeEmulatorWorker`, wiring Comlink.
  - `src/worker/host.ts` implements `EmulatorWorkerApi`, managing emulator lifecycle, forwarding events to the UI via `WorkerCallbacks`, and ensuring transferable payloads (ROMs, saves, frames, audio samples) copy across thread boundaries.
- The worker/client contract exposes `getCpuState` and `getMemorySnapshot`, mirroring the core helpers so front-ends can poll CPU registers/flags and the current memory image without stalling the worker.
- `src/worker/emulator-worker.ts` is the actual worker entry. It currently instantiates the stubbed `Emulator` from `@gbemu/core/src/emulator.ts` but is the place to swap in the real implementation.
- Main thread client:
  - `src/main/runtime-client.ts` provides `createRuntimeClient`, which instantiates the worker, sets up a `Canvas2DRenderer`, and initialises `createEmulatorAudioNode`. It also optionally persists saves via `SaveStorageAdapter`.
  - `createRuntimeClient` exposes a `setBreakpoints(offsets: number[])` method on the returned client and accepts an `onBreakpointHit` option so UIs can be notified when the worker halted on a breakpoint.
- Rendering/audio/persistence helpers:
  - `src/video/canvas2d-renderer.ts` wraps a `<canvas>` and handles resizing, drawing frames, and clearing.
  - `src/audio/node.ts` sets up an `AudioWorkletNode` (`worklet-processor.ts` implements the processor) and exposes a queue-based audio API.
  - `src/save/storage.ts` serializes saves to base64 strings with timestamps; callers provide adapter implementations (e.g., IndexedDB, localStorage).
- Shared constants live in `src/constants.ts`.
- Build target: `pnpm --filter @gbemu/runtime build` (tsc emits type declarations and JS to `dist/`).

### `@gbemu/web` (`apps/web`)

- Vite + React front-end (`vite.config.ts` aliases `@gbemu/runtime` to the source tree for hot development).
- Shadcn UI components (Tailwind + Radix) provide most primitives; follow https://ui.shadcn.com/docs when touching `apps/web/src/components` so generated styles stay consistent.
- React Compiler is enabled via `@vitejs/plugin-react` plus `babel-plugin-react-compiler` (see `apps/web/vite.config.ts`); the compiler is now stable, so keep components within its supported patterns (no side effects during render, stable props).
- `src/app.tsx` manages ROM selection, runtime client lifecycle, and simple UI state machine (`menu` → `loading` → `running`/`error`).
- ROMs now start running immediately after selection; hit Break if you need to pause before inspecting state. Breakpoints still pause automatically when hit.
- The disassembly view adds a leading BP column; clicking a cell toggles a red-circle breakpoint that propagates to the runtime and automatically pauses when the PC hits that offset.
- The debug panel now polls `RuntimeClient.getCpuState()`/`getMemorySnapshot()` to render live CPU register + flag cards and a virtualized memory browser (type/offset/value columns with infinite scroll). Keep the polling cadence reasonable (currently ~750 ms) if runtime performance changes.
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

- Replace the stubbed logic in `packages/core/src/emulator.ts` with genuine CPU/PPU/APU implementations. Use the Pandocs reference and update the runtime only if threading contracts change.
- Add automated tests (unit tests in `packages/core`, integration tests for the runtime client, lint/test scripts at the root).
- Consider wiring persistent storage in the web app (e.g., IndexedDB-backed adapter) once real save data is available.

## External References

- Game Boy hardware documentation: [gbdev.io/pandocs/CPU_Registers_and_Flags.html](https://gbdev.io/pandocs/CPU_Registers_and_Flags.html)
- Comlink (thread bridge): https://github.com/GoogleChromeLabs/comlink
- Web Audio AudioWorklet docs: https://developer.mozilla.org/docs/Web/API/AudioWorklet
- Rolldown bundler: https://vite.dev/guide/rolldown
- Shadcn UI components: https://ui.shadcn.com/docs
- React Compiler: https://react.dev/learn/react-compiler/introduction

Keep this file updated as packages evolve so future agents have an accurate map of the codebase and workflows. Update `README.md` alongside any notable workflow or command changes so human contributors stay aligned.
