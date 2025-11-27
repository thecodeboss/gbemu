Here’s a consolidated “diff sheet” of _CGB vs DMG/SGB_ behavior from Pan Docs. I’ve grouped things by subsystem and kept each item to a quick one-liner like you asked. (This is quite comprehensive, but of course if you bump into a missing corner case while implementing we can drill further.)

---

## 1. High-level hardware differences

- **CPU master clock:** CGB can run its master clock up to 8.388608 MHz (double DMG), with system clock still 1/4 master clock. ([gbdev.io][1])
- **Work RAM size:** CGB has 32 KiB WRAM (4 KiB fixed + 7×4 KiB banked) vs 8 KiB on DMG. ([gbdev.io][1])
- **VRAM size:** CGB has 16 KiB VRAM (two 8 KiB banks) vs a single 8 KiB VRAM bank on DMG. ([gbdev.io][1])
- **Color depth:** CGB supports 32768 colors (RGB555) with multiple BG/OBJ palettes vs 4 monochrome shades on DMG. ([gbdev.io][1])

---

## 2. Mode selection & CGB detection

- **Header CGB flag (0143h):** CGB reads this byte to decide whether to run in Color mode (CGB Mode) or monochrome compatibility (Non-CGB Mode); values `$80` = CGB-enhanced, `$C0` = CGB-only. ([gbdev.io][2])
- **Unlocking CGB features:** CGB registers (VRAM bank, color palettes, HDMA, etc.) only work if the CGB header flag is set; otherwise the CGB behaves like a DMG. ([gbdev.io][3])
- **Hardware detection after boot:** On CGB/GBA hardware, A = `$11` on entry at $0100; bit 0 of B distinguishes CGB (0) vs GBA (1). ([gbdev.io][3])

---

## 3. Memory map & banking

- **VRAM banking:** At $8000–9FFF, CGB can switch between VRAM bank 0 and 1 (VBK register), while DMG only has a single, fixed VRAM bank. ([gbdev.io][4])
- **WRAM banking:** At $D000–DFFF, CGB maps one of WRAM banks 1–7 via SVBK; DMG always has a single WRAM region. ([gbdev.io][4])
- **CGB-only I/O range:** Registers FF4C–FF4D (KEY0/KEY1), FF4F (VBK), FF51–FF55 (HDMA), FF56 (RP), FF68–FF6B (color palettes), FF6C (OPRI), FF70 (SVBK), FF76–FF77 (PCM12/34) exist only on CGB and read as $FF in Non-CGB mode. ([gbdev.io][5])

---

## 4. Video/PPU – tile data & maps

- **Tile data capacity:** VRAM tile data region $8000–97FF holds 384 tiles on DMG but effectively 768 tiles in CGB Mode (both banks). ([gbdev.io][6])
- **Extra BG attribute map:** In CGB Mode, VRAM bank 1 at $9800–9FFF holds a 32×32 attribute map parallel to the BG tile map in bank 0, controlling palette, VRAM bank, flips, and priority per tile. ([gbdev.io][7])
- **BG attributes – bank select:** In CGB Mode, BG attribute bit 3 selects which VRAM bank (0 or 1) tile graphics are fetched from; DMG has no such bank selection. ([gbdev.io][7])
- **BG attributes – color palette:** In CGB Mode, BG attribute bits 0–2 select one of 8 BG palettes (BGP0–7); DMG uses a single BGP register for all BG pixels. ([gbdev.io][7])

---

## 5. Video/PPU – palettes

- **DMG monochrome palette regs only in Non-CGB:** BGP, OBP0, OBP1 (FF47–FF49) are used only in Non-CGB Mode; in CGB Mode, BG/OBJ colors come entirely from palette RAM accessed via BCPS/BCPD and OCPS/OCPD. ([gbdev.io][8])
- **CGB color palette RAM:** CGB has 64 bytes of BG palette RAM (8 palettes × 4 colors × 2 bytes) and 64 bytes of OBJ palette RAM, accessed through FF68–6B; DMG has no palette RAM at all. ([gbdev.io][8])
- **Palette access timing:** Palette RAM cannot be accessed during Mode 3 (PPU reading it) on CGB; DMG’s BGP/OBP registers are simple I/O and not VRAM-like. ([gbdev.io][8])
- **Gamma difference vs SGB:** SGB color format is identical to CGB (RGB555), but the same RGB values display differently on SGB vs CGB due to different screen gamma. ([gbdev.io][9])

---

## 6. Video/PPU – LCDC & priority rules

- **LCDC bit 0 meaning:**
  - Non-CGB: bit 0 = BG/Window enable; clearing it blanks BG+Window, leaving only sprites. ([gbdev.io][10])
  - CGB Mode: bit 0 = “BG & Window master priority”; when clear, sprites always appear on top regardless of BG/OAM priority flags; when set, priority is resolved using LCDC bit 0 + BG attributes + OAM attributes. ([gbdev.io][10])

- **BG vs OBJ priority in CGB:** Priority is determined by BG attribute bit 7, OAM attribute bit 7 (“BG over OBJ”), and LCDC bit 0 according to a specific truth table; DMG relies mostly on OAM priority and color index 0 transparency. ([gbdev.io][7])
- **OBJ drawing priority:** In Non-CGB mode, lower X coordinate wins; ties go to earlier OAM entry. In CGB mode, only OAM order matters (earlier entry always has higher priority). ([gbdev.io][11])
- **Object priority mode (OPRI):** CGB has an OPRI register (FF6C) that controls how OBJ priority interacts globally (CGB-only register; Non-CGB locks it to $FF). ([gbdev.io][5])

---

## 7. Video/PPU – timing & quirks

- **Dots vs speed mode:** In STAT docs, a “dot” is 1 T-cycle on DMG or CGB Normal Speed but 2 T-cycles on CGB Double Speed (so the PPU timing stays effectively constant while CPU speeds up). ([gbdev.io][12])
- **STAT spurious interrupt quirk:** Monochrome GB has a quirk where writing STAT during certain modes can spuriously trigger a STAT interrupt; CGB in DMG mode _does not_ have this quirk, so a couple of DMG-quirk-dependent games won’t run correctly on CGB. ([gbdev.io][13])
- **SCY “bitplane desync” behavior:** On all models before CGB-D, SCY can be written mid-frame to desync bitplanes (due to Y being re-read per bitplane); on CGB-D and later, both bitplanes always use the same Y and this trick no longer works. ([gbdev.io][14])

---

## 8. Video/PPU – VRAM access & DMA

- **VRAM access workaround:** In CGB Mode, you can write to VRAM even when PPU would normally deny access by using HDMA (FF51–FF55) to do VRAM DMA, which is not available on DMG. ([gbdev.io][15])
- **HDMA (FF51–FF55 CGB-only):**
  - CGB supports both “General-purpose DMA” (CPU halted, big burst) and “HBlank DMA” (16 bytes per HBlank) to VRAM; DMG only has the classic OAM DMA to FE00. ([gbdev.io][3])
  - HDMA continues over multiple scanlines and must not be started during Mode 0; it also interacts with VRAM bank changes and `halt`. ([gbdev.io][3])

- **VRAM bank register (VBK FF4F):** CGB uses VBK bit 0 to choose VRAM bank, and reads return current bank in bit 0 with all other bits set; DMG simply has no VRAM bank selection. ([gbdev.io][3])

---

## 9. Sprites / OAM

- **OBJ tile bank select:** In CGB Mode, OAM attribute bit 3 chooses whether sprite tiles are fetched from VRAM bank 0 or 1; on DMG all OBJ tiles are fetched from a single VRAM region. ([gbdev.io][11])
- **OBJ palette index (CGB):** OAM attribute bits 0–2 select one of 8 OBJ palettes OBP0–7 in CGB Mode; on DMG a single bit selects OBP0 vs OBP1. ([gbdev.io][11])
- **Drawing priority rule change:** As mentioned above, sprite priority is X-based on DMG but purely OAM-order based on CGB. ([gbdev.io][11])
- **OAM corruption bug fixed:** The OAM corruption bug triggered by certain instructions in Mode 2 on DMG is _not present_ on Game Boy Color (or GBA), even when running DMG software. ([gbdev.io][16])

---

## 10. Serial / link port differences

- **Extra internal clock speeds:**
  - DMG: only 8192 Hz internal serial clock.
  - CGB: 4 internal speeds depending on SC bit 1 and double-speed: 8192 Hz, 16384 Hz, 262144 Hz, 524288 Hz. ([gbdev.io][17])

- **SC bit 1 meaning change:** On CGB, SC bit 1 becomes “clock speed select”; on DMG it has no such high-speed effect. ([gbdev.io][17])
- **Disconnect behavior timing:** The 20 µs pull-up timing mentioned for link disconnection was measured specifically on a CGB revision E at highest clock, so exact behavior may differ on DMG. ([gbdev.io][17])

---

## 11. Infrared (CGB-only)

- **Built-in IR port:** CGB hardware adds a built-in IR transceiver on the top of the unit; DMG requires IR-equipped cartridges (HuC-1 etc.). ([gbdev.io][18])
- **RP register (FF56):** CGB introduces RP to control IR send/receive: bit 0 toggles IR LED, bits 6–7 enable the IR sensor; in Non-CGB Mode this register doesn’t exist and IR isn’t available. ([gbdev.io][18])
- **Signal fade behavior:** CGB’s IR sensor adapts to sustained IR levels, causing RP bit 1 to “fade” back to 1 after a while, a behavior you’d need if emulating IR accurately. ([gbdev.io][18])

---

## 12. Audio differences

- **PCM12/PCM34 (FF76–FF77 CGB-only):** CGB adds two read-only PCM registers exposing the 4-bit digital outputs of channels 1–4 (useful for test/debug; DMG lacks them). ([gbdev.io][19])
- **Model-dependent HPF:** The built-in audio high-pass filter is more aggressive on GBC than on DMG (and more aggressive still on GBA), so low-frequency response differs by model. ([gbdev.io][20])
- **Boot ROM wave RAM init:** Early CGB0 boot ROMs do _not_ initialize wave RAM; later CGB boot ROMs do, which can change startup music (e.g., R-Type title) depending on model. ([gbdev.io][21])

---

## 13. CPU speed & STOP/HALT behavior

- **Double-speed mode (KEY1, FF4D):** Only CGB supports double-speed; KEY1 bit 7 reports current speed, bit 0 arms a speed switch that occurs on the next STOP instruction; DMG ignores this. ([gbdev.io][3])
- **What gets doubled:** In CGB double-speed mode, CPU, timer/divider, serial port, and DMA to OAM run 2× faster, while PPU, HDMA timing, and all audio timings remain the same as normal speed. ([gbdev.io][3])
- **STOP instruction reused:** On CGB, STOP + KEY1 = 1 usually performs a speed switch instead of only entering low-power stop; DMG STOP just attempts to enter standby (with nasty LCD issues if misused). ([gbdev.io][22])
- **CGB STOP + LCD behavior:** On CGB, executing STOP with LCD left enabled yields a black screen except in Mode 3, where it keeps drawing the current screen; DMG has a different, more dangerous behavior (horizontal black line). ([gbdev.io][22])

---

## 14. Boot ROM & power-up state

- **Different boot ROMs:** CGB0 vs later CGB boot ROMs differ slightly; notably, the CGB0 boot ROM does _not_ initialize wave RAM, changing initial sound state compared to later models. ([gbdev.io][21])
- **CGB logo-check quirk:** CGB boot ROM copies the entire Nintendo logo to HRAM but only compares the first half, so logos with a valid top half but different bottom half still pass on CGB/AGB (not true of DMG boot ROMs). ([gbdev.io][23])
- **Registers after boot:** Power-up sequence tables show different initial register values for CGB vs DMG/SGB (e.g., A=$11 on CGB, different values in B, D, E, HL, and in KEY1/VBK/SVBK/BCPS/OCPS/RP); some CGB-only registers are initialized to non-$FF values. ([gbdev.io][23])
- **CGB-only hardware regs at boot:** Registers like KEY1, VBK, HDMAx, RP, BCPS/BCPD, OCPS/OCPD, SVBK exist only on CGB; in Non-CGB Mode they read as $FF and should not be relied upon. ([gbdev.io][23])

---

## 15. Miscellaneous / physical differences

- **Cartridge slot PHI output:** Cartridge connector PHI pin outputs ~1.05 MHz on DMG but ~2.10 MHz in CGB double-speed mode (so external hardware sees a different clock when CGB is sped up). ([gbdev.io][24])
- **External power spec:** CGB uses 3 V DC at about 0.6 W with a specific barrel jack size/polarity, differing from DMG’s 6 V supply; mostly relevant if you go down the rabbit hole of hardware-accurate modeling. ([gbdev.io][24])
- **GBC auto-colorization of DMG games:** For plain DMG cartridges, GBC applies automatic colorization (one 4-color BG palette + two 3-color OBJ palettes) unless the game is CGB-aware and sets its own palettes. ([gbdev.io][25])

---

## 16. “DMG bug vs CGB behavior” recap

Useful if you’re designing abstractions for “model quirks”:

- **OAM corruption bug:** Present on DMG/SGB; fixed on CGB (and AGB). ([gbdev.io][16])
- **STAT write spurious interrupt:** Present on DMG; _absent_ on CGB in DMG mode. ([gbdev.io][13])
- **SCY bitplane desync mid-frame:** Trick depends on pre-CGB-D hardware; CGB-D and later treat Y consistently per scanline. ([gbdev.io][14])
- **Wave RAM init on boot:** Not initialized on some early CGB0 units; later CGBs _do_ init it, so relying on “random” wave RAM is model-dependent. ([gbdev.io][21])

---

### How to use this for your emulator design

A practical way to wire this into your architecture:

- Have a **model enum** (DMG, CGB-Compat, CGB-Native, maybe sub-revisions) that controls:
  - Available RAM/VRAM banks & relevant bank registers (VBK, SVBK).
  - Palette backend (DMG gray palettes vs CGB CRAM).
  - PPU priority rules and attribute interpretation.
  - Serial timing, double-speed availability, STOP behavior.
  - Presence of IR, PCM regs, OAM bug, STAT quirk, etc.

- For each bullet above, think “feature flag / behavior flag” and tuck it into a `ModelFeatures` struct used by the CPU, PPU, APU, and serial subsystems.

If you want, next step we can sketch an actual `ModelFeatures` interface and how your existing DMG emulator can branch cleanly into CGB behavior without becoming spaghetti.

[1]: https://gbdev.io/pandocs/Specifications.html "Specifications - Pan Docs"
[2]: https://gbdev.io/pandocs/The_Cartridge_Header.html?utm_source=chatgpt.com "The Cartridge Header - Pan Docs"
[3]: https://gbdev.io/pandocs/CGB_Registers.html "CGB Registers - Pan Docs"
[4]: https://gbdev.io/pandocs/Memory_Map.html "Memory Map - Pan Docs"
[5]: https://gbdev.io/pandocs/Hardware_Reg_List.html "Summary - Pan Docs"
[6]: https://gbdev.io/pandocs/Tile_Data.html "Tile Data - Pan Docs"
[7]: https://gbdev.io/pandocs/Tile_Maps.html "Tile Maps - Pan Docs"
[8]: https://gbdev.io/pandocs/Palettes.html "Palettes - Pan Docs"
[9]: https://gbdev.io/pandocs/SGB_Color_Palettes.html?utm_source=chatgpt.com "Color Palettes Overview - Pan Docs"
[10]: https://gbdev.io/pandocs/LCDC.html "LCD Control - Pan Docs"
[11]: https://gbdev.io/pandocs/OAM.html "OAM - Pan Docs"
[12]: https://gbdev.io/pandocs/STAT.html?utm_source=chatgpt.com "Pan Docs - LCD Status Registers"
[13]: https://gbdev.io/pandocs/STAT.html "LCD Status Registers - Pan Docs"
[14]: https://gbdev.io/pandocs/Scrolling.html "Scrolling - Pan Docs"
[15]: https://gbdev.io/pandocs/Accessing_VRAM_and_OAM.html "Accessing VRAM and OAM - Pan Docs"
[16]: https://gbdev.io/pandocs/OAM_Corruption_Bug.html "OAM Corruption Bug - Pan Docs"
[17]: https://gbdev.io/pandocs/Serial_Data_Transfer_%28Link_Cable%29.html "Serial Data Transfer - Pan Docs"
[18]: https://gbdev.io/pandocs/IR.html "Infrared Communication - Pan Docs"
[19]: https://gbdev.io/pandocs/Audio_details.html?utm_source=chatgpt.com "Audio Details - Pan Docs"
[20]: https://gbdev.io/pandocs/Audio_details.html "Audio Details - Pan Docs"
[21]: https://gbdev.io/pandocs/Power_Up_Sequence.html?utm_source=chatgpt.com "Power-Up Sequence - Pan Docs"
[22]: https://gbdev.io/pandocs/Reducing_Power_Consumption.html "Reducing Power Consumption - Pan Docs"
[23]: https://gbdev.io/pandocs/Power_Up_Sequence.html "Power-Up Sequence - Pan Docs"
[24]: https://gbdev.io/pandocs/External_Connectors.html "External Connectors - Pan Docs"
[25]: https://gbdev.io/pandocs/GBC_Approval_Process.html?utm_source=chatgpt.com "GBC Approval Process - Pan Docs"
