export class Clock {
  static readonly FRAME_CYCLES = 70_224; // 70224 master cycles per Game Boy frame (59.73Hz).

  #masterCycles = 0;
  #listeners = new Set<(deltaCycles: number) => void>();
  #speed = 1;

  get masterCycles(): number {
    return this.#masterCycles;
  }

  step(): void {
    this.#emitTick(1);
  }

  runFrame(): void {
    this.#emitTick(Clock.FRAME_CYCLES);
  }

  setSpeed(multiplier: number): void {
    this.#speed = multiplier;
  }

  onTick(listener: (deltaCycles: number) => void): void {
    this.#listeners.add(listener);
  }

  clearTick(listener: (deltaCycles: number) => void): void {
    this.#listeners.delete(listener);
  }

  #emitTick(deltaCycles: number): void {
    const adjusted = deltaCycles * this.#speed;
    this.#masterCycles += adjusted;
    for (const listener of this.#listeners) {
      listener(adjusted);
    }
  }
}
