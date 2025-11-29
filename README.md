# GBEmu

Game Boy / Game Boy Color emulator project structured as a pnpm workspace. The repository houses the core emulator implementation, a browser-oriented runtime, and a React web application that boots the emulator in the browser.

The web UI launches the emulator inside a dedicated Web Worker via Comlink, so the main thread stays focused on rendering and input while the worker handles emulation, audio, and save events.

The core emulator accepts a `mode` option (`dmg` default, `cgb` for Color) so hosts can boot with CGB palette RAM/attribute maps, VRAM+WRAM banking, sprite palette/bank selection, double-speed toggling via KEY1+STOP, and compatibility palettes to auto-colorize DMG games on CGB hardware.

## Prerequisites

- Node.js 20+
- `pnpm` 10 (see `packageManager` in `package.json`)

## Install

```bash
pnpm install
```

## Run

- Start the web UI (opens Vite dev server):
  ```bash
  pnpm --filter @gbemu/web dev
  ```
  ROMs auto-select DMG vs CGB based on the cartridge header flag at `$0143`.
- Build the browser runtime package:
  ```bash
  pnpm --filter @gbemu/runtime build
  ```
- Build the core emulator package (emits types + implementation):
  ```bash
  pnpm --filter @gbemu/core build
  ```

Open the Vite URL shown in the terminal, select a ROM file (`.gb`, `.gbc`, `.bin`), and the worker-backed runtime will boot the emulator in a worker.

The web UI ships a PWA manifest + service worker so it can be installed on mobile/desktop browsers. Replace the placeholder icons in `apps/web/public/icons/` with branded assets and update `apps/web/public/manifest.webmanifest` if you change names/colors. Add the app to your home screen (iOS Safari/Chrome) or use the browser "Install app" prompt to pin it offline.

### Saves

- Battery-backed RAM auto-persists to IndexedDB using the ROM header title (not the upload filename) and the default save name (“Save 1”). Reloading the same ROM title will restore the last saved RAM snapshot automatically.
- The **Manage Saves** button below the emulator opens a modal to load or rename saves, delete entries, import/export `.sav` files (32 KiB sanity check), and start a new save (blank 32 KiB) via the footer button. Loading or starting a save shows a warning that the current in-game progress will be replaced.

> Tip: The core package now carries Vitest-driven Mooneye acceptance ROM tests (DMG-only) under `packages/core/tests`; run them with `pnpm --filter @gbemu/core test` (each ROM gets ~10s to reach the LD B, B sentinel). Additional coverage alongside new functionality is still welcome.
