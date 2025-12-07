import { ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const createRomId = (name: string): string => {
  if (name.trim().length > 0) {
    return name;
  }
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
