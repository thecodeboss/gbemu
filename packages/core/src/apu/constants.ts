import { Clock } from "../clock.js";

export const SOUND_REGISTER_START = 0xff10;
export const SOUND_REGISTER_END = 0xff3f;
export const PCM12_REGISTER = 0xff76;
export const PCM34_REGISTER = 0xff77;

export const CYCLES_512HZ = 8192;
export const MAX_SAMPLE_VALUE = 0x7f;
export const DEFAULT_SAMPLE_RATE = 48_000;
export const MAX_BUFFER_SECONDS = 0.05;
export const MASTER_CLOCK_HZ = 4_194_304;
export const FRAME_RATE_HZ = MASTER_CLOCK_HZ / Clock.FRAME_CYCLES;
export const HIGH_PASS_BASE_DMG = 0.999958;
export const HIGH_PASS_BASE_CGB = 0.998943;
