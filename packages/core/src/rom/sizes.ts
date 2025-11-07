export function decodeRomSize(code: number): number {
  switch (code) {
    case 0x00:
      return 32 * 1024;
    case 0x01:
      return 64 * 1024;
    case 0x02:
      return 128 * 1024;
    case 0x03:
      return 256 * 1024;
    case 0x04:
      return 512 * 1024;
    case 0x05:
      return 1 * 1024 * 1024;
    case 0x06:
      return 2 * 1024 * 1024;
    case 0x07:
      return 4 * 1024 * 1024;
    case 0x08:
      return 8 * 1024 * 1024;
    case 0x52:
      return 1_179_648;
    case 0x53:
      return 1_310_720;
    case 0x54:
      return 1_572_864;
    default:
      return 0;
  }
}

export function decodeRamSize(code: number): number {
  switch (code) {
    case 0x00:
      return 0;
    case 0x01:
      return 2 * 1024;
    case 0x02:
      return 8 * 1024;
    case 0x03:
      return 32 * 1024;
    case 0x04:
      return 128 * 1024;
    case 0x05:
      return 64 * 1024;
    default:
      return 0;
  }
}

export function describeRomSize(byte: number | undefined): string | null {
  if (typeof byte !== "number") {
    return null;
  }
  const size = decodeRomSize(byte);
  if (size <= 0) {
    return null;
  }
  return formatMemorySize(size);
}

export function describeRamSize(byte: number | undefined): string | null {
  if (typeof byte !== "number") {
    return null;
  }
  const size = decodeRamSize(byte);
  if (size <= 0) {
    return null;
  }
  return formatMemorySize(size);
}

function formatMemorySize(size: number): string {
  const mebibyte = 1024 * 1024;
  if (size % mebibyte === 0) {
    return `${size / mebibyte} MiB`;
  }
  if (size % 1024 === 0) {
    return `${size / 1024} KiB`;
  }
  return `${size} bytes`;
}
