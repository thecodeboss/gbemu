import { MAX_SAMPLE_VALUE } from "./constants.js";

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function normalizeMixedSample(value: number): number {
  const centered = value / (MAX_SAMPLE_VALUE / 2);
  return clamp(centered, -1, 1);
}
