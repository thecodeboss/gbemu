const COLOR_MATRIX: [number, number, number][] = [
  // rows correspond to contributions from (R_in, G_in, B_in)
  // to each output channel after normalization
  [1.1510725, 0.1598537, 0.1005957], // for output R
  [-0.025781, 0.7849679, -0.0445331], // for output G
  [-0.0023684, 0.2174921, 1.0847136], // for output B
];

const GAMMA = 1.35;

function applyColorCorrection(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  // Normalize to 0–1
  const rin = r / 255;
  const gin = g / 255;
  const bin = b / 255;

  // Matrix multiply: [rin, gin, bin] * M
  const rLin =
    rin * COLOR_MATRIX[0][0] +
    gin * COLOR_MATRIX[1][0] +
    bin * COLOR_MATRIX[2][0];

  const gLin =
    rin * COLOR_MATRIX[0][1] +
    gin * COLOR_MATRIX[1][1] +
    bin * COLOR_MATRIX[2][1];

  const bLin =
    rin * COLOR_MATRIX[0][2] +
    gin * COLOR_MATRIX[1][2] +
    bin * COLOR_MATRIX[2][2];

  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

  const invGamma = 1 / GAMMA;

  // Apply gamma curve
  const rOut = Math.pow(clamp01(rLin), invGamma);
  const gOut = Math.pow(clamp01(gLin), invGamma);
  const bOut = Math.pow(clamp01(bLin), invGamma);

  const toByte = (x: number) => {
    const v = Math.round(x * 255);
    return v < 0 ? 0 : v > 255 ? 255 : v;
  };

  return [toByte(rOut), toByte(gOut), toByte(bOut)];
}

// Final decode that approximates BGB's look
export function decodeCgbColor(
  low: number,
  high: number,
): [number, number, number, number] {
  const value = ((high & 0x7f) << 8) | (low & 0xff);

  const r5 = value & 0x1f;
  const g5 = (value >> 5) & 0x1f;
  const b5 = (value >> 10) & 0x1f;

  // Same 5-bit → 8-bit scaling you’re already using
  const scale = (component: number) => Math.floor((component / 0x1f) * 255);

  const rawR = scale(r5);
  const rawG = scale(g5);
  const rawB = scale(b5);

  const [r, g, b] = applyColorCorrection(rawR, rawG, rawB);

  return [r, g, b, 0xff];
}
