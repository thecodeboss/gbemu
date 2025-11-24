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
- `input.ts` houses joypad primitives (`JoypadInputState`, `JoypadButton`, helpers) and feeds `Emulator#setInputState`, which writes the active state into P1 ($FF00) via the system bus and raises the joypad interrupt on high→low transitions of P10–P13.
- `emulator.ts` currently holds the stubbed `Emulator` class that:
  - Implements minimal CPU/PPU/bus behavior sufficient to exercise the runtime pipeline (CPU is still stubbed, PPU renders real frames, and APU drives all four audio channels: square 1 with sweep, square 2, wave, and noise).
  - Parses ROM metadata (`parseRomInfo`) but does not execute real instructions.
  - Pipes real PPU output via `Ppu#consumeFrame()` (scanline renderer that respects LCD modes, BG/window scroll, and sprite priority) while mixing audio for all channels (NR10–NR14, NR21–NR24, NR30–NR34, NR41–NR44 routed through NR50/NR51/NR52) with sweep/envelope/length counters, wave playback, noise LFSR, channel routing, a DC-blocking high-pass filter, and an internal 44.1 kHz mix resampled to the host AudioContext sample rate; saves stick to simple RAM banks.
  - Detects external cartridge RAM writes (debounced ~200 ms via MBC callbacks) and emits `callbacks.onSaveData` snapshots so hosts can persist battery-backed RAM; loading a save hydrates the active MBC and mirrors it into the bus via `SystemBus#refreshExternalRamWindow`.
- Debug helpers: `Emulator#getCpuState()` clones registers/flags/IME/cycle state and `Emulator#getMemorySnapshot()` returns a copy of the 64 KiB bus image so tooling can display live diagnostics safely.
- `src/rom/` groups all ROM helpers: `info.ts` parses cartridge metadata (`parseRomInfo`), `sizes.ts` handles ROM/RAM sizing helpers, `disassemble.ts` produces structured `Instruction` objects, and `format.ts` renders them via `formatDisassembledRom`; `index.ts` re-exports the public surface for consumers.
- `ppu.ts` emulates the LCD controller mode state machine (OAM → XFER → HBLANK/VBLANK), updates LY/STAT, fetches tile data from VRAM, renders background/window layers plus up to 10 sprites per scanline into an RGBA framebuffer, and exposes `consumeFrame()` so the emulator can copy completed frames. Mode 3 now steps through visible dots while sampling SCX/SCY per pixel so mid-scanline scroll writes (e.g., Pokemon title screen) apply immediately. When LCDC bit 7 disables the LCD, it now emits a single blank frame on the transition but otherwise keeps the flag cleared so the CPU loop continues to advance at full speed instead of short-circuiting every tick.
- `emulator.ts` keeps the frame watchdog warning quiet while the LCD is disabled (it still advances timing via the max-cycle escape hatch so ROMs that intentionally disable the LCD keep running at the same cadence).
- Frame pacing uses wall-clock scheduling at 59.73 Hz (70224 master cycles per frame) with catch-up scheduling, and audio chunk sizes are derived from wall time to avoid desynchronisation when the worker stalls.
- Breakpoints are managed inside `Emulator#setBreakpoints()`, which stores 16-bit offsets, pauses the run loop when the CPU PC matches one while running, and triggers `callbacks.onBreakpointHit` after pausing so hosts can flip into break mode without racing the UI.
- CPU resets now seed the DMG power-on register/flag values (AF=$01B0, BC=$0013, DE=$00D8, HL=$014D, SP=$FFFE) and `SystemBus#loadCartridge()` preloads every DMG hardware register (`$FF00`–`$FFFF`) with the defaults listed in [Pan Docs’ Power-Up Sequence](https://gbdev.io/pandocs/Power_Up_Sequence.html), so debuggers and runtime clients read realistic state right after a ROM loads.
- Timer registers now live inside `SystemBus#tick`: DIV mirrors the high byte of a 16-bit counter, writes to DIV/TAC can trigger falling-edge ticks per Pan Docs, and TIMA overflows reload TMA one M-cycle later to request the timer interrupt (writing TIMA during the delay cancels the reload/interrupt).
- Writing to `$FF46` now performs an immediate OAM DMA transfer (copies `$XX00`–`$XX9F` into `$FE00`–`$FE9F`); timing penalties are still ignored in the stubbed CPU.
- CPU timing now uses per-opcode machine-cycle tables (with conditional jump/call/ret extras) so PPU/APU ticks advance with realistic instruction costs, improving mid-scanline effects like SCX splits on the Pokémon title screen.
- Cartridge mappers now live in `packages/core/src/mbc.ts`. The factory inspects header byte `$147` to pick a controller (ROM-only, `MBC1` with RAM banking/enable registers, or `MBC3` today) and `SystemBus#loadCartridge(rom, mbc)` wires it into the bus so writes to `$2000`–`$3FFF` update the switchable ROM bank (`$4000`–`$7FFF`) and `$4000`–`$5FFF` selects the currently mirrored external RAM bank for `$A000`–`$BFFF`.
- A shared DMG palette (`palette.ts`) is exported and used by both the PPU framebuffer and UI tooling (Tile Viewer) so debug tools and on-screen output use the same hues.
- Export surface collected in `src/index.ts`; package compiles to `dist/` via `pnpm --filter @gbemu/core build`.
- Future real emulator work should replace the stub while satisfying the existing interfaces. Reference hardware documentation at [gbdev.io/pandocs/CPU_Registers_and_Flags.html](https://gbdev.io/pandocs/CPU_Registers_and_Flags.html).

### `@gbemu/runtime` (`packages/runtime`)

- Entry module (`src/index.ts`) re-exports runtime utilities for consumers.
- Worker layer:
  - `src/worker/index.ts` exposes `initializeEmulatorWorker`, wiring Comlink.
  - `src/worker/host.ts` implements `EmulatorWorkerApi`, managing emulator lifecycle, forwarding events to the UI via `WorkerCallbacks`, and ensuring transferable payloads (ROMs, saves, frames, audio samples) copy across thread boundaries.
- `createRuntimeClient.loadRom` accepts an optional `{ skipPersistentLoad?: boolean }` flag to reload a ROM without auto-hydrating IndexedDB saves (used by the web “Start New Save” flow). `loadSave` also accepts an optional `{ slot?: string }` to update the active save slot used for auto-persistence.
- The worker/client contract exposes `getCpuState` and `getMemorySnapshot`, mirroring the core helpers so front-ends can poll CPU registers/flags and the current memory image without stalling the worker.
- `src/worker/emulator-worker.ts` is the actual worker entry. It currently instantiates the stubbed `Emulator` from `@gbemu/core/src/emulator.ts` but is the place to swap in the real implementation.
- Main thread client:
  - `src/main/runtime-client.ts` provides `createRuntimeClient`, which instantiates the worker, sets up a `Canvas2DRenderer`, and initialises `createEmulatorAudioNode`. Save persistence now defaults on (`autoPersistSaves`), deriving a `SaveStorageKey` from the ROM header title + slot (`createSaveStorageKey`) and hydrating matching saves on load if a `SaveStorageAdapter` is supplied.
  - `createRuntimeClient` exposes a `setBreakpoints(offsets: number[])` method on the returned client and accepts an `onBreakpointHit` option so UIs can be notified when the worker halted on a breakpoint. It also forwards `setInputState(state: JoypadInputState)` calls to the worker, which push the state into P1 and trigger the joypad interrupt when lines drop low.
  - The `AudioContext.sampleRate` is forwarded to the emulator so the core mixer can resample its 44.1 kHz stream to the actual playback rate before the worklet consumes it.
- Rendering/audio/persistence helpers:
  - `src/video/canvas2d-renderer.ts` wraps a `<canvas>` and handles resizing, drawing frames, and clearing.
  - `src/audio/node.ts` sets up an `AudioWorkletNode` (`worklet-processor.ts` implements the processor) and exposes a queue-based audio API.
  - `src/save/storage.ts` serializes saves to base64 strings with timestamps and exposes helpers to normalize `SaveStorageKey` values (`createSaveStorageKey`, `normalizeSaveGameId`, default slot `default`).
  - `src/save/indexeddb-adapter.ts` ships a default IndexedDB-backed adapter keyed by `{ gameId, slot }` so hosts can persist multiple save files per ROM title.
- Shared constants live in `src/constants.ts`.
- Build target: `pnpm --filter @gbemu/runtime build` (tsc emits type declarations and JS to `dist/`).

### `@gbemu/web` (`apps/web`)

- Vite + React front-end (`vite.config.ts` aliases `@gbemu/runtime` to the source tree for hot development).
- `apps/web/tsconfig.app.json` sets `baseUrl` + paths so imports like `@gbemu/core`/`@gbemu/runtime` resolve to source during dev without needing a build.
- `apps/web` declares `@gbemu/core` as a workspace dependency; rebuild core (`pnpm --filter @gbemu/core build`) after changing its exports so editors pick up fresh types.
- Shadcn UI components (Tailwind + Radix) provide most primitives; follow https://ui.shadcn.com/docs when touching `apps/web/src/components` so generated styles stay consistent.
- Radix-powered modals live in `src/components/ui/dialog.tsx` + `alert-dialog.tsx`, with a simple `Input` primitive in `ui/input.tsx` for inline edits.
- React Compiler is enabled via `@vitejs/plugin-react` plus `babel-plugin-react-compiler` (see `apps/web/vite.config.ts`); the compiler is now stable, so keep components within its supported patterns (no side effects during render, stable props).
- `src/app.tsx` manages ROM selection, runtime client lifecycle, and simple UI state machine (`menu` → `loading` → `running`/`error`).
- Gamepad input lives in `src/hooks/use-gamepad.ts`, which polls the Gamepad API for a DualSense and maps buttons (0=A, 2=B, 8=Select, 9=Start, 12-15=D-pad) into `RuntimeClient#setInputState`; the emulator feeds P1 with the state and raises the joypad interrupt on new presses.
- ROMs now start running immediately after selection; hit Break if you need to pause before inspecting state. Breakpoints still pause automatically when hit.
- Saves auto-persist to IndexedDB via the runtime `createIndexedDbSaveAdapter`, keyed by the ROM header title + default slot so reloads pull the matching battery RAM without depending on the upload filename.
- The main emulator card now includes a **Manage Saves** button. The modal lists IndexedDB saves for the current ROM, lets users rename slots, export `.sav` files, import 32 KiB `.sav` payloads (auto-named “Untitled N”), delete saves, and load saves behind a destructive-warning prompt. It also offers a “+ Start New Save” footer action that creates a blank 32 KiB save, warns about losing current progress, and reloads the ROM with that slot while keeping breakpoints.
- The main emulator card now includes a **Manage Saves** button. The modal lists IndexedDB saves for the current ROM, lets users rename slots, export `.sav` files, import 32 KiB `.sav` payloads (auto-named “Untitled N”), and load saves behind a destructive-warning prompt. It also offers a “Start Without Save” action that reloads the ROM without applying stored RAM.
- The disassembly view adds a leading BP column; clicking a cell toggles a red-circle breakpoint that propagates to the runtime and automatically pauses when the PC hits that offset.
- The debug panel now polls `RuntimeClient.getCpuState()`/`getMemorySnapshot()` to render live CPU register + flag cards and a virtualized memory browser (type/offset/value columns with infinite scroll). Keep the polling cadence reasonable (currently ~750 ms) if runtime performance changes.
- The VRAM Viewer card (next to ROM Debug) houses tabs for BG/Tiles/OAM/Palettes; the Tiles tab renders VRAM tiles for $8000–$97FF in three 16×8 sections (blocks at $8000, $8800, $9000), scaling tiles 2× with 1px grey gutters and a 4px separator between sections.
- Loads worker and audio worklet via `new URL("@gbemu/runtime/src/...")` so Vite bundles the TypeScript modules.
- Uses `DEFAULT_CANVAS_WIDTH/HEIGHT` from the runtime package to size the display.
- Styling in `src/index.css`; entry point `src/main.tsx`.
- Development loop: `pnpm --filter @gbemu/web dev`, then open the provided Vite URL.
- Shadcn UI primitives live under `src/components/ui/`; Tabs now uses `@radix-ui/react-tabs` via `tabs.tsx` for BG/Tiles/OAM/Palette viewers.
- VRAM viewer components live in `apps/web/src/components/vram-viewer/` (`index.tsx` card + tab components; the tiles renderer lives in `tiles-tab.tsx`).

## Runtime Data Flow

1. The UI calls `createRuntimeClient` with a `Worker` constructor, `AudioContext`, `canvas`, and optional save storage.
2. The runtime sets up:
   - A message channel that Comlink uses to forward worker callbacks (video/audio/save/log/error).
   - A `Canvas2DRenderer` that writes RGBA buffers directly into the canvas.
   - An `EmulatorAudioNode` audio worklet that consumes interleaved stereo samples.
   - The `AudioContext` sample rate is captured up front and forwarded to the worker so the core can resample and high-pass-filter audio before the worklet drains it.
3. When the worker initialises, it wraps callbacks via Comlink and lazy-constructs the emulator implementation supplied by the factory.
4. Emulator events (`onVideoFrame`, `onAudioSamples`, `onSaveData`) clone payloads before transferring them back to the main thread.
5. Persisted saves are keyed by normalized ROM title + slot and will auto-reload when `autoPersistSaves` is enabled (default); `RuntimeClient.loadPersistentSave()` forces a refresh when persistence is disabled.

## Key Contracts & Extension Points

- `Emulator` interface (`packages/core/src/emulator.ts`) defines the minimum functionality required by the runtime. Any real emulator must honour lifecycle methods (`initialize`, `loadRom`, `start`, `pause`, `stepFrame`, `dispose`) and support optional callbacks for logging/error reporting.
- Worker protocol (`packages/core/src/runtime.ts`) enumerates every message type flowing between UI and worker. Keep this file in sync when adding commands/events.
- Save storage adapters must implement `{ read(key), write(key, payload), clear(key) }` keyed by `{ gameId, slot }` (slot defaults to `default`); helpers in `packages/runtime/src/save/storage.ts` normalize keys from ROM titles.
- Audio pipeline expects interleaved stereo `Float32Array` frames at the sample rate specified by the emulator (`AudioBufferChunk.sampleRate`).
- Canvas renderer requires RGBA8888 buffers sized to match `frame.width` × `frame.height`.

## Future Work Notes

- Replace the stubbed logic in `packages/core/src/emulator.ts` with genuine CPU/PPU work; APU mixing for channels 1–4 is present but should be validated against hardware tests. Use the Pandocs reference and update the runtime only if threading contracts change.
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
