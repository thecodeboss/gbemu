# GBEmu

Game Boy / Game Boy Color emulator project structured as a pnpm workspace. The repository houses the core emulator implementation (currently a stub), a browser-oriented runtime, and a React web application that boots the emulator in the browser.

The web UI launches the emulator inside a dedicated Web Worker via Comlink, so the main thread stays focused on rendering and input while the worker handles emulation, audio, and save events.

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
- Build the browser runtime package:
  ```bash
  pnpm --filter @gbemu/runtime build
  ```
- Build the core emulator package (emits types/stub implementation):
  ```bash
  pnpm --filter @gbemu/core build
  ```

Open the Vite URL shown in the terminal, select a ROM file (`.gb`, `.gbc`, `.bin`), and the worker-backed runtime will boot the current emulator stub.

### Saves

- Battery-backed RAM auto-persists to IndexedDB using the ROM header title (not the upload filename) and the default save slot. Reloading the same ROM title will restore the last saved RAM snapshot automatically.
- The **Manage Saves** button below the emulator opens a modal to load or rename saves, delete entries, import/export `.sav` files (32 KiB sanity check), and start a new save (blank 32 KiB) via the footer button. Loading or starting a save shows a warning that the current in-game progress will be replaced.

> Tip: The core package now carries Vitest-driven Mooneye acceptance ROM tests (DMG-only) under `packages/core/tests`; run them with `pnpm --filter @gbemu/core test` (each ROM gets ~10s to reach the LD B, B sentinel). Additional coverage alongside new functionality is still welcome.
