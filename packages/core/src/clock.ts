export interface Clock {
  readonly masterCycles: number;
  step(): void;
  runFrame(): void;
  setSpeed(multiplier: number): void;
  onTick(listener: (deltaCycles: number) => void): void;
  clearTick(listener: (deltaCycles: number) => void): void;
}
