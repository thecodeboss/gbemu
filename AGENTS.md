# GBEmu Monorepo Guide

This document orients automation agents and new contributors to the Game Boy Color emulator workspace. It covers repository layout, build targets, runtime architecture, and key reference material. ALWAYS keep this file updated as you make changes.

## Workspace Basics

- Package manager: `pnpm` (see `packageManager` in the root `package.json`).
- TypeScript project references link the packages (root `tsconfig.json` references `packages/core` and `packages/runtime`; `apps/web` composes its own configs).
- Source is distributed across three workspaces:
  - `packages/core` – platform-agnostic emulator logic (CPU/PPU/APU/system bus/clock + ROM helpers).
  - `packages/runtime` – browser-only integrations (Web Workers, Canvas, AudioWorklet, persistence helpers).
  - `apps/web` – React/Vite UI for selecting ROMs and hosting the runtime client.
- Tooling: `rolldown-vite` (Vite's compatibility build that swaps Rollup for the Rust-powered Rolldown bundler per https://vite.dev/guide/rolldown), ESLint (flat config), TypeScript strict mode everywhere.
- Human-facing overview: see `README.md`. Keep README and this guide aligned when tooling, commands, or package responsibilities shift.

## Install & Build

Run all commands from repo root unless noted.

```bash
pnpm install  # bootstrap workspace
pnpm build    # builds all packages/apps
pnpm dev      # start Vite dev server at apps/web
pnpm lint     # runs `eslint . --fix` then `prettier --cache --write .` (expect safe writes)
pnpm test     # runs the @gbemu/core Vitest suite (Mooneye acceptance + emulator-only MBC ROMs)
```

## Linting & Formatting

- ESLint uses the flat config in `eslint.config.mjs`. All `ts/tsx` files extend `@eslint/js` recommended rules plus `@typescript-eslint` recommended, share browser globals, and enable the `unicorn` plugin.
- Key repo-wide rules: `@typescript-eslint/no-unused-vars` warns but ignores `_`-prefixed arguments, `@typescript-eslint/consistent-type-imports` prefers value imports (type annotations still allowed), and `unicorn/filename-case` enforces consistent casing.
- `apps/web` adds React-specific configs (`eslint-plugin-react`, `react-hooks`, and `react-refresh`) so hooks rules and Fast Refresh safety checks will fire in that subtree.
- Tailwind classnames in `apps/web` are linted via `eslint-plugin-tailwindcss@beta` (configured for `cn` and pointed at `apps/web/src/index.css`), with `no-unnecessary-arbitrary-value` warning on replaceable arbitrary utilities (e.g. prefer `hover:-translate-y-px` instead of `hover:-translate-y-[1px]`); a root dev dependency on `tailwindcss@4` lets the plugin resolve the design system while the web app uses Tailwind 4 through `@tailwindcss/vite`.
- Running `pnpm lint` will modify files automatically because of the `--fix` flag and subsequent Prettier write step, so review those changes before committing.

`@gbemu/core` ships Vitest-based Mooneye acceptance ROM tests and emulator-only MBC suites in `packages/core/tests` (hardware mode inferred from ROM name: `cgb` → CGB, `dmg` → DMG); run them with `pnpm --filter @gbemu/core test` (each ROM has a ~10s window to hit the LD B, B sentinel).

## Package Reference

### `@gbemu/core` (`packages/core`)

- Platform-agnostic emulator implementation (DMG defaults) exposing CPU, PPU, APU, system bus, clock, cartridge controllers (`src/mbc/*`), ROM helpers, and the `Emulator` contract (`emulator.ts`). `createEmulator` wires a shared `Clock`, `SystemBus`, `Cpu`, `Ppu`, `Apu`, and `MbcFactory`.
- `Cpu`, `Ppu`, and `Apu` require a `SystemBus` in their constructors; there is no separate connect step.
- `runtime.ts` defines the message protocol shared between workers and the host (`EmulatorWorkerRequestMap`, `EmulatorWorkerEventMap`).
- `input.ts` houses joypad primitives (`JoypadInputState`, `JoypadButton`, helpers); `Emulator#setInputState` writes the active state into P1 ($FF00) via the system bus and raises the joypad interrupt on high→low transitions of P10–P13.
- `EmulatorOptions`/`createEmulator` accept a `mode` (`"dmg"` default or `"cgb"`) and an optional `speedMultiplier` (1× default) that scales frame pacing/audio; CGB mode turns on VRAM/WRAM banking (VBK/SVBK), CGB palette RAM (BCPS/BCPD/OCPS/OCPD) and attr-map rendering, sprite palette/bank selection, HDMA register handling (general/HBlank transfers currently execute immediately), and double-speed toggling via KEY1+STOP. DMG ROMs launched while the hardware mode is CGB are colorized using default compatibility palettes (BG palette 0 + two OBJ palettes). KEY1 writes now log to the console when a speed switch is requested/applied. Call `Emulator#setSpeedMultiplier` at runtime to change pacing without rebuilding.
- CPU power-on defaults now respect CGB mode (A=$11, F=$80, B low bit for GBA detection stays 0, etc.) and CGB-only registers KEY0/KEY1/VBK/SVBK are initialized when applicable.
- Emulator highlights:
  - CPU executes the decoded opcode tables (prefetches instruction bytes, handles HALT/STOP/IME/interrupt servicing, honours conditional jump/call/ret timings, and consumes the per-opcode cycle counts).
  - `SystemBus` seeds DMG power-on register defaults (`$FF00`–`$FFFF`), mirrors ROM/RAM windows via the active MBC, drives DIV/TIMA/TMA/TAC each T-cycle (falling-edge timer increments + delayed TIMA reload/interrupt), handles joypad state + interrupts, and schedules OAM DMA over 640 + 4 T-cycles while blocking OAM accesses. DIV now advances twice per CPU tick in double-speed so timers/APU stay at the real-time 4.19 MHz rate, and DIV resets respect the APU edge mask (bit 4 normal, bit 5 double-speed) for frame-sequencer timing.
  - External RAM mirroring is now dirty-tracked: MBC control writes mark the window dirty, and `dumpMemory`/`SystemBus#refreshExternalRamWindow` repopulate the $A000–$BFFF view so frames avoid copying 8 KiB repeatedly.
  - The bus exposes an IO write listener (sound range `$FF10–$FF77`); the APU subscribes so NRxx register changes are event-driven instead of polled each tick, clearing trigger bits with suppressed callbacks to avoid reentrancy.
  - Frame sequencer clocks length on steps 0/2/4/6, sweep on 2/6, and envelope on 7, synced to the DIV-APU falling edge (DIV bit 4, bit 5 in double-speed). DIV writes while the relevant bit is high will immediately advance the sequencer as on hardware; triggering no longer drops channels that start with volume 0 if the envelope is configured to increase.
  - `Ppu` runs the LCD mode state machine (OAM → XFER → HBLANK/VBLANK), renders BG/window per pixel with live SCX/SCY sampling, draws up to 10 sprites per scanline, and emits a blank frame when LCDC disables the display. Tile map fetches go through the direct VRAM accessor and XFER batches hoist LCDC/scroll/window registers per chunk to reduce bus traffic.
  - CGB palette decoding uses a startup LUT (0x8000 entries) so `decodeCgbColor` is a constant-time table lookup instead of recomputing gamma-corrected colors per call.
  - `Apu` emulates all four channels (square 1 with sweep, square 2, wave, noise) with length/envelope/sweep/LFSR, mixes at 48 kHz, high-pass-filters DC, resamples to the host AudioContext sample rate, caps pending samples to ~50 ms, and only trickles tiny buffers when wall-clock elapsed time is zero to avoid overfilling during catch-up.
- `MbcFactory` detects cartridge type and builds ROM-only, MBC1, MBC2, MBC3, or MBC5 controllers (others default to ROM-only). MBC3 now implements RTC latching/halt/day-carry behavior; RTC state is persisted via `SavePayload.rtc` (even when no external RAM) alongside debounced RAM flushes (~200 ms) before emitting `callbacks.onSaveData`. Loading a save hydrates the active MBC and mirrors it into the bus via `SystemBus#refreshExternalRamWindow`.
- MBC3 RTC snapshots now emit a VBA/BGB-compatible 48-byte trailer (secs/mins/hours/days/control/latched registers + `time_t` seconds) so exported `.sav` files append RTC data (32 KiB + 48 B for carts with RTC). Legacy 16-byte RTC payloads still hydrate correctly when loading older saves.
- Frame pacing targets 59.73 Hz (70224 master cycles) using wall-clock scheduling and scales with the speed multiplier; audio chunk sizes derive from elapsed wall time.
- `src/rom/` groups ROM helpers: `info.ts` parses cartridge metadata (`parseRomInfo`) and `sizes.ts` handles ROM/RAM sizing helpers; `index.ts` re-exports the public surface for consumers.
- A shared DMG palette (`palette.ts`) is exported for the PPU framebuffer and any external tooling so on-screen output and diagnostics can share hues.
- Export surface collected in `src/index.ts`; package compiles to `dist/` via `pnpm --filter @gbemu/core build`.
- Tests: Vitest-based Mooneye acceptance ROMs and emulator-only MBC suites live in `packages/core/tests` (hardware mode inferred from ROM name: `cgb` → CGB, `dmg` → DMG); run them with `pnpm --filter @gbemu/core test` (each ROM has a ~10s window to hit the LD B, B sentinel). Blargg gb-test-roms suites are also covered in `packages/core/tests/gb-test-roms.test.ts`, using either serial output ("Passed") or the $A000 text-out signature (A001-A003 = DE B0 61, running marker $80 at A000, log at A004) for pass/fail; only the individual ROMs are included (bulk runners are skipped per the readmes). Guard tests (`tests/apu-registers.behavior.test.ts`, `tests/apu-length.behavior.test.ts`) verify APU register read masks and that NR52 status bits drop when a channel's length counter expires.

### `@gbemu/runtime` (`packages/runtime`)

- Entry module (`src/index.ts`) re-exports runtime utilities for consumers.
- Worker layer:
  - `src/worker/index.ts` exposes `initializeEmulatorWorker`, wiring Comlink.
  - `src/worker/host.ts` implements `EmulatorWorkerApi`, managing emulator lifecycle, forwarding events to the UI via `WorkerCallbacks`, and ensuring transferable payloads (ROMs, saves, frames, audio samples) copy across thread boundaries.
- `createRuntimeClient.loadRom` accepts optional `{ skipPersistentLoad?: boolean, saveName?: string }` flags to reload a ROM without auto-hydrating IndexedDB saves and to set the active save name before the next battery write (used by the web “Start New Save” flow). It remembers the last opened save per ROM (localStorage) and falls back to the most recently updated save payload before starting a fresh “Save 1”; `loadSave` also accepts an optional `{ name?: string }` to update the active save name used for auto-persistence.
- `src/worker/emulator-worker.ts` is the worker entry and instantiates the core `createEmulator` factory.
- Main thread client:
  - `src/main/runtime-client.ts` provides `createRuntimeClient`, which instantiates the worker, sets up a `Canvas2DRenderer`, and initialises `createEmulatorAudioNode`. Save persistence now defaults on (`autoPersistSaves`), deriving a `SaveStorageKey` from the ROM header title + save name (`createSaveStorageKey`, default “Save 1”) and hydrating matching saves on load if a `SaveStorageAdapter` is supplied.
  - `createRuntimeClient.loadRom` inspects the CGB flag at $0143 (0x80/0xC0 → CGB, otherwise DMG) before telling the worker which hardware mode to use.
  - `createRuntimeClient` forwards `setInputState(state: JoypadInputState)` calls to the worker, which push the state into P1 and trigger the joypad interrupt when lines drop low.
  - `createRuntimeClient.setSpeedMultiplier(multiplier)` forwards pacing changes to the worker (startup option mirrors `speedMultiplier`) so hosts can expose turbo/slow-mo controls without rebuilding the emulator.
  - The `AudioContext.sampleRate` is forwarded to the emulator so the core mixer can resample its 44.1 kHz stream to the actual playback rate before the worklet consumes it. Audio hygiene: pause/reset flush the worklet queue, and the processor drops oldest samples whenever the queued audio exceeds ~50 ms to keep latency bounded.
- Rendering/audio/persistence helpers:
  - `src/video/canvas2d-renderer.ts` wraps a `<canvas>` and handles resizing, drawing frames, and clearing.
  - `src/audio/node.ts` sets up an `AudioWorkletNode` (`worklet-processor.ts` implements the processor) and exposes a queue-based audio API.
  - `src/save/storage.ts` packs saves into a single binary payload (header encodes battery/RTC lengths) and exposes helpers to normalize `SaveStorageKey` values (keys now include optional UUID `id` plus `createSaveStorageKey`, `normalizeSaveGameId`).
  - `src/save/indexeddb-adapter.ts` ships a default IndexedDB-backed adapter with a UUID `id` primary key and a `byGameName` index so hosts can persist multiple save files per ROM title (supports `listNames` for UI listings).
- Shared constants live in `src/constants.ts`.
- Build target: `pnpm --filter @gbemu/runtime build` (tsc emits type declarations and JS to `dist/`).

### `@gbemu/web` (`apps/web`)

- Vite + React front-end (`vite.config.ts` aliases `@gbemu/runtime` to the source tree for hot development).
- `apps/web/tsconfig.app.json` sets `baseUrl` + paths so imports like `@gbemu/core`/`@gbemu/runtime` resolve to source during dev without needing a build.
- `apps/web` declares `@gbemu/core` as a workspace dependency; rebuild core (`pnpm --filter @gbemu/core build`) after changing its exports so editors pick up fresh types.
- When touching the web app, keep core imports lean: use `import type` for core-only types and grab joypad helpers from `@gbemu/core/input` instead of the package index so the main bundle does not pull worker-only modules like `src/apu/*` (subpath exports for `input`/`emulator` are available).
- Shadcn UI components (Tailwind + Radix) provide most primitives; follow https://ui.shadcn.com/docs when touching `apps/web/src/components` so generated styles stay consistent. `components.json` now also registers the Supabase UI registry (`@supabase`). The unused Radix tab/switch UI wrappers were deleted along with the old debug tooling.
- The `cn` helper in `apps/web/src/lib/utils.ts` now wraps `clsx` only (tailwind-merge removed); keep component class strings conflict-free so overrides stay predictable without runtime merging.
- Radix-powered modals live in `src/components/ui/dialog.tsx` + `alert-dialog.tsx`, with a simple `Input` primitive in `ui/input.tsx` for inline edits.
- React Compiler is enabled via `@vitejs/plugin-react` plus `babel-plugin-react-compiler` (see `apps/web/vite.config.ts`); the compiler is now stable, so keep components within its supported patterns (no side effects during render, stable props).
- Supabase auth: a lightweight `SupabaseAuthClient` (`src/lib/supabase-auth-client.ts`) handles OAuth redirects (authorize endpoint), parses callback tokens, fetches the minimal session/user payload, persists it, refreshes tokens, and clears session state on sign-out (no Supabase logout call). `AuthProvider` (`src/hooks/use-auth.tsx`) surfaces `user/session/loading`, `/login` triggers `supabaseAuthClient.redirectToProvider`, and sign-out uses `supabaseAuthClient.signOut`. Supabase Postgres access uses a thin REST wrapper (`SupabasePostgresClient` in `src/lib/supabase.ts`) that hits `/rest/v1/saves` for fetch/upsert/delete and adds `apikey` + bearer from the auth client. Env vars are unchanged (`VITE_SUPABASE_URL` + `VITE_PUBLIC_SUPABASE_ANON_KEY`). There is no Supabase CLI config checked in; supply the env vars directly when running locally.
- `src/hooks/use-current-rom.tsx` holds the current ROM context; `HomePage` writes to it on file/recent selection (and persists to recents) and the emulator hooks react to changes.
- `src/hooks/use-emulator.tsx` owns the runtime, canvas, and audio context; it auto-loads the current ROM when it changes and exposes `isRomLoading`/`romLoadError`.
- `src/hooks/use-save-storage.tsx` centralizes the IndexedDB adapter and save-manager open state; `ManageSavesDialog` consumes it directly.
- `src/hooks/use-gamepad.tsx` always runs and merges hardware + virtual input internally; `enableVirtual` toggles the on-screen pad only.
- The virtual joypad is dynamically imported and only renders on viewports below the `sm` breakpoint (max-width: 639px) to keep the desktop bundle lean.
- `src/app.tsx` derives `phase` directly (`menu`/`loading`/`running` based on ROM + loading state), wires `useAutopause`, and renders without the old `ErrorCard`.
- The web UI is installable as a PWA: manifest + service worker live in `apps/web/public` and register via `registerServiceWorker` in `src/main.tsx`. Replace the placeholder icons in `apps/web/public/icons/` with branded assets and adjust `manifest.webmanifest` if names/colors change; the service worker serves `index.html` network-first to avoid stale asset references.
- Gamepad + keyboard input lives in `src/hooks/use-gamepad.ts`, which polls the Gamepad API for common profiles (DualSense/DualShock/Xbox/Switch Pro/generic) and maps keyboard keys (`A`/`S` = B/A, Backspace = Select, Enter = Start, arrow keys = D-pad) into `RuntimeClient#setInputState`; the emulator feeds P1 with the state and raises the joypad interrupt on new presses.
- Mobile viewports render a floating on-screen joypad (`VirtualJoypad` in `src/components/virtual-joypad.tsx`) with a D-pad, staggered B/A buttons, and Select/Start; its state merges with hardware/keyboard inputs before hitting `RuntimeClient#setInputState`. The D-pad tracks pointer drags to retarget directions without lifting a thumb and uses `touch-action: none` to avoid the page scrolling while held.
- Mobile-only visibility handling pauses the emulator when the tab/app goes out of view and resumes on return so background audio stops without affecting desktop sessions.
- ROMs now start running immediately after selection; the emulator provider handles load/start. The old debug/disassembly/VRAM viewer cards were removed, leaving the emulator route focused on the canvas, saves, fullscreen toggle, and return-to-menu flow.
- The home page shows a **Recently Played** table backed by IndexedDB (`src/lib/recently-played.ts`, UI in `src/components/recently-played-table.tsx` + `components/ui/table.tsx`). Loading any ROM stores its payload + filename so the menu can page through the last-played files (10 per page) and reload one with a row click.
- The in-run display card “Menu” button now asks for confirmation (progress will be lost) and then clears the current ROM to return to the main menu; confirmation UI lives in `apps/web/src/components/return-to-menu-dialog.tsx`.
- ROM loads auto-select DMG vs CGB based on the cartridge header flag at $0143 (0x80/0xC0 → CGB, anything else → DMG); there is no manual toggle in the menu right now.
- Game options live in `src/hooks/use-game-options.tsx` + `components/game-options-dialog.tsx`; the dialog is lazy-loaded (see `components/game-options-dialog.lazy.tsx`) and preloaded on Options hover/focus. Options buttons on the home/emulator views open the modal, and the speed multiplier (0.5x-5x via the `ButtonsRadio` component) forwards to `RuntimeClient#setSpeedMultiplier`.
- Saves auto-persist to IndexedDB via the runtime `createIndexedDbSaveAdapter`, keyed by the ROM header title + active save name (defaults to “Save 1”) so reloads pull the matching battery RAM without depending on the upload filename. The Manage Saves modal reads `runtime` directly to pause/reset/load saves or start fresh; “New Save” reloads without loading/persisting until the game writes battery data.
- Signed-in users also sync saves to Supabase (`saves` table). On login the app pulls all remote saves into IndexedDB and resolves ID conflicts by `updatedAt` (newer wins); local-only changes enqueue upserts/deletes while offline and flush when back online. Save list rows show a synced/pending indicator sourced from the sync queue.
- Save exports now append the 48-byte VBA/BGB RTC trailer when available (RTC save files download as 32 KiB + 48 B); imports accept either plain 32 KiB or appended RTC saves and keep RTC data in `SavePayload.rtc`.
- Dialog flows (return-to-menu + manage saves) are lazy-loaded via dynamic imports; chunks are prefetched on idle (and on Menu/Saves hover/focus) so the first open is instant while keeping them out of the initial bundle. The save manager chunk still only mounts when `isSaveManagerOpen` toggles true.
- Loads worker and audio worklet via `new URL("@gbemu/runtime/src/...")` so Vite bundles the TypeScript modules.
- Uses `DEFAULT_CANVAS_WIDTH/HEIGHT` from the runtime package to size the display.
- Styling in `src/index.css`; entry point `src/main.tsx`.
- UI uses a retro, pixelated theme (Press Start 2P/VT323 fonts, square corners, 3–4px borders/shadows, limited neon-green/yellow palette) defined in `apps/web/src/index.css` and the `ui/*` primitives.
- Development loop: `pnpm --filter @gbemu/web dev`, then open the provided Vite URL.

## Runtime Data Flow

1. The UI calls `createRuntimeClient` with a `Worker` constructor, `AudioContext`, `canvas`, and optional save storage.
2. The runtime sets up:
   - A message channel that Comlink uses to forward worker callbacks (video/audio/save/log/error).
   - A `Canvas2DRenderer` that writes RGBA buffers directly into the canvas.
   - An `EmulatorAudioNode` audio worklet that consumes interleaved stereo samples.
   - The `AudioContext` sample rate is captured up front and forwarded to the worker so the core can resample and high-pass-filter audio before the worklet drains it.
3. When the worker initialises, it wraps callbacks via Comlink and lazy-constructs the emulator implementation supplied by the factory.
4. Emulator events (`onVideoFrame`, `onAudioSamples`, `onSaveData`) clone payloads before transferring them back to the main thread.
5. Persisted saves are keyed by normalized ROM title + save name and will auto-reload when `autoPersistSaves` is enabled (default); `RuntimeClient.loadPersistentSave()` forces a refresh when persistence is disabled.

## Key Contracts & Extension Points

- `Emulator` interface (`packages/core/src/emulator.ts`) defines the minimum functionality required by the runtime. Any real emulator must honour lifecycle methods (`initialize`, `loadRom`, `start`, `pause`, `reset`, `dispose`) and support optional callbacks for logging/error reporting.
- Worker protocol (`packages/core/src/runtime.ts`) enumerates every message type flowing between UI and worker. Keep this file in sync when adding commands/events.
- Save storage adapters must implement `{ read(key), write(key, payload), clear(key) }` keyed by `{ gameId, name }`; helpers in `packages/runtime/src/save/storage.ts` normalize keys from ROM titles.
- Audio pipeline expects interleaved stereo `Float32Array` frames at the sample rate specified by the emulator (`AudioBufferChunk.sampleRate`).
- Canvas renderer requires RGBA8888 buffers sized to match `frame.width` × `frame.height`.

## Future Work Notes

- Extend core compatibility: add MBC2/MBC5/MBC6/MBC7 controllers and bring CGB-mode features online (double-speed timing, color palettes/VRAM banking). Wire `Emulator#restoreState` once save states land.
- Add broader automated coverage (unit tests in `packages/core`, integration tests for the runtime client, lint/test scripts at the root) alongside the Mooneye suite.

## External References

- Game Boy hardware documentation: [gbdev.io/pandocs/CPU_Registers_and_Flags.html](https://gbdev.io/pandocs/CPU_Registers_and_Flags.html)
- Comlink (thread bridge): https://github.com/GoogleChromeLabs/comlink
- Web Audio AudioWorklet docs: https://developer.mozilla.org/docs/Web/API/AudioWorklet
- Rolldown bundler: https://vite.dev/guide/rolldown
- Shadcn UI components: https://ui.shadcn.com/docs
- React Compiler: https://react.dev/learn/react-compiler/introduction

Keep this file updated as packages evolve so future agents have an accurate map of the codebase and workflows. Update `README.md` alongside any notable workflow or command changes so human contributors stay aligned.
