import { decodeRamSize } from "../rom/sizes.js";
import { MbcOptions, MbcType } from "./base.js";
import { Mbc } from "./base.js";
import { Mbc1Controller } from "./mbc1.js";
import { Mbc2Controller } from "./mbc2.js";
import { Mbc3Controller } from "./mbc3.js";
import { Mbc5Controller } from "./mbc5.js";
import { RomOnlyMbc } from "./rom-only.js";

interface CartridgeTypeMetadata {
  mbc: MbcType;
  hasRam?: boolean;
  battery?: boolean;
  rtc?: boolean;
  rumble?: boolean;
  forceRamSize?: number;
}

const CARTRIDGE_TYPE_TABLE: Record<number, CartridgeTypeMetadata> = {
  0x00: { mbc: "romOnly" },
  0x01: { mbc: "mbc1" },
  0x02: { mbc: "mbc1", hasRam: true },
  0x03: { mbc: "mbc1", hasRam: true, battery: true },
  0x05: { mbc: "mbc2", hasRam: true, forceRamSize: 512 },
  0x06: { mbc: "mbc2", hasRam: true, battery: true, forceRamSize: 512 },
  0x08: { mbc: "romOnly", hasRam: true },
  0x09: { mbc: "romOnly", hasRam: true, battery: true },
  0x0f: { mbc: "mbc3", rtc: true, battery: true },
  0x10: { mbc: "mbc3", hasRam: true, rtc: true, battery: true },
  0x11: { mbc: "mbc3" },
  0x12: { mbc: "mbc3", hasRam: true },
  0x13: { mbc: "mbc3", hasRam: true, battery: true },
  0x19: { mbc: "mbc5" },
  0x1a: { mbc: "mbc5", hasRam: true },
  0x1b: { mbc: "mbc5", hasRam: true, battery: true },
  0x1c: { mbc: "mbc5", rumble: true },
  0x1d: { mbc: "mbc5", hasRam: true, rumble: true },
  0x1e: { mbc: "mbc5", hasRam: true, battery: true, rumble: true },
};

export class MbcFactory {
  describeCartridge(
    rom: Uint8Array,
    romInfo?: { cartridgeType?: number; ramSize?: number } | null,
  ): {
    type: MbcType;
    ramSize: number;
    batteryBacked: boolean;
    hasRtc: boolean;
    hasRumble: boolean;
  } {
    const typeByte = romInfo?.cartridgeType ?? rom[0x147] ?? 0x00;
    const meta = CARTRIDGE_TYPE_TABLE[typeByte] ?? { mbc: "romOnly" };
    const ramAllowed = meta.hasRam ?? false;
    const headerRamSize = romInfo?.ramSize ?? decodeRamSize(rom[0x149] ?? 0x00);
    let ramSize = meta.forceRamSize ?? (ramAllowed ? headerRamSize : 0);
    if (!ramAllowed) {
      ramSize = 0;
    }
    return {
      type: meta.mbc,
      ramSize,
      batteryBacked: Boolean(meta.battery || meta.rtc),
      hasRtc: Boolean(meta.rtc),
      hasRumble: Boolean(meta.rumble),
    };
  }

  detect(rom: Uint8Array): MbcType {
    return this.describeCartridge(rom).type;
  }

  create(
    type: MbcType,
    rom: Uint8Array,
    ramSize: number,
    options?: MbcOptions,
  ): Mbc {
    switch (type) {
      case "mbc1":
        return new Mbc1Controller(rom, ramSize, options);
      case "mbc2":
        return new Mbc2Controller(rom, 512, options);
      case "mbc3":
        return new Mbc3Controller(rom, ramSize, options);
      case "mbc5":
        return new Mbc5Controller(rom, ramSize, options);
      default:
        return new RomOnlyMbc(rom, ramSize, options);
    }
  }
}
