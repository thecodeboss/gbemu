export function formatHexByte(value: number): string {
  const hex = value.toString(16).toUpperCase().padStart(2, "0");
  return `0x${hex} (${value})`;
}

export function formatByteSize(size: number): string {
  if (!size) {
    return "0 B";
  }
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded =
    value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]} (${size.toLocaleString()} bytes)`;
}

export function formatAddress(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function formatHexValue(value: number, pad: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(pad, "0")}`;
}
