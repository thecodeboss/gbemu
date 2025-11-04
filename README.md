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

> Tip: No automated tests exist yet; contributions should add targeted tests alongside new functionality.
