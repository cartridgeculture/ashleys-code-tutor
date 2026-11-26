# Sega Genesis / Mega Drive VDP (YM7101 / 315-5313) Programming Reference

Source notes (read first). Researched 2026-11-18. Primary sources actually read: Plutiedev pages (vdp-registers, vdp-commands, dma-transfer, sprites, vdp-setup, writing-video, hardware-issues), the Mega Drive wiki VDP page (md.railgun.works), Genesis Plus GX (GPGX) source `core/vdp_ctrl.c` and `core/vdp_render.c` (used as "ground truth" for emulated behavior), the s2disasm `vdpComm` macro, flamewing's DMA macro gist (hardware-verified comments), raddad772's VDP blog, Rasterscroll's MD graphics guide, Copetti's architecture article, ChibiAkumas, and SpritesMind forum threads (Nemesis HV counter tables, Eke/Jorge timing measurements). **Not readable during this session:** Charles MacDonald's `genvdp.txt` (the only mirror found, otakon273.duckdns.org, closed the connection on 3 attempts), Sega Retro and Sonic Retro SCHG pages (blocked by an Anubis bot wall), and BlastEm source (not fetched). So genvdp.txt is cited only indirectly. Every code block in this file is my own code, built from the cited formulas. I checked the command-word and register arithmetic with a script, but **none of the code was assembled or run on hardware or an emulator**.

Short link keys used below:
[PD-REG](https://plutiedev.com/vdp-registers) · [PD-CMD](https://plutiedev.com/vdp-commands) · [PD-DMA](https://plutiedev.com/dma-transfer) · [PD-SPR](https://plutiedev.com/sprites) · [PD-SETUP](https://plutiedev.com/vdp-setup) · [PD-WRITE](https://plutiedev.com/writing-video) · [PD-HW](https://plutiedev.com/hardware-issues) · [MDWIKI](https://md.railgun.works/index.php?title=VDP) · [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c) · [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c) · [S2-MACROS](https://github.com/sonicretro/s2disasm/blob/master/s2.macros.asm) · [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0) · [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html) · [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/) · [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/) · [CHIBI](https://www.chibiakumas.com/68000/genesis.php) · [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655) · [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077) · [SM-BYTE](https://gendev.spritesmind.net/forum/viewtopic.php?p=36170)

---

## Q1. Ports, mirrors and the status register

### Takeaway
The VDP sits at $C00000 (data, mirrored at $C00002), $C00004 (control, mirrored at $C00006) and $C00008 (HV counter, mirrored at $C0000A/C/E). Reading the control port returns the 16-bit status word and also cancels a half-written command. Always use word or long accesses. Never use byte accesses, and never use `clr` on these ports.

### Cited Findings

#### VDP port map (68k side)
- $C00000 / $C00002 = data port (and mirror). $C00004 / $C00006 = control port (and mirror). $C00008-$C0000E = HV counter (mirrors at $C0000A, $C0000C, $C0000E). $C00011-$C00017 (odd bytes) = SN76489 PSG. $C0001C / $C0001E = undocumented debug register — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- The data and control ports appear with mirrors at $C00002 and $C00006 — [CHIBI](https://www.chibiakumas.com/68000/genesis.php)
- Pitfall: writing the second word of a command to the $C00006 mirror can make the VDP lose the first word. Write both words to $C00004 — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- The PSG is part of the VDP chip and is reached over the 68000 bus. This matters when working around DMA bus problems — [PD-HW](https://plutiedev.com/hardware-issues)

#### Data port access width
- Write the data port as words or longwords only. Byte writes are not allowed. A longword write equals two consecutive word writes (high word first). Always write to the same port address (do not increment the pointer) — [PD-WRITE](https://plutiedev.com/writing-video)
- Control-port commands may be written as one longword or as two words — [PD-CMD](https://plutiedev.com/vdp-commands)

#### Why byte writes to the control port are dangerous
- During an 8-bit write, the 68000 puts the same byte on both halves of the 16-bit data bus. For example, a byte write of $12 looks like $1212 on the bus. Reads are always 16-bit, and the CPU picks the half it wants — [SM-BYTE](https://gendev.spritesmind.net/forum/viewtopic.php?p=36170). A forum member reports that Sega's documentation calls byte-mode VDP access "prohibited". I could not confirm this in an official document (same thread).
- Do not use `clr` on hardware registers. On the 68000 it does a dummy read before writing, and that read confuses the VDP — [PD-SETUP](https://plutiedev.com/vdp-setup)

#### Status register (read word from $C00004)
Bit layout from [MDWIKI](https://md.railgun.works/index.php?title=VDP), cross-checked against [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c):

| Bit | Name | Meaning |
|---|---|---|
| 15-10 | — | Not status bits (see conflict below) |
| 9 | EMPTY | Write FIFO is empty |
| 8 | FULL | Write FIFO is full |
| 7 | VIP / F | Vertical interrupt has occurred (set at about line $E0) |
| 6 | SOVR | Sprite overflow: too many sprites on a line (17th in H32, 21st in H40) |
| 5 | SCOL | Sprite collision: two non-transparent sprite pixels overlapped (a leftover from the TMS9918, considered useless) |
| 4 | ODD | Odd frame while interlace is on |
| 3 | VB | Live vertical-blank flag |
| 2 | HB | Live horizontal-blank flag |
| 1 | DMA | DMA in progress (only useful for fill and copy, because the 68k is halted during 68k→VDP DMA) |
| 0 | PAL | 1 = PAL (50 Hz) console |

- If EMPTY and FULL are both 0, the FIFO holds some entries but is not full — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- GPGX bit order matches: bit 0 PAL, 1 DMA busy, 2 HBLANK, 3 VBLANK (**also forced to 1 while the display is disabled**), 4 odd field, 5 collision, 6 overflow, 7 VINT, 8 FIFO full, 9 FIFO empty. Reading the status clears the write-pending flag and clears SOVR/SCOL (`status &= 0xFF9F`). It does not clear VINT, which the interrupt acknowledge clears — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Reading the control port cancels any pending VDP operation, so `tst.w (VdpCtrl)` at startup puts the VDP in a known state — [PD-SETUP](https://plutiedev.com/vdp-setup)
- **CONFLICT, upper bits 15-10:** MDWIKI lists them as fixed `001101` ([MDWIKI](https://md.railgun.works/index.php?title=VDP)). GPGX returns 0 for them on the 68k side and does not model fixed bits ([GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)). Code should mask them off or test single bits with `btst`.
- **CONFLICT, when VIP clears:** MDWIKI says it clears at the end of the frame. GPGX clears it on interrupt acknowledge, not on a status read.

#### HV counter ($C00008)
- Normal mode: high byte = V7-V0, low byte = H8-H1 (the pixel H counter divided by 2). In interlace the V byte changes meaning — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- External V-counter bit mapping (Nemesis, hardware-tested): no interlace `76543210`, normal interlace `76543218`, double interlace `65432107` — [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655)
- Register $80 bit 1 (M3) set = HV counter latched (frozen). GPGX returns the latched value when the latch is enabled in Mode 5 — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c), [PD-REG](https://plutiedev.com/vdp-registers)
- Reads can be "torn": the counter updates live, so bits can mix old and new values. Nemesis puts this at roughly 1 in 100 reads, by his recollection — [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655)

#### Debug register $C0001C (do not touch)
- Undocumented and not emulated. No known game uses it. Its bits hide layers, disable the display or PSG, or corrupt VDP state — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

### Inferences
- A beginner should define `VDP_DATA equ $C00000`, `VDP_CTRL equ $C00004`, `VDP_HV equ $C00008` and only ever use `move.w`/`move.l` with them.
- Concrete danger of `move.b #$81,$C00004`: given byte duplication, the VDP sees $8181. That is a register write of $81 to register 1, which turns the display off, disables VInt/DMA and **clears M5**, dropping the VDP into Master System Mode 4. This follows from the byte-duplication finding plus the register format, but I did not test it on hardware.
- Polling VB (status bit 3) while the display is disabled never sees the bit drop to 0 under GPGX. A "wait for VB=0 then VB=1" loop therefore hangs if the display is off. Use a VInt-driven flag, or only poll with the display on.

### Gaps
- I could not read genvdp.txt's exact wording on byte reads/writes and the upper status bits. The byte-duplication claim rests on a SpritesMind forum post, and I found no official Sega or Motorola text.
- How the upper 6 status bits behave on real hardware (fixed pattern or open bus/prefetch) is unresolved between the sources read.

---

## Q2. VDP registers $80-$97 (registers 0-23), bit by bit

### Takeaway
A register write is one 16-bit word to the control port: `$8000 | (reg << 8) | value`, so register N is written as `$8N00+value` (`$80xx`-`$97xx`). A safe standard setup is: Mode 5 ($81 bit 2 = 1), H40 ($8C = $81), V28, autoincrement 2, 64×32 planes, Plane A $C000, Window $D000, Plane B $E000, sprites $F000, HScroll $F400.

### Cited Findings

#### Register write format
- Write one word to $C00004: `$8000 | (register << 8) | value` — [PD-CMD](https://plutiedev.com/vdp-commands). The first byte is the register number with its MSB set, and the second byte is the value — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- GPGX treats a control word whose bits 15-14 are `10` as a register write to register `(data >> 8) & 0x1F`, but **only when no command is half-written** (pending = 0). In that case it does not set pending — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- A register write unsets the current VRAM/CRAM/VSRAM address, so set the address again before writing more data — [PD-CMD](https://plutiedev.com/vdp-commands)
- Registers 0-23 are programmable. The status register is read-only — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- In Mode 4 (SMS mode), registers 11-23 cannot be written — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)

#### Register $80 (reg 0) — Mode Set 1
Layout (bit 7→0): `0 0 LCB IE1 0 1 M3 0` — [PD-REG](https://plutiedev.com/vdp-registers)
- Bit 5 LCB (MDWIKI calls it "L"): blank the leftmost 8-pixel column (shows the backdrop). Used to hide scroll garbage at the left edge — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 4 IE1: HBlank interrupt (68k level 4) enable — same sources.
- Bit 2: shown as fixed 1 in Plutiedev's layout. Typical value $04 — [PD-REG](https://plutiedev.com/vdp-registers), [PD-SETUP](https://plutiedev.com/vdp-setup)
- Bit 1 M3: 1 = latch (freeze) the HV counter. GPGX labels it "HVC latch" — [PD-REG](https://plutiedev.com/vdp-registers), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Bit 0: MDWIKI calls it "DE" (display-enable related) but flags that its description is inconsistent. Plutiedev shows it as 0 — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **CONFLICT:** MDWIKI says the HV counter "must be enabled via Register 0 before use". Plutiedev and GPGX treat M3=1 as *freezing* the counter, so M3=0 is the normal running state.
- GPGX notes that HInt is disabled at power-on (verified on a VA4 MD1 with a 315-5313 VDP) — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Typical value: `$8004` (no HInt, counter running) — [PD-SETUP](https://plutiedev.com/vdp-setup), [CHIBI](https://www.chibiakumas.com/68000/genesis.php)

#### Register $81 (reg 1) — Mode Set 2
Layout: `VR DISP IE0 M1 M2 M5 0 0` (Plutiedev shows bit 7 as 0 and bit 2 as fixed 1) — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 7: 128 KB VRAM mode. Must be 0 on stock consoles, which only have 64 KB, or graphics garble — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 6 DISP: 1 = display on. 0 = blank the screen (backdrop only), which gives faster VRAM access — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 5 IE0: VBlank interrupt (68k level 6) enable — same sources.
- Bit 4 M1: DMA enable. GPGX starts DMA only if CD5 is set **and** this bit is set. MDWIKI says that when M1 is clear it masks CD5. RADDAD agrees that the enable bit just controls whether CD5 can be set — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c), [MDWIKI](https://md.railgun.works/index.php?title=VDP), [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html)
- Bit 3 M2: 0 = V28 (224 lines), 1 = V30 (240 lines). V30 works properly only on PAL — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 2 M5: 1 = Mega Drive Mode 5, 0 = SMS Mode 4. Must be 1 — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Common values: `$8104` during init (display off, Mode 5, Plutiedev's setup) — [PD-SETUP](https://plutiedev.com/vdp-setup). `$8114` (display off, DMA on) — [CHIBI](https://www.chibiakumas.com/68000/genesis.php). The running value is usually `$8174` (display on + VInt + DMA + Mode 5, V28); I derived that from the bit layout above.

#### Register $82 (reg 2) — Plane A nametable base
Layout: `0 0 SA15 SA14 SA13 0 0 0`. Value = `(addr >> 10) & $38`, and the base must be a multiple of $2000 — [PD-REG](https://plutiedev.com/vdp-registers). Example: $C000 → $30 — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-SETUP](https://plutiedev.com/vdp-setup). Bit 6 = SA16 (128 KB mode only) — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $83 (reg 3) — Window nametable base
Layout: `0 0 WD15 WD14 WD13 WD12 WD11 0`. The base is a multiple of $800 in H32. In H40, WD11 must be 0 / is ignored, so the base must be a multiple of $1000 — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP). Value = `(addr >> 10) & $3E`. Examples: $F000 → $3C ([MDWIKI](https://md.railgun.works/index.php?title=VDP)), $D000 → $34 ([PD-SETUP](https://plutiedev.com/vdp-setup)).

#### Register $84 (reg 4) — Plane B nametable base
Layout: `0 0 0 0 0 SB15 SB14 SB13`. Value = `(addr >> 13) & $07`, base a multiple of $2000. Example: $E000 → $07 — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP) (MDWIKI's example mislabels this as "Plane A"). Bit 3 = SB16 (128 KB mode).

#### Register $85 (reg 5) — Sprite attribute table base
Layout: `0 AT15 AT14 AT13 AT12 AT11 AT10 AT9`. Value = `(addr >> 9) & $7F`. The base must be a multiple of $200 in H32 and of $400 in H40 (AT9 must be 0) — [PD-REG](https://plutiedev.com/vdp-registers), [PD-SPR](https://plutiedev.com/sprites). Examples: $D800 → $6C ([MDWIKI](https://md.railgun.works/index.php?title=VDP)), $F000 → $78 ([PD-SETUP](https://plutiedev.com/vdp-setup)).

#### Register $86 (reg 6) — Sprite pattern generator base (128 KB only)
Bit 5 (AP16) adds $10000 to sprite pattern addresses and only works on modified hardware. Unused on stock consoles — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $87 (reg 7) — Backdrop (background) colour
Layout: `0 0 CPT1 CPT0 COL3 COL2 COL1 COL0` = palette line (0-3) and colour index (0-15) — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP). GPGX uses `d & 0x3F` as the backdrop CRAM index — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c). **CONFLICT:** [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/) says only palette 0 colour 0 can be the solid background colour. That contradicts the three sources above. Any of the 64 CRAM entries can be the backdrop.

#### Registers $88, $89 (regs 8, 9) — unused in Mode 5
These were the SMS horizontal and vertical scroll registers. MDWIKI says "do not write to them" — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $8A (reg 10) — HBlank interrupt counter
- 8-bit line interval for HInt. It only has an effect with IE1 ($80 bit 4) set and the 68k interrupt mask allowing level 4 — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-REG](https://plutiedev.com/vdp-registers)
- 0 = interrupt every line, 1 = every 2 lines (Eke). The counter decrements each line and fires when it drops below zero (mickagame) — [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077)
- Changing it only takes effect after the current countdown expires (MDWIKI example: if the counter was $10 and you write $08 after the interrupt, the next gap is still $10 lines) — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- `$8AFF` is the common "effectively off" value — [PD-SETUP](https://plutiedev.com/vdp-setup), [CHIBI](https://www.chibiakumas.com/68000/genesis.php)

#### Register $8B (reg 11) — Mode Set 3
Layout: `0 0 0 0 IE2 VSCR HSCR LSCR` — [PD-REG](https://plutiedev.com/vdp-registers)
- Bit 3 IE2: external interrupt (68k level 2) from the controller-port TH pin (light guns). It also latches the HV counter — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 2 VSCR: 0 = full-screen vertical scroll, 1 = per 2-cell (16 px) column — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bits 1-0 HSCR/LSCR: 00 = full screen, 10 = per 8-pixel cell row, 11 = per line. **CONFLICT on 01:** Plutiedev calls it "per eight lines (repeating)", while MDWIKI calls it "prohibited, undefined". Don't use 01 — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $8C (reg 12) — Mode Set 4
Layout: `RS0 VSY HSY SPR SHI LSM1 LSM0 RS1` — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-REG](https://plutiedev.com/vdp-registers) (Plutiedev shows bits 6-4 as 0)
- Bits 7 and 0 (RS0, RS1): both 0 = H32 (256 px, 32 cells), both 1 = H40 (320 px, 40 cells). The two bits must match — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 6 VSY, bit 5 HSY, bit 4 SPR/EP: undocumented or external-pixel-bus bits (replace vsync with pixel clock / freeze hsync / external colour bus). Keep them 0 — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Bit 3 SHI (S/TE): shadow/highlight enable — [PD-REG](https://plutiedev.com/vdp-registers), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Bits 2-1 LSM: 00 = no interlace, 01 = interlace (no extra resolution), 10 = prohibited, 11 = interlace mode 2 (double resolution, 8×16 tiles) — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Typical value `$8C81` (H40, no interlace, no S/H) — [PD-SETUP](https://plutiedev.com/vdp-setup), [CHIBI](https://www.chibiakumas.com/68000/genesis.php)

#### Register $8D (reg 13) — HScroll table base
Layout: `0 0 HS15 HS14 HS13 HS12 HS11 HS10`. Value = `(addr >> 10) & $3F`, base a multiple of $400 — [PD-REG](https://plutiedev.com/vdp-registers). Example: $DC00 → $37 ([MDWIKI](https://md.railgun.works/index.php?title=VDP)), $F400 → $3D ([PD-SETUP](https://plutiedev.com/vdp-setup)). **Source error:** ChibiAkumas says $37 gives $FC00, which is wrong. Its own text then puts Scroll A at $DC00 — [CHIBI](https://www.chibiakumas.com/68000/genesis.php)

#### Register $8E (reg 14) — Nametable pattern base (128 KB only)
Bits 0 (PA16) and 4 (PB16) only work on 128 KB-modified hardware. Unused on stock consoles — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $8F (reg 15) — Auto-increment
After each data-port access, this many **bytes** are added to the address. Usually 2 — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $90 (reg 16) — Plane (scroll) size
Layout: `0 0 VSZ1 VSZ0 0 0 HSZ1 HSZ0`. The setting applies to both Plane A and Plane B — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)

| Value | Size (cells W×H) | Bytes |
|---|---|---|
| $00 | 32×32 | $800 |
| $01 | 64×32 | $1000 |
| $03 | 128×32 | $2000 |
| $10 | 32×64 | $1000 |
| $11 | 64×64 | $2000 |
| $30 | 32×128 | $2000 |

- Other combinations are invalid. The field encoding is 00 = 32, 01 = 64, 10 = prohibited, 11 = 128, and a nametable may not exceed 8192 bytes (so no 64×128 or 128×128) — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $91 (reg 17) — Window horizontal position
Layout: `RIGT 0 0 WHP5 WHP4 WHP3 WHP2 WHP1`. RIGT 0 = window to the left of the split, 1 = to the right. The split X is in 16-px (2-cell) units — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Register $92 (reg 18) — Window vertical position
Layout: `DOWN 0 0 WVP4 WVP3 WVP2 WVP1 WVP0`. DOWN 0 = window above the split, 1 = below it. The split Y is in **8-px (1-cell) units** — [PD-REG](https://plutiedev.com/vdp-registers). GPGX computes the line as `(reg[18] & 0x1F) << 3` — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c). **CONFLICT:** MDWIKI says "units of 2 cells" and also wrongly says DOWN moves the window "horizontally". I follow Plutiedev and GPGX — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Registers $93, $94 (regs 19, 20) — DMA length
$93 = LG7-0, $94 = LG15-8. For 68k→VDP DMA the unit is **words** (byte length ÷ 2) — [PD-REG](https://plutiedev.com/vdp-registers), [PD-DMA](https://plutiedev.com/dma-transfer). A length of 0 means $10000, because the VDP decrements before testing for zero — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c), [PD-HW](https://plutiedev.com/hardware-issues)

#### Registers $95, $96, $97 (regs 21-23) — DMA source / mode
- $95 = SA8-SA1, $96 = SA16-SA9, $97 = `DMD1 DMD0 SA22-SA17` — [PD-REG](https://plutiedev.com/vdp-registers)
- DMD 0x = 68k→VDP transfer, with DMD0 acting as SA23. 10 = VRAM fill. 11 = VRAM copy — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- The source is the 68k byte address shifted right by 1 (there is no A0). Example: $97 = $7F (source $7F0000) corresponds to 68k $FE0000 — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- GPGX updates the source and length registers as the DMA progresses ("DMA source address registers are incremented during DMA (even DMA Fill)"), so reprogram them for every DMA — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)

#### Typical init values (cross-checked)
- Plutiedev setup writes: $8004, $8104, $8B00, $8C81, $8230, $8407, $8578, $8334, $8D3D, $9001, $9100, $9200, $8F02, $8700, $8AFF — [PD-SETUP](https://plutiedev.com/vdp-setup)
- ChibiAkumas table: R0 $04, R1 $14, R2 $30, R3 $3C, R4 $07, R5 $6C, R7 $00, R10 $FF, R11 $00, R12 $81, R13 $37, R15 $01, R16 $01, R17 $00, R18 $00 — [CHIBI](https://www.chibiakumas.com/68000/genesis.php)

### Inferences
- With the Plutiedev layout (A=$C000, Window=$D000, B=$E000, SAT=$F000, HScroll=$F400, 64×32 planes, H40), the tables don't overlap: Plane A $C000-$CFFF, Window $D000-$DFFF (64×32 in H40), Plane B $E000-$EFFF, SAT $F000-$F27F (80×8 bytes), HScroll $F400-$F77F (224 lines × 4 bytes). Tiles use $0000-$BFFF, which is 1536 tiles. I checked the arithmetic but did not run it.
- Setting $91 = $00 and $92 = $00 means "window left of X=0" and "above Y=0", which is an empty window. That is the usual "window off" setting, inferred from the RIGT/DOWN semantics.

#### Code: register init table + loop (own code, unassembled)
```asm
VDP_DATA    equ $C00000
VDP_CTRL    equ $C00004
VDP_HV      equ $C00008

VdpInit:
        lea     VDP_CTRL,a0
        tst.w   (a0)                ; read status: clears any half-written command
        lea     VdpRegTable(pc),a1
        moveq   #(VdpRegTableEnd-VdpRegTable)/2-1,d1
VdpInitLoop:
        move.w  (a1)+,(a0)          ; each entry is $8R00|value
        dbf     d1,VdpInitLoop
        rts

VdpRegTable:
        dc.w    $8004   ; R0: no HInt, HV counter running
        dc.w    $8134   ; R1: display OFF, VInt on, DMA on, Mode 5, V28
        dc.w    $8230   ; R2: Plane A at $C000
        dc.w    $8334   ; R3: Window at $D000
        dc.w    $8407   ; R4: Plane B at $E000
        dc.w    $8578   ; R5: Sprite table at $F000
        dc.w    $8700   ; R7: backdrop = palette 0, colour 0
        dc.w    $8AFF   ; R10: HInt counter (HInt is disabled anyway)
        dc.w    $8B00   ; R11: full-screen H and V scroll, no ext int
        dc.w    $8C81   ; R12: H40, no interlace, no shadow/highlight
        dc.w    $8D3D   ; R13: HScroll table at $F400
        dc.w    $8F02   ; R15: autoincrement 2
        dc.w    $9001   ; R16: 64x32 cell planes
        dc.w    $9100   ; R17: window X split 0 (window off)
        dc.w    $9200   ; R18: window Y split 0 (window off)
VdpRegTableEnd:
; Regs 6, 8, 9, 14 deliberately not written (unused / 128KB-only).
; Turn display on later with: move.w #$8174,VDP_CTRL
```

### Gaps
- I could not confirm the meaning of register $80 bit 2 (shown as a fixed 1). genvdp.txt reportedly describes it, but I could not read it. Always set it, as all init tables do.
- What happens if RS0 ≠ RS1 is only described as "must match". I found no detail.

---

## Q3. Control-port command words (VRAM/CRAM/VSRAM read/write, DMA)

### Takeaway
To set an address, write a 32-bit command to $C00004: `CD1 CD0 A13…A0` in the high word, and `0…0 CD5 CD4 CD3 CD2 0 0 A15 A14` in the low word. In formula form: `((addr & $3FFF) << 16) | ((addr & $C000) >> 14) | base`, where base is $40000000 (VRAM write), $C0000000 (CRAM write), $40000010 (VSRAM write), $00000000/$00000020/$00000010 (VRAM/CRAM/VSRAM read). OR in $80 to start a DMA.

### Cited Findings

#### Bit layout
- CD1-CD0 go in bits 31-30, A13-A0 in bits 29-16, CD5-CD2 in bits 7-4 of the low word, and A15-A14 in bits 1-0 of the low word — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-WRITE](https://plutiedev.com/writing-video)
- Formula: `((address & $3FFF) << 16) | ((address & $C000) >> 14) | command` — [PD-CMD](https://plutiedev.com/vdp-commands)
- GPGX assembles the command in two halves. The first word sets A13-A0 and CD1-0 and sets pending (in Mode 5 only). The second word clears pending, latches A15-A14 and supplies CD5-CD2 from bits 7-4 (GPGX's description says bits 7-2) — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)

#### CD code table
| CD5-CD0 | Operation | Base command (address 0) |
|---|---|---|
| 000000 | VRAM read | $00000000 |
| 000001 | VRAM write | $40000000 |
| 001000 | CRAM read | $00000020 |
| 000011 | CRAM write | $C0000000 |
| 000100 | VSRAM read | $00000010 |
| 000101 | VSRAM write | $40000010 |
| 001100 | VRAM 8-bit read (undocumented) | $00000030 |
| 1xxxxx | DMA (CD5 set) | e.g. $40000080 VRAM, $C0000080 CRAM, $40000090 VSRAM |
| 110000 | VRAM copy (CD5+CD4) | $000000C0 |

- CD codes: [MDWIKI](https://md.railgun.works/index.php?title=VDP). Base command values: [PD-CMD](https://plutiedev.com/vdp-commands), [PD-WRITE](https://plutiedev.com/writing-video). DMA values: [PD-CMD](https://plutiedev.com/vdp-commands), [PD-DMA](https://plutiedev.com/dma-transfer). GPGX calls code $0C an "undocumented 8-bit VRAM read". For copy, "CD4 should be set (CD0-CD3 ignored) otherwise VDP locks (hard reset needed)". Invalid codes can lock the VDP — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Worked example: VRAM write to $AC80 = $6C800002 — [MDWIKI](https://md.railgun.works/index.php?title=VDP). More examples: VRAM $0000 = $40000000, $1000 = $50000000, $4000 = $40000001, $FFFF = $7FFF0003 — [CHIBI](https://www.chibiakumas.com/68000/genesis.php). CRAM palette lines 0-3 start at $C0000000, $C0200000, $C0400000, $C0600000 — [CHIBI](https://www.chibiakumas.com/68000/genesis.php)

#### The s2disasm `vdpComm` macro (common community form)
- s2disasm defines `vdpComm(addr,type,rwd)`. It ANDs a 6-bit type code with an access code: VRAM = %100001, CRAM = %101011, VSRAM = %100101, READ = %001100, WRITE = %000111, DMA = %100111. CD1-0 go to bits 31-30 and the remaining CD bits to bits 7-4 (`<<2` of the masked $FC part). The address split is the same as above — [S2-MACROS](https://github.com/sonicretro/s2disasm/blob/master/s2.macros.asm)
- Writing data: once the command is set, each data-port access moves the address forward by the auto-increment ($8F). Reads work the same way after a read command — [PD-CMD](https://plutiedev.com/vdp-commands)
- Teradrive / 128 KB VRAM mode puts address bits 16-14 in bits 2-0 of the low word — [PD-CMD](https://plutiedev.com/vdp-commands)

#### Write-pending state
- After the first word of a command, the VDP waits for the second word ("pending"). Any word written in that state is taken as the second half, even if it looks like a register write. Reading the status register clears pending — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c), [PD-SETUP](https://plutiedev.com/vdp-setup)

### Inferences

#### Code: assemble-time command macros (own code; arithmetic script-checked)
```asm
; Base commands
VRAM_W      equ $40000000
VRAM_R      equ $00000000
CRAM_W      equ $C0000000
CRAM_R      equ $00000020
VSRAM_W     equ $40000010
VSRAM_R     equ $00000010
CMD_DMA     equ $00000080      ; OR into a write command to start DMA

; VDPCMD addr,base  -> writes the 32-bit command to the control port
VDPCMD  macro
        move.l  #(((\1)&$3FFF)<<16)|(((\1)&$C000)>>14)|(\2),VDP_CTRL
        endm

;   VDPCMD $0000,VRAM_W  -> $40000000
;   VDPCMD $C000,VRAM_W  -> $40000003   (Plane A)
;   VDPCMD $E000,VRAM_W  -> $60000003   (Plane B)
;   VDPCMD $F000,VRAM_W  -> $70000003   (sprite table)
;   VDPCMD $F400,VRAM_W  -> $74000003   (hscroll table)
;   VDPCMD $0020,CRAM_W  -> $C0200000   (palette line 1)
;   VDPCMD $0000,VSRAM_W -> $40000010
```

#### Code: run-time address to command (own code; traced by hand for $AC80 → $6C800002)
```asm
; In: d0.w = VRAM address.  Out: d0.l = VRAM-write command.
VramWriteCmd:
        andi.l  #$0000FFFF,d0   ; clear the upper word
        lsl.l   #2,d0           ; A15-A14 move to bits 17-16
        lsr.w   #2,d0           ; A13-A0 back to the low word
        swap    d0              ; A13-A0 high, A15-A14 in bits 1-0
        ori.l   #VRAM_W,d0
        rts
```

### Gaps
- Using a register write as a "reset" of a half-written command is unreliable: GPGX treats the word as the second half while pending is set. Plutiedev's advice (read the status) is the safe method.

---

## Q4. Memory: VRAM, CRAM, VSRAM

### Takeaway
VRAM is 64 KB. It holds tiles, the plane, window and sprite tables, and the HScroll table. CRAM is 64 words: 4 palette lines × 16 colours, each colour `0000 BBB0 GGG0 RRR0` (9-bit). VSRAM is 40 words (80 bytes) of vertical scroll values, or 64 words on Model 2 VA4 and later.

### Cited Findings

#### VRAM
- 64 KB. It holds patterns, nametables, the sprite attribute table and the HScroll table. Vertical scroll lives in VSRAM instead — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- VRAM is accessed one byte at a time internally, so a VRAM word takes 2 access slots. CRAM and VSRAM accesses are word-wide and take 1 slot — [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html)
- Writing VRAM at an odd address swaps the bytes of the word ("will byte-swap the data copied") — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0). GPGX has a "Byte-swap data if A0 is set" path — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Capacity examples (H40, NTSC): 64×32 planes, no window and full-screen scroll leave 1771 of 2048 tile slots. 64×64 planes, a 40×3 window and line scroll leave 1470. A full 40×28 screen is 1120 tiles — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- At power-on or reset VRAM holds garbage, so clear VRAM (65536 bytes), CRAM (128 bytes) and VSRAM (80 bytes) — [PD-SETUP](https://plutiedev.com/vdp-setup)

#### CRAM (palettes)
- 64 entries × 9 bits, grouped as 4 lines × 16. Entry 0 of each line is transparent. Blue is in bits 11-9, green in 7-5, red in 3-1 — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [CHIBI](https://www.chibiakumas.com/68000/genesis.php)
- GPGX packs the bus word `0000 BBB0 GGG0 RRR0` into 9 bits. The CRAM index is `(addr >> 1) & 0x3F` — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- 512 possible colours (8 levels per channel) — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/), [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/)
- CRAM dots: writing CRAM during active display shows visible coloured dots. Do CRAM updates (including CRAM DMA) in blanking — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/)

#### VSRAM
- 80 bytes (40 words), separate from VRAM — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/). Each entry is 10 bits — [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html)
- **Revision difference:** most consoles have 40 words, but Model 2 VA4 and later have 64 — [PD-HW](https://plutiedev.com/hardware-issues). GPGX models 40 words and wraps reads at index $50 back to 0 — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Layout: even words (0, 4, … bytes) are Plane A, odd words (2, 6, …) are Plane B, interleaved. ChibiAkumas gives Scroll A at VSRAM $00-$4C and Scroll B at $02-$4E — [CHIBI](https://www.chibiakumas.com/68000/genesis.php)

### Inferences

#### Code: clear CRAM and VSRAM, load a palette (own code, unassembled)
```asm
ClearCramVsram:
        lea     VDP_CTRL,a0
        lea     VDP_DATA,a1
        moveq   #0,d0
        move.l  #CRAM_W,(a0)        ; CRAM address 0
        moveq   #(128/4)-1,d1
ClrCram:
        move.l  d0,(a1)
        dbf     d1,ClrCram
        move.l  #VSRAM_W,(a0)       ; VSRAM address 0
        moveq   #(80/4)-1,d1
ClrVsram:
        move.l  d0,(a1)
        dbf     d1,ClrVsram
        rts

; a0 -> 16 colour words; loads palette line 0 (do this in VBlank)
LoadPalette0:
        move.l  #CRAM_W,VDP_CTRL
        lea     VDP_DATA,a1
        moveq   #16-1,d1
LoadPalLp:
        move.w  (a0)+,(a1)
        dbf     d1,LoadPalLp
        rts

Palette0:
        dc.w    $0000   ; 0: transparent / typical backdrop (black)
        dc.w    $0EEE   ; 1: white  (B=7 G=7 R=7)
        dc.w    $000E   ; 2: red
        dc.w    $00E0   ; 3: green
        dc.w    $0E00   ; 4: blue
        dcb.w   11,$0000
```
- Colour-building rule for a beginner: `word = (B << 9) | (G << 5) | (R << 1)` with each channel 0-7. This is derived from the CRAM bit positions above.

### Gaps
- Exact analog brightness levels per channel step (the DAC is non-linear) were not covered by the sources read.

---

## Q5. Tiles, nametables, planes, window, layer priority, shadow/highlight

### Takeaway
A tile is 8×8 pixels at 4 bpp, so 32 bytes (4 bytes per row). Tile N lives at VRAM byte address N×32. A nametable entry is one word: `P PP V H TTTTTTTTTTT` (priority bit 15, palette bits 14-13, V-flip 12, H-flip 11, tile index 10-0). The window replaces Plane A where it is active, ignores scrolling, and has a fixed nametable width of 32 cells (H32) or 64 cells (H40).

### Cited Findings

#### Tile (pattern) format
- 8×8 pixels, 4 bits per pixel, packed (not bitplanes), $20 bytes per tile. Each 4-byte row holds 8 pixels, 2 per byte — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [CHIBI](https://www.chibiakumas.com/68000/genesis.php), [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- Colour index 0 is transparent — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- Tiles are referenced by index (VRAM address ÷ 32), not by address — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- **Source error:** Copetti's article describes a tile as a "4-byte-long array", which can't be right for 8×8 at 4 bpp. Use 32 bytes — [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/)
- Interlace mode 2: tiles become 8×16 (64 bytes), the nametable tile index LSB is ignored, and GPGX uses a 10-bit pattern index — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)

#### Nametable entry (16 bits)
| Bit(s) | Field |
|---|---|
| 15 | Priority |
| 14-13 | Palette line 0-3 |
| 12 | Vertical flip |
| 11 | Horizontal flip |
| 10-0 | Tile index (0-2047) |
— [MDWIKI](https://md.railgun.works/index.php?title=VDP). GPGX's sprite attribute decode uses the same word layout: tile `& 0x07FF`, flips `& 0x1800`, priority + palette from bits 15-13 — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)
- Entries run left to right, then top to bottom. A 64×32 plane has 2048 entries — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)

#### Planes
- Plane B (background) and Plane A (foreground) are both scrollable and share one size from $90. Possible pixel sizes: 256×256, 256×512, 256×1024, 512×256, 512×512, 1024×256 — [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/), [PD-REG](https://plutiedev.com/vdp-registers)
- Scroll values past the nametable edge wrap around — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Window plane rules
- The window does not scroll — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/), [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/). GPGX reads the window nametable with no H or V scroll applied — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)
- Nametable width is fixed by the H mode, not by $90. GPGX's row stride is 64 bytes (32 cells) in H32 and 128 bytes (64 cells) in H40 — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c). In H40 the window table is always 64×32 entries, of which only the top-left 40×28 is visible — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- The window shows instead of Plane A wherever it is active (it cannot appear where Plane A does). It is often used as a HUD — [MDWIKI](https://md.railgun.works/index.php?title=VDP). Plane A and the window count as one plane for priority — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- Unused parts of the window table can hold tile data — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- **Window bug:** with RIGT = 0 and a Plane A horizontal scroll that is not a multiple of 16, wrong tiles are fetched (at the column next to the window boundary) — [MDWIKI](https://md.railgun.works/index.php?title=VDP). GPGX emulates this under a "Window bug" comment — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)

#### Layer priority order (back to front)
1. Backdrop colour → 2. Plane B low priority → 3. Plane A/Window low → 4. Sprites low → 5. (Window low) → 6. Plane B high → 7. Plane A high → 8. Sprites high → 9. Window high — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- So any high-priority plane tile covers every low-priority sprite. Within one priority class, the order is B < A < sprites.

#### Shadow/highlight ($8C bit 3)
- With S/H on, plane pixels are shadowed (darkened) unless they come from a high-priority tile. A high-priority tile, even a transparent one, prevents shadowing — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- Sprite pixels in **palette line 3, colour 14** are not drawn. Instead they *highlight* the planes underneath. **Palette line 3, colour 15** *shadows* the planes underneath. These operators affect planes only, not other sprites. Shadow on an already shadowed plane does not stack, and highlight on a shadowed plane returns it to normal — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/). MDWIKI says the same in 1-based numbering ("palette 4, colour 15/16") — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Quirk: colour 14 behaves abnormally in S/H mode. RASTER says colour 14 of palettes 0-2 on a sprite displays normal even where it should be shadowed — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- Emulators approximate shadow as half and highlight as double brightness. GPGX builds separate normal/shadow/highlight colour tables — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)

### Inferences
- Nametable cell address = `base + (row × plane_width_cells + col) × 2`. Example: Plane A at $C000, 64-wide, cell (5,3) → $C18A → command $418A0003 (script-checked).
- Writing a **column** of nametable entries: set autoincrement to `plane_width × 2` (128 for a 64-wide plane, `$8F80`), then write words. Restore $8F02 afterwards. This follows from "autoincrement is in bytes".
- Tile pixel order: within each byte, the **high nibble is the left pixel**, and rows run top to bottom. This is universal community practice and consistent with every tool I know, but **none of the sources read in this session state it explicitly** (ChibiAkumas and Plutiedev's writing page don't specify).

#### Code: write a tile and place it on Plane A (own code, unassembled)
```asm
; Upload tile #1 (VRAM $0020) - a solid block of colour 1
        VDPCMD  $0020,VRAM_W        ; -> $40200000
        lea     VDP_DATA,a1
        moveq   #8-1,d1
TileRows:
        move.l  #$11111111,(a1)     ; one row = 8 pixels x 4 bits
        dbf     d1,TileRows

; Put tile 1, palette 0, no flip, low priority at Plane A cell (5,3)
        VDPCMD  $C18A,VRAM_W        ; -> $418A0003
        move.w  #$0001,VDP_DATA
; e.g. palette 2 + high priority + hflip: $8000|$4000|$0800|tile
```

### Gaps
- No source read gives the window's exact behavior at H32 with a 128-wide plane, or at boundaries in interlace mode.
- I found no exact hardware brightness values for shadow/highlight.

---

## Q6. Sprites

### Takeaway
Each Sprite Attribute Table (SAT) entry is 8 bytes:
- word 0: Y + 128 (9 bits)
- word 1: size in bits 11-8 (width-1 in bits 11-10, height-1 in bits 9-8) and link in bits 6-0
- word 2: the same format as a nametable entry
- word 3: X + 128 (9 bits)

Sprites draw in link-list order starting at entry 0, and link 0 ends the list. Limits: H32 = 64 sprites, 16 per line, 256 sprite pixels per line. H40 = 80 sprites, 20 per line, 320 pixels per line. Multi-tile sprites use column-major tile order.

### Cited Findings

#### SAT entry bit layout
| Word | Bits | Field |
|---|---|---|
| 0 | 9-0 (0x1FF normal; 0x3FF in interlace mode 2) | Y position + 128 |
| 1 | 11-10 | Width in cells − 1 |
| 1 | 9-8 | Height in cells − 1 |
| 1 | 6-0 | Link (index of the next sprite) |
| 2 | 15 / 14-13 / 12 / 11 / 10-0 | Priority / palette / V-flip / H-flip / first tile index |
| 3 | 8-0 (0x1FF) | X position + 128 |
- GPGX parsing: `ypos = word0 & 0x1FF` (`& 0x3FF` in IM2), `size = word1 >> 8` with height `8 + ((size & 3) << 3)` and width `8 + ((size & 0x0C) << 1)`, `link = word1 & 0x7F`, `attr = word2`, `xpos = word3 & 0x1FF` — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)
- The entry is 2 bytes Y, 1 byte size, 1 byte link, 2 bytes tile + flags, 2 bytes X. The size byte has width in bits 3-2 and height in bits 1-0 (tiles − 1). Example equates: SPR_1x1 = %0000, SPR_2x1 = %0100, SPR_4x4 = %1111 — [PD-SPR](https://plutiedev.com/sprites)
- Field list (vertical position, H size, V size, link, priority, palette, V/H flip, pattern, H position) — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Coordinates
- Add 128 to both X and Y. Positions refer to the top-left corner — [PD-SPR](https://plutiedev.com/sprites)
- Visible X: 128 to 383 (H32) or 447 (H40). Visible Y: 128 to 351 (V28) or 367 (V30). In interlace mode 2, Y doubles (visible 256-703 / 735) — [MDWIKI](https://md.railgun.works/index.php?title=VDP). The H40 visible area is X 128-447 and Y 128-351 on a 512×512 grid — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)

#### Size and tile order
- 1×1 to 4×4 cells (8×8 to 32×32 px) — [PD-SPR](https://plutiedev.com/sprites)
- Tiles are column-major: the whole first column top to bottom, then the next column — [PD-SPR](https://plutiedev.com/sprites), [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- All tiles in one sprite share priority, palette and flip — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)

#### Link list and draw order
- The link field holds the next sprite's index. The last sprite must have link = 0, otherwise behavior is undefined. Link = (entry address − table base) ÷ 8 — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-SPR](https://plutiedev.com/sprites)
- GPGX stops parsing when the link is 0 or ≥ 64 (H32) / ≥ 80 (H40) — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)
- Sprite 0 has the highest drawing priority. Earlier sprites in the chain cover later ones regardless of the priority bit (the bit only matters against planes) — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/). **CONFLICT:** MDWIKI's sprite section says later sprites in the link list draw above earlier ones, which is the opposite. Elsewhere MDWIKI says excess sprites are dropped and "highest-priority sprites win", which only makes sense if earlier means higher. I follow RASTER (sprite 0 / earlier = on top), which is also the widely used convention. I did not verify this in GPGX's pixel-merge code — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Limits
| Mode | Sprites per frame | Per line | Sprite pixels per line |
|---|---|---|---|
| H32 (256 px) | 64 | 16 | 256 |
| H40 (320 px) | 80 | 20 | 320 |
— [PD-SPR](https://plutiedev.com/sprites), [MDWIKI](https://md.railgun.works/index.php?title=VDP). GPGX has max sprites per line = viewport width ÷ 16 (16/20) and a per-line sprite-pixel limit, and it sets status bit 6 (SOVR) when the per-line count is reached — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)
- Excess sprites are simply not drawn (lower-priority ones drop out) — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/). **CONFLICT:** Copetti says exceeding the limits "corrupts the entire sprite layer". That is not supported by the other sources — [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/)
- Off-screen sprites still count toward the per-line pixel budget ("off-screen sprites are included") — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)

#### Sprite masking (X = 0)
- A sprite at X = 0 (raw value, i.e. screen X −128) hides lower-priority sprites on the scanlines it covers — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- GPGX's exact rule: masking is armed only after a sprite with X ≠ 0 has been processed on that line ("Requires at least one sprite with xpos > 0"). Then an X = 0 sprite masks all remaining sprites on the line. It is also armed if the previous line reached the sprite-pixel limit ("Sprite masking is effective on next line if max pixel width is reached"). It resets each line — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)

#### Sprite cache
- The VDP caches Y, size and link (not X or attributes) internally. Writing the SAT through the VDP updates the cache. Changing the SAT base ($85) without rewriting the table mixes old cached data with new — [PD-SPR](https://plutiedev.com/sprites), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- DMA **copy** into the SAT leaves the cache partly stale, so sprites disappear — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Sprite tile data for a line is fetched during the previous line's blanking — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Buffering practice
- Keep a RAM copy of the SAT (8 bytes × max sprites, 640 bytes for H40), rebuild it each frame, and upload it in VBlank. If there are no sprites, upload a zeroed entry 0 — [PD-SPR](https://plutiedev.com/sprites)

### Inferences

#### Code: one 16×16 sprite (own code, unassembled)
```asm
; Sprite 0 at screen (100,50), 2x2 cells, palette 1, tiles $100-$103
; (column-major: $100 top-left, $101 bottom-left, $102 top-right, $103 bottom-right)
        VDPCMD  $F000,VRAM_W        ; SAT entry 0 -> $70000003
        lea     VDP_DATA,a1
        move.w  #50+128,(a1)        ; word 0: Y
        move.w  #$0500,(a1)         ; word 1: w=2 (%01<<10), h=2 (%01<<8), link=0 (last)
        move.w  #$2100,(a1)         ; word 2: palette 1 (bit 13), tile $100
        move.w  #100+128,(a1)       ; word 3: X
; Entry n lives at SAT base + n*8 (entry 1 -> $F008 -> $70080003).
```
- Rule for a chain of N sprites in a RAM buffer: set entry i's link to i+1 for i < N−1, and entry N−1's link to 0. Then DMA 8×N bytes to the SAT in VBlank.
- To hide unused sprites, terminate the list early. Don't park sprites at X = 0, because that triggers masking. Parking them at Y = 0 (raw) still walks the chain but draws nothing on screen. This is my inference from the masking and Y-range rules.

### Gaps
- I could not consult Nemesis's detailed sprite-masking tests directly. The masking rule is taken from GPGX's implementation and comments.
- I did not confirm whether the per-frame limit in H32 differs when the link chain points at entries 64-79.

---

## Q7. Scrolling (horizontal table, VSRAM, modes, pitfalls)

### Takeaway
HScroll lives in VRAM at the $8D base as pairs of words (Plane A, Plane B):
- full-screen mode uses 1 pair
- per-cell mode uses 1 pair per 8-line row (stride 32 bytes)
- per-line mode uses 1 pair per line (896 bytes for 224 lines)

VScroll lives in VSRAM: 1 pair for full-screen mode, or 1 pair per 16-px column (20 pairs in H40). Values are 10 bits.

### Cited Findings
- Full-screen H scroll: one longword at the table base, high word = Plane A, low word = Plane B. Per 8-px row: one longword per cell row. Per line: one longword per line (224 or 240 lines; 960 bytes for 240) — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Line scroll needs 224 entries per plane (448 entries, 896 bytes). Row scroll uses the same 896-byte layout but only 28 rows × 2 entries are used. Offsets run 0-1023 — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- GPGX reads the line's H scroll at `vram[hscb + ((line & hscroll_mask) << 2)]` (4 bytes per entry) — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c)
- V scroll: full screen uses the first longword of VSRAM (word 0 = Plane A, word 1 = Plane B). Per-2-cell mode uses one longword per 16-px column — [MDWIKI](https://md.railgun.works/index.php?title=VDP). That is 20 columns per plane in H40, or 40 entries (80 bytes) — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- Register 11 values given by ChibiAkumas: $00 = whole plane, $06 = "blocks", $07 = per line — [CHIBI](https://www.chibiakumas.com/68000/genesis.php). Decoded against the $8B layout in Q2 (my decode), $06 = H per cell + V per 2 cells and $07 = H per line + V per 2 cells. ChibiAkumas's remark that vertical scroll is "always in 16-pixel chunks" holds only when VSCR = 1.
- Keep scroll data in RAM buffers and DMA them in VBlank. VSRAM writes should be buffered — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **Left-column ("column −1") bug:** with per-column V scroll plus a non-multiple-of-16 H scroll, the partly visible leftmost column gets a wrong vertical offset and shows garbage — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/). It varies by revision: earlier units show garbage, later ones copy column 0 — [PD-HW](https://plutiedev.com/hardware-issues). GPGX comment: "Left-most column vertical scrolling when partially shown horizontally (verified on PAL MD2)". In H40 the same value is used for both planes, and in H32 V scroll is disabled for that column — [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c). Games often hide it with $80 bit 5 (LCB) or a sprite bar — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/), [PD-REG](https://plutiedev.com/vdp-registers)
- Plutiedev lists vertical scroll as a known emulator-accuracy problem area — [PD-HW](https://plutiedev.com/hardware-issues) (via search summary)

### Inferences
- **Sign convention (unverified in this session's sources):** by common practice, a larger H scroll value moves the plane to the **right**, so a camera scrolling right writes `-cameraX`. A larger V scroll value moves the plane **up**, so write `+cameraY`. Test this in an emulator before teaching it as fact.
- Per-cell H scroll: the entry for cell row r is at `hscroll_base + r × 32`, because the line-indexed table is sampled every 8 lines. This is derived from the 4-bytes-per-line layout plus row mode.

#### Code: full-screen scroll update in VBlank (own code, unassembled)
```asm
; d0.w = Plane A hscroll, d1.w = Plane B hscroll, d2.w = A vscroll, d3.w = B vscroll
SetScroll:
        lea     VDP_DATA,a1
        VDPCMD  $F400,VRAM_W        ; hscroll table -> $74000003
        move.w  d0,(a1)
        move.w  d1,(a1)
        VDPCMD  $0000,VSRAM_W       ; -> $40000010
        move.w  d2,(a1)
        move.w  d3,(a1)
        rts
```

### Gaps
- I did not directly verify the exact meaning of H scroll mode 01 (see the conflict in Q2), the H32 left-column behavior on each hardware revision, or the scroll sign convention.

---

## Q8. DMA (68k→VDP, VRAM fill, VRAM copy)

### Takeaway
How to set up each DMA type:
- **Every type:** enable DMA ($81 bit 4) and use autoincrement 2 for transfers or 1 for fill/copy.
- **68k→VDP transfer:** set the length in words ($93/$94) and the source address ÷ 2 ($95-$97, bit 7 of $97 = 0). Writing the destination command with CD5 set ($…80) starts it. The 68k halts until it is done. The source must not cross a 128 KB boundary. Stop the Z80 around the transfer.
- **Fill:** $97 = $80, then the command, then a data write starts it. The 68k keeps running, so poll status bit 1.
- **Copy:** $97 = $C0, source = VRAM byte address, command $…C0.

### Cited Findings

#### 68k → VRAM/CRAM/VSRAM transfer
- Source and length are counted in words (byte value >> 1). The source is 23 bits, so mask with `and.l #$7FFFFF` after the shift. Registers: $93/$94 length, $95/$96/$97 source — [PD-DMA](https://plutiedev.com/dma-transfer)
- Writing the destination command starts the transfer: VRAM $40000080, CRAM $C0000080, VSRAM $40000090 (plus address bits) — [PD-DMA](https://plutiedev.com/dma-transfer), [PD-CMD](https://plutiedev.com/vdp-commands)
- The VDP holds the bus and the 68k is frozen during 68k→VDP DMA. Fill and copy do not halt the 68k — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [COPETTI](https://www.copetti.org/writings/consoles/mega-drive-genesis/)
- GPGX: source = `(reg23 << 17) | (dma_src << 1)`, and the source wraps within its 128 KB window (`source & 0x1FFFF`) because only the low 16 bits of the word address count up — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- **128 KB boundary bug:** only the low and middle source bytes increment, so a transfer that crosses a 128 KB boundary wraps to the start of that 128 KB block. MDWIKI's example: 64 KB of art at $1F2000 fails past $1FFFFF. RAM is not affected (it sits in one 64 KB block), but ROM and Mega CD Word RAM sources are. Split the DMA or align the data — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-HW](https://plutiedev.com/hardware-issues), [PD-DMA](https://plutiedev.com/dma-transfer)
- Length 0 = 65536 words. Gens and its forks treat it as "no transfer" instead, which hid bugs in old hacks — [PD-HW](https://plutiedev.com/hardware-issues)
- **Z80 bus clash:** if the Z80 accesses the 68k bus (ROM reads, PSG writes) when a DMA starts, the transfer can load garbage. Earlier consoles are worse. The usual fix is to halt the Z80 (bus request) during DMA — [PD-HW](https://plutiedev.com/hardware-issues), [PD-DMA](https://plutiedev.com/dma-transfer). The Z80 keeps running during DMA unless it touches the 68k bus — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **Final command word from RAM:** official documentation says to write the DMA-starting command as two words, with the second word read from RAM (not as one longword). Plutiedev follows this without knowing why — [PD-DMA](https://plutiedev.com/dma-transfer). flamewing's macros stage the low command word in a RAM variable and `move.w` it from there — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)
- Odd source or destination: the VDP ignores source bit 0. An odd VRAM destination byte-swaps the data. An odd CRAM/VSRAM destination "is ignored on real hardware… may behave inconsistently on emulators" — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)
- Mega CD Word RAM source quirk: the first word may fail to latch. Set source and destination one word early and the length one word longer — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Common pattern: queue DMA requests during the frame and run them all at the start of VBlank. RAM sources must stay valid until then — [PD-DMA](https://plutiedev.com/dma-transfer)
- s2disasm/flamewing helper functions: `dmaSource = (addr >> 1) & $7FFFFF`, `dmaLength = (len >> 1) & $7FFF`. Length goes in $93/$94, source in $95/$96/$97, and `$97 = $9700 | ((src >> 16) & $7F)` — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)

#### VRAM fill (DMD = 10, $97 = $80)
- Set the length, set $97 to fill mode, write a VRAM-write command with CD5 set, and the next data-port word starts the fill — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-CMD](https://plutiedev.com/vdp-commands)
- Fill writes **bytes**. GPGX takes each byte from the **high byte** of the last FIFO entry and writes it to `addr ^ 1`, adding the autoincrement each step. So set autoincrement 1 for a contiguous fill — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c), [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)
- flamewing's hardware-derived sequence: the first data write stores the whole word normally. After that, each step writes the high byte to (address ^ 1) while the address advances. From an even address A that gives A+1, A, then A (again), A+3, A+2, A+5, A+4 … This lets the fill length be one less than the byte count. An odd start address causes "a spurious write to the address immediately before". Zero length means a 64 KB fill. Wait for status bit 1 to clear, then restore $8F02 — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)
- Fills to CRAM/VSRAM are buggy and not emulated in most emulators — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0). MDWIKI says fill works on VRAM only — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- A fill repeats the last word written to the FIFO. A new write in the middle of a fill is applied and then used for the rest of it — [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html)
- During fill or copy you may only read the status and HV counter and write the PSG. Other VDP accesses can corrupt VRAM or registers — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### VRAM copy (DMD = 11, $97 = $C0)
- Copy runs only if CD4 is set in the command (CD5+CD4 = $C0 in the low word). It reads `source ^ 1` and writes `addr ^ 1` one byte at a time. The source advances by 1 and the destination by the autoincrement — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- flamewing's `dmaCopyVRAM` writes `$8F01` and `$97C0` together as one long `$8F0197C0`, then busy-waits like the fill — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)

#### DMA bandwidth (bytes)
MDWIKI table, 68k→VRAM. Double these for CRAM/VSRAM destinations — [MDWIKI](https://md.railgun.works/index.php?title=VDP):

| Mode | VBlank (display-disabled lines) | Active display | Total/frame |
|---|---|---|---|
| NTSC 60 Hz H32 V28 | 6118 | 3584 | 9702 |
| NTSC 60 Hz H40 V28 | 7524 | 4032 | 11556 |
| PAL 50 Hz H32 V28 | 14329 | 3584 | 17913 |
| PAL 50 Hz H40 V28 | 17622 | 4032 | 21654 |
| PAL 50 Hz H32 V30 | 11753 | 3840 | 15593 |
| PAL 50 Hz H40 V30 | 14454 | 4320 | 18774 |

- Derived per-line rates: 7524 ÷ 38 blank lines = 198 bytes/line (H40), 6118 ÷ 38 = 161 bytes/line (H32), and 18 or 16 bytes/line during active display (4032 ÷ 224, 3584 ÷ 224). Fill rates are similar. Copy is about half — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- GPGX DMA rate table: active display 16 (H32) / 18 (H40), blanking 166 (H32) / 204 (H40). VRAM and copy rates are halved, and CRAM/VSRAM blanking rates are 161 / 198 — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- **Small CONFLICT:** MDWIKI's VRAM blanking rate (198 bytes/line H40) equals GPGX's CRAM rate, while GPGX's VRAM blanking rate works out to 204 bytes/line. The difference is about 3%, so plan with the lower figure. MDWIKI's own 320×224 PAL fill row has a total that doesn't add up — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Rule of thumb: about 7 KB per NTSC VBlank by DMA, roughly half that by CPU copy loop. That is about 230 tiles per frame. In H40 active display, about 18 bytes per line reach VRAM, and extra writes stall the 68k — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- DMA is faster in VBlank or with the display disabled. During HBlank alone it is about as fast as a CPU loop — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

### Inferences

#### Code: 68k → VRAM DMA with Z80 halt (own code, unassembled; register values checked for src $FF0000 → $9500/$9680/$977F)
```asm
; In: d0.l = 68k source (even, must not cross a 128KB boundary)
;     d1.w = length in BYTES (even, non-zero)   d2.w = VRAM destination (even)
; Assumes autoincrement = 2 and DMA enabled in reg 1.  Uses d3, a0.
DmaToVram:
        lea     VDP_CTRL,a0
        lsr.w   #1,d1               ; bytes -> words
        move.w  #$9300,d3
        move.b  d1,d3
        move.w  d3,(a0)             ; $93: length low
        lsr.w   #8,d1
        move.w  #$9400,d3
        move.b  d1,d3
        move.w  d3,(a0)             ; $94: length high
        lsr.l   #1,d0               ; source bytes -> words
        move.w  #$9500,d3
        move.b  d0,d3
        move.w  d3,(a0)             ; $95: SA8-SA1
        lsr.l   #8,d0
        move.w  #$9600,d3
        move.b  d0,d3
        move.w  d3,(a0)             ; $96: SA16-SA9
        lsr.l   #8,d0
        move.w  #$9700,d3
        move.b  d0,d3
        andi.b  #$7F,d3             ; bit 7 = 0 : 68k->VDP mode
        move.w  d3,(a0)             ; $97: SA23-SA17
        moveq   #0,d0               ; build VRAM-write + DMA command
        move.w  d2,d0
        lsl.l   #2,d0
        lsr.w   #2,d0
        swap    d0
        ori.l   #VRAM_W|CMD_DMA,d0  ; $40000080 | address bits
        move.w  #$0100,$A11100      ; request Z80 bus
WaitZ80Bus:
        btst    #0,$A11100          ; 0 = bus granted
        bne.s   WaitZ80Bus
        move.l  d0,DmaCmdRam        ; DmaCmdRam: a longword variable in 68k RAM
        move.w  DmaCmdRam,(a0)      ; first command word
        move.w  DmaCmdRam+2,(a0)    ; second word, read from RAM: DMA starts, 68k halts
        move.w  #$0000,$A11100      ; release Z80 bus
        rts
```
- For CRAM use `CRAM_W|CMD_DMA` ($C0000080), and for VSRAM `VSRAM_W|CMD_DMA` ($40000090). Z80 bus-request register details ($A11100) belong to the Z80/sound notes. If the Z80 was never started, the bus request may not be needed, but that is untested.

#### Code: clear all VRAM with DMA fill (own code, unassembled)
```asm
; Display off (or VBlank). Fills $0000-$FFFF with $00.
ClearVramFill:
        lea     VDP_CTRL,a0
        move.w  #$8F01,(a0)         ; autoincrement 1: fill writes bytes
        move.w  #$93FF,(a0)         ; length = $FFFF (bytes - 1, per flamewing rule)
        move.w  #$94FF,(a0)
        move.w  #$9780,(a0)         ; DMD = 10 : VRAM fill
        move.l  #$40000080,(a0)     ; VRAM write $0000 with CD5 set
        move.w  #$0000,VDP_DATA     ; fill value (both bytes) - starts the fill
WaitFill:
        move.w  (a0),d0
        btst    #1,d0               ; DMA busy?
        bne.s   WaitFill
        move.w  #$8F02,(a0)         ; restore autoincrement 2
        rts
```
- Writing the fill value as `$XXXX` (same byte twice) avoids byte-order confusion between the first normal word write and the high-byte-only fill steps.
- Length rule (inferred from flamewing's sequence and checked by hand for N = 4 and 6): for an even start A and an even byte count N with autoinc 1, a length of N−1 covers exactly A…A+N−1. A length of N writes 1-2 bytes past the end.

#### Code: VRAM copy (own code, unassembled)
```asm
; Copy d1.w bytes from VRAM d0.w to VRAM $C000 (byte-by-byte; poll busy)
        move.w  #$8F01,VDP_CTRL      ; autoinc 1
        ; $93/$94 = byte count; $95/$96 = SOURCE VRAM BYTE ADDRESS (not halved); $97 = $C0
        ; then command: ((dest&$3FFF)<<16)|((dest&$C000)>>14)|$C0  -> $C000 gives $000000C3
        ; wait for status bit 1 = 0, then restore $8F02
```
- I inferred that the copy source is a plain byte address (not halved) from GPGX advancing the source by 1 per byte. The exact length semantics for copy (count vs count−1) are unconfirmed.

### Gaps
- I found no source that explains *why* the final DMA command word must come from RAM. The usual explanation (the VDP grabbing the bus while the 68k is still fetching the next instruction from ROM) is folklore that I did not verify.
- Exact copy-length behavior and whether copy also does the first-step quirk were not confirmed.
- CRAM DMA during active display: rates and the visual "CRAM dot" pattern were not quantified.

---

## Q9. Interrupts, frame and line timing, VBlank budget, double-buffering

### Takeaway
- **Interrupt levels:** VInt = level 6, HInt = level 4, external = level 2.
- **Frame length:** NTSC V28 has 262 lines per frame, and PAL has 313. VInt fires at the start of line 224 ($E0).
- **Line length:** every line is 3420 master clocks, which is 342 pixel clocks in H32 or 420 in H40.
- **VBlank budget:** NTSC gives about 38 blank lines, roughly 7.5 KB of DMA in H40. PAL V28 gives 89 lines, roughly 17.6 KB.
- **Structure:** update VRAM, CRAM and VSRAM from RAM shadow copies and a DMA queue inside the VInt handler.

### Cited Findings

#### Interrupt levels and enables
| Source | 68k level | Enable | Trigger |
|---|---|---|---|
| External | 2 | $8B bit 3 | TH pin change (light gun). Latches the HV counter |
| HBlank | 4 | $80 bit 4 | $8A counter expires |
| VBlank | 6 | $81 bit 5 | End of active display |
— [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- The VIP status bit is set at about line $E0. VB is live from about $E0 until the counter wraps — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- The HInt on line 224 arrives 788 master clocks (~14.7 µs) before VInt (NTSC, Eke). HInt fires 16 pixels (128 mclk) before the right border starts. HInt can fire on every line from the one before line 0 through the last display line — [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077)
- Simultaneous HInt and VInt are handled correctly. One rare case: a long 68k instruction that starts just before HInt makes the CPU take the VInt vector (Snake) — [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077)
- **HInt counter reload CONFLICT/nuance:** MDWIKI says the counter reloads only at the top of the screen or when an HInt fires — [MDWIKI](https://md.railgun.works/index.php?title=VDP). Eke says HInt can occur from the line before line 0 — [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077).

#### Line timing / H counter
- 3420 mclk per line in both H32 and H40 — [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655), [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html). Master clock ≈ 53 MHz. The pixel clock is mclk/10 in H32. H40 uses /8 during the visible part and /10 for part of the blanking — [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html)
- Nemesis's hardware-tested 9-bit internal H counter (the external $C00008 low byte = internal >> 1):

| Region | H32 | H40 |
|---|---|---|
| Active display | $018-$117 | $01A-$159 |
| Right border | $118-$125 | $15A-$167 |
| Counter jump | $127 → $1D2 | $16C → $1C9 |
| H sync | $1D9-$1F2 | $1CD-$1EC |
| Pixel clocks per line | 342 | 420 |
— [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655). On the external 8-bit counter the jumps are $93→$E9 (H32) and $B6→$E4 (H40). Those values are derived by me, and a forum post in the same thread quotes "0x00-0xB6, 0xE4-0xFF" for H40.
- **CONFLICT:** MDWIKI says the H40 counter "continues to 360, then jumps to −46". Nemesis's table gives $16C (364) → $1C9 (−55). I prefer Nemesis (hardware-tested) — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655)

#### Frame timing / V counter
| Mode | V counter sequence | Lines/frame |
|---|---|---|
| NTSC V28 | $000-$0EA, then $1E5-$1FF | 262 |
| PAL V28 | $000-$102, then $1CA-$1FF | 313 |
| PAL V30 | $000-$10A, then $1D2-$1FF | 313 |
| NTSC V30 | $000-$1FF free-running (no vblank reset) | not a valid video mode |
— [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655) (Nemesis: "confirmed through hardware testing"). GPGX's `vc_max` values match ($EA/$102 for V28, $106/$10A for V30, NTSC/PAL) — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c). MDWIKI gives the same jump points in decimal (V28: 224→234 then 229; V30: …→210) — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **CONFLICT:** one forum measurement (Jorge) found 314 PAL lines. Eke noted most documents say 313 — [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077)
- **V30 on NTSC:** the picture rolls, VInt drops to 30 Hz, and there is no vsync pulse. Use V30 on PAL only, and V28 on NTSC — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077), [SM-HV](https://gendev.spritesmind.net/forum/viewtopic.php?p=35655)

#### Access slots, FIFO
- Active-display external access slots per line: 16 (H32) and 18 (H40). In H40 that is one slot per 2-cell group, with a refresh cycle in every 4th group — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- The FIFO holds 4 entries. When it is full, the next CPU write stalls the 68k until an entry drains. A VRAM entry needs 2 slots, CRAM/VSRAM 1. VRAM reads use a 1-slot prefetch, and the FIFO takes priority over it — [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html), [MDWIKI](https://md.railgun.works/index.php?title=VDP)

#### Budget and double-buffering
- Keep RAM buffers (SAT, scroll tables) and DMA them each VBlank. Queue DMA during the frame and flush it at the start of VBlank — [PD-SPR](https://plutiedev.com/sprites), [MDWIKI](https://md.railgun.works/index.php?title=VDP), [PD-DMA](https://plutiedev.com/dma-transfer)
- Disabling the display (in $81) gives full-speed access, which is useful for bulk loads. Some games blank extra lines to enlarge VBlank — [MDWIKI](https://md.railgun.works/index.php?title=VDP) (the display-disable speed claim; the "extra lines" technique is inference)
- PAL has much more VBlank DMA time than NTSC (see the Q8 table) — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- Safe area: up to 2 tiles at the sides and 1 tile at the top and bottom may be cut off on TVs. 50 Hz output shows thick top and bottom borders — [PD-HW](https://plutiedev.com/hardware-issues)

### Inferences
- NTSC V28 has 262 − 224 = 38 non-display lines per frame, PAL V28 has 89 and PAL V30 has 73. At about 198-204 VRAM bytes per blank line in H40, NTSC gets about 7.5 KB of DMA per VBlank. That matches MDWIKI's 7524 and RASTER's "~7 KB".
- 68k cycles per line ≈ 3420 ÷ 7 ≈ 488.6 (68k = mclk/7). This is my arithmetic. The 68k clock divisor belongs to the CPU notes.
- 68000 autovectors: level 2 → vector at $68, level 4 → $70, level 6 → $78. This is standard 68000 behavior, not re-verified in this session. To let VInt through but not HInt, set SR to $2500. `$2300` also allows HInt.
- Double-buffering options for a beginner: (1) a RAM shadow of the SAT and scroll tables plus a DMA queue in VInt (the simplest and the standard); (2) two VRAM tile areas for animated art, swapping which tiles the nametable or sprites reference after the DMA completes; (3) two nametables, flipping $82/$84 in VBlank (costs VRAM). Avoid flipping the SAT base ($85) as a double buffer, because of the sprite-cache mixing quirk (Q6).

#### Code: VInt-driven frame sync (own code, unassembled)
```asm
VBlankFlag  equ $FFFF00             ; a RAM byte (example address)

VIntHandler:                        ; vector $78 (level 6 autovector)
        movem.l d0-d7/a0-a6,-(sp)
        ; ... flush DMA queue: SAT buffer, scroll buffers, palettes, tiles ...
        st      VBlankFlag
        movem.l (sp)+,d0-d7/a0-a6
        rte

WaitVBlank:                         ; main loop calls this once per frame
        sf      VBlankFlag
WaitVBLoop:
        tst.b   VBlankFlag
        beq.s   WaitVBLoop
        rts

; enable: move.w #$8174,VDP_CTRL (display+VInt+DMA)  then  move.w #$2500,sr
```
- Main-loop code that also writes VDP commands races with the VInt handler. If VInt fires between the two words of a command, or between setting an address and writing data, the main code's address is lost. Either do all VDP access inside VInt, or wrap main-loop VDP sequences in `move.w #$2700,sr` … restore. This is standard practice, inferred from the pending/address behavior in Q3.

### Gaps
- I found no source giving an exact H-counter value at which VInt asserts in H32 vs H40.
- The HInt counter reload during VBlank needs confirmation from genvdp.txt or Nemesis's posts, which I could not read.

---

## Q10. Common bugs and pitfalls (checklist for a tutor)

### Takeaway
Most beginner VDP bugs come from five things: sending a wrong or half-written control word, writing at the wrong time (active display, CRAM dots, FIFO stalls), forgetting autoincrement or display/DMA enables, DMA edge cases (128 KB boundary, length 0, Z80), and NTSC/PAL mode mismatches.

### Cited Findings
- **Byte access to VDP ports:** not allowed. The data port takes words/longs only, and byte writes duplicate onto both bus halves — [PD-WRITE](https://plutiedev.com/writing-video), [SM-BYTE](https://gendev.spritesmind.net/forum/viewtopic.php?p=36170)
- **`clr` on a VDP port:** the 68000 read-before-write confuses the VDP — [PD-SETUP](https://plutiedev.com/vdp-setup)
- **Half-written command / pending state:** read the status (`tst.w VDP_CTRL`) to reset it at init — [PD-SETUP](https://plutiedev.com/vdp-setup), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- **Register write in the middle of a data stream:** it unsets the address, so re-send the address command — [PD-CMD](https://plutiedev.com/vdp-commands)
- **Autoincrement:** $8F is in bytes. Use 2 for normal word streams and 1 for fill/copy, and restore it afterwards — [PD-REG](https://plutiedev.com/vdp-registers), [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)
- **Writing during active display:** only about 16-18 bytes per line reach VRAM, the FIFO (4 entries) fills, and the 68k stalls. CRAM writes produce visible dots — [RASTER](https://rasterscroll.com/mdgraphics/vdp-inner-workings/), [RADDAD](https://raddad772.github.io/2024/07/21/genesis-vdp-pt-3.html), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **Odd addresses:** VRAM writes at odd addresses byte-swap, odd DMA sources lose bit 0, and fills at odd addresses do a spurious write — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0)
- **DMA disabled:** with $81 bit 4 clear, CD5 is masked and a "DMA" command becomes a plain write — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- **DMA length 0** means 64K words, which corrupts VRAM. Old emulators hide this — [PD-HW](https://plutiedev.com/hardware-issues)
- **128 KB source boundary** wraparound — [PD-HW](https://plutiedev.com/hardware-issues), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **Z80 touching the bus when DMA starts** loads garbage, so halt the Z80 — [PD-HW](https://plutiedev.com/hardware-issues)
- **Touching the VDP during fill/copy** (anything but status/HV/PSG) corrupts VRAM or registers — [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **V30 on NTSC:** rolling picture, 30 Hz VInt — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [SM-TIMING](https://gendev.spritesmind.net/forum/viewtopic.php?p=8077)
- **Mode 5 bit:** $81 bit 2 must be 1, or the VDP runs in SMS Mode 4 and registers 11-23 are ignored — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- **H40 alignment:** the window base must be a multiple of $1000 and the SAT a multiple of $400 — [PD-REG](https://plutiedev.com/vdp-registers), [MDWIKI](https://md.railgun.works/index.php?title=VDP)
- **Sprite list not terminated** (no link = 0) gives undefined results. A sprite at raw X = 0 masks others. The SAT base change and DMA-copy cache quirks also apply — [MDWIKI](https://md.railgun.works/index.php?title=VDP), [GPGX-RENDER](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_render.c), [PD-SPR](https://plutiedev.com/sprites)
- **Invalid command codes** (e.g. a copy without CD4) can lock up the VDP until a hard reset — [GPGX-CTRL](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- **Uninitialized VRAM/CRAM/VSRAM** contains garbage at power-on — [PD-SETUP](https://plutiedev.com/vdp-setup)
- **TMSS:** on later Model 1 and all Model 2/3 consoles, the VDP stays disabled until "SEGA" is written to the TMSS register — [MDWIKI](https://md.railgun.works/index.php?title=VDP). The register is at $A14000 — [CHIBI](https://www.chibiakumas.com/68000/genesis.php)
- **Emulator differences:** CRAM/VSRAM fills, vertical scroll, length-0 DMA and the left-column scroll bug all vary between emulators. Test on accurate emulators (GPGX, BlastEm) or hardware — [FW-DMA](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0), [PD-HW](https://plutiedev.com/hardware-issues)
- **Window bug** with RIGT = 0 and Plane A H scroll not a multiple of 16 — [MDWIKI](https://md.railgun.works/index.php?title=VDP)

### Inferences

#### Code: minimal TMSS unlock (own code; the version-register check is standard practice, not verified this session)
```asm
        move.b  $A10001,d0          ; version register
        andi.b  #$0F,d0             ; hardware revision: 0 = no TMSS
        beq.s   NoTmss
        move.l  #$53454741,$A14000  ; 'SEGA'
NoTmss:
```

#### Code: polling VBlank (only valid with the display ON; see Q1)
```asm
WaitVBPoll:
        lea     VDP_CTRL,a0
WaitVBEnd:
        move.w  (a0),d0
        btst    #3,d0               ; VB
        bne.s   WaitVBEnd           ; still in the previous VBlank
WaitVBStart:
        move.w  (a0),d0
        btst    #3,d0
        beq.s   WaitVBStart
        rts
```
- Tutor checklist order for a "black screen" bug: TMSS → Mode 5 bit → display bit ($81 bit 6) → CRAM loaded (all-zero CRAM = black) → nametable points at the right tiles → plane base registers match where the data was written → no byte or `clr` accesses.

### Gaps
- I could not read Sega's official Genesis Software Manual. Its "prohibited" list (byte access, DMA from RAM rules) is known here only second-hand through Plutiedev and the forums.
- I did not directly verify BlastEm-specific behavior.
