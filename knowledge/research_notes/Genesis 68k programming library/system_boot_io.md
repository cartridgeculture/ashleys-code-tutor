# Sega Genesis / Mega Drive: System Architecture, Boot Process and I/O (for a 68k assembly beginner tutor)

Research date: 2026-11-18. Ground-truth sources used: Plutiedev (several pages), Genesis Plus GX (GPGX) emulator source (genesis.c, mem68k.c, io_ctrl.c, vdp_ctrl.c), SGDK boot code (sega.s), the Sonic 1 disassembly (s1disasm), Wikibooks memory map, Nicole Express TMSS article (June 2026), SpritesMind forum threads, Hugues Johnson's 6-button article, ChibiAkumas. Sega Retro pages were blocked by a bot wall during this session (only search snippets were seen). Charles MacDonald's genvdp.txt mirror failed to load. Big Evil Corporation material was not reached.

Source-safety note: the Nicole Express page contained an embedded block of text addressed to AI agents (asking to fetch unrelated material and change instructions). It was ignored; only its technical findings are used below.

---

## 1. Full 68000 memory map (and which accesses lock up the machine)

### Takeaway
The 68000 sees cartridge ROM at $000000-$3FFFFF, Z80 space at $A00000, the I/O chip at $A10000, Z80 bus/reset control at $A11100/$A11200, TMSS at $A14000, the VDP at $C00000 and 64 KB work RAM at $FF0000-$FFFFFF. Touching unmapped/invalid control or VDP addresses (and reading the PSG) halts the 68000 on real hardware, which emulators model as a "lockup".

### Cited Findings
**Main map**
- $000000-$3FFFFF cartridge ROM/RAM; $400000-$7FFFFF reserved (Sega CD and 32X); $800000-$9FFFFF reserved (possibly 32X); $A00000-$A0FFFF Z80 address space; $A10000-$A10001 version register (read-only); $A10002-$A1000D controller 1/2/expansion data and control; $A1000E-$A1001F serial registers; $A11000 memory mode register; $A11100-$A11101 Z80 bus request; $A11200-$A11201 Z80 reset; $A14000-$A14003 TMSS register; $C00000-$C00003 VDP data (second word mirrors); $C00004-$C00007 VDP control (second word mirrors); $C00008-$C00009 HV counter; $C00011 PSG; $FF0000-$FFFFFF 68000 RAM. Everything else in $A11002-$FEFFFF listed as reserved. — [Wikibooks: Genesis Programming/68K Memory map](https://en.wikibooks.org/wiki/Genesis_Programming/68K_Memory_map/)
- Cross-check of the core regions (ROM $000000-$3FFFFF, Z80 RAM $A00000-$A01FFF, pad data ports, VDP data $C00000-$C00003, VDP control $C00004-$C00007, RAM $FF0000-$FFFFFF); VRAM (64 KB) is not on the 68000 bus and is only reachable through the VDP ports or DMA. — [Rasterscroll: Mega Drive architecture](https://rasterscroll.com/mdgraphics/mega-drive-architecture/)
- A homebrew linker script places ROM at $000000-$3FFFFF and RAM at $FF0000-$FFFFFF (search-result summary). — [md-framework (Mike J Moffitt)](https://github.com/Mikejmoffitt/md-framework)
- Mega CD changes the map when attached: $000000-$01FFFF Mega CD BIOS, $020000-$03FFFF Program RAM bank window (only while the Sub-CPU is halted), $200000-$23FFFF Word RAM, $A12000-$A120xx gate array, $FFFD00-$FFFDFF Mega CD exception vectors. — [Wikibooks](https://en.wikibooks.org/wiki/Genesis_Programming/68K_Memory_map/)
- $A13000-$A130FF asserts the cartridge /TIME line (used by mappers, SRAM control and flash carts). Allocations: $A13000-$A1300F private use (Pier Solar uses it), $A130C0-$A130CF MegaWiFi, $A130D0-$A130E7 Mega EverDrive, $A130EC-$A130EF 32X signature, $A130F0-$A130FF Sega mapper (SRAM control at $A130F1). — [Plutiedev: $A130xx usage](https://plutiedev.com/a130xx-usage)

**Z80 window ($A00000-$A0FFFF) as seen by the 68000 (GPGX)**
- $A00000-$A03FFF: Z80 RAM, 8 KB (`zram[address & 0x1FFF]`, so $A02000-$A03FFF mirrors $A00000-$A01FFF). $A04000-$A05FFF: YM2612 (`address & 3` selects the 4 ports, i.e. $A04000-$A04003). $A06000: Z80 bank register (bit 0 written serially). $A07F00 from the 68000 side: lockup. Each 68000 access to the Z80 area costs extra cycles (GPGX adds 7). — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c)
- Z80 RAM must be accessed bytewise only (word accesses do not work); always request the bus and wait for the grant first. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)

**I/O area ($A10000-$A1001F)**
- Port registers are byte-sized, 2 bytes apart, on odd addresses: Pad 1 data $A10003 / control $A10009 / serial TxData $A1000F, RxData $A10011, S-ctrl $A10013; Pad 2 data $A10005 / control $A1000B / TxData $A10015, RxData $A10017, S-ctrl $A10019; Expansion ("modem") data $A10007 / control $A1000D / TxData $A1001B, RxData $A1001D, S-ctrl $A1001F. — [Plutiedev: I/O ports](https://plutiedev.com/io-ports)
- Control port bits 6-0 set each pin's direction (1 = output from console, 0 = input); bit 7 enables the external interrupt (keep 0 unless needed). Data writes only affect output pins; reads return all pins. — [Plutiedev: I/O ports](https://plutiedev.com/io-ports)
- GPGX: I/O chip writes only land on the odd (low) byte; word reads return the byte duplicated in both halves; data-port reads return output-latch bits for pins set as outputs and live pin levels for inputs (bit 7 always comes from the latch). Power-on defaults: all data and control registers $00 (TxData $FF/$FF/$FB). — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c); [GPGX io_ctrl.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/io_ctrl.c)

**Version register $A10001**
- Bit 7 "Mode" (from the I/O chip's /LANG pin), bit 6 "VMode" (from /PAL pin), bit 5 "Disk" (from /DISK pin), bit 4 reserved, bits 3-0 "Version" (forum post by mickagame, 2021-02-15). — [SpritesMind forum thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=36906)
- Version nibble reads 0 on the 315-5309 I/O chip and 1 on the 315-5402 and all later I/O chips (Mask of Destiny); "hardwired to 0001 on all hardware I have seen that has TMSS" and "not adjustable externally" (TmEE). — [SpritesMind forum thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=36906)
- GPGX builds the register as `region_code | (config.bios & 1)` and ORs in $20 whenever no Mega CD is attached, i.e. bit 5 = 1 means "no expansion/CD unit". — [GPGX io_ctrl.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/io_ctrl.c)

**Z80 control, TMSS, misc**
- $A11000 memory mode: reads open bus, writes discarded (in GPGX). $A11100: word write bit 8 / byte write bit 0 (even address) = BUSREQ; byte read at $A11100 bit 0 (word read bit 8) is 0 only when the bus is granted AND the Z80 is out of reset; odd-byte reads are open bus. $A11200: word bit 8 / byte bit 0 = Z80 /RESET (0 = held in reset). — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c)
- $A14000: TMSS; GPGX only honours word writes (byte writes ignored). $A14101: boot-ROM/cartridge switch (bit 0 = 1 cartridge, 0 internal TMSS ROM). — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c); [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c)
- On the 315-5402 I/O chip, banking in the TMSS ROM via the banking register freezes the machine (forum observation). — [SpritesMind forum thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=36906)

**VDP / PSG area ($C00000-$DFFFFF)**
- Data port $C00000, control port $C00004, HV counter $C00008; ports accept 16- or 32-bit access (a 32-bit access = two 16-bit accesses). — [Plutiedev: VDP setup](https://plutiedev.com/vdp-setup)
- GPGX maps all 64 KB pages $C0-$DF to the VDP handlers (i.e. the VDP is mirrored through $C00000-$DFFFFF) and decodes the low address bits: $C00000-$C00003 data, $C00004-$C00007 control/status, $C00008-$C0000F HV counter (byte reads give high = V, low = H), $C00010-$C00017 PSG writes (byte writes only at odd addresses such as $C00011; word writes use the low byte), $C0001C debug/test register. — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c); [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c)

**What locks up the machine (GPGX "m68k_lockup" handlers = 68000 halted)**
- Reading the PSG range $C00010-$C00017; invalid VDP offsets; invalid $A1xx00 control pages (e.g. $A15100 32X registers with no 32X attached); 68000 access to $A07F00 (Z80-side VDP mirror). — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c)
- Any VDP access before TMSS is satisfied on a TMSS console: GPGX maps the VDP ports to the lockup handlers until "SEGA" has been written. — [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c)
- Unused areas/bits return "open bus" (the prefetched instruction word), not zero. — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c)

**Work RAM**
- RAM is $FF0000-$FFFFFF (64 KB); its state at power-on is undefined on some systems. — [Plutiedev: ROM header](https://plutiedev.com/rom-header); [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c)

### Inferences
- Because the 68000 has a 24-bit address bus, $FFFF8000-$FFFFFFFF (sign-extended 16-bit "absolute short" addresses) hit the top half of work RAM, which is why commercial code uses `(addr).w` for RAM variables at $FF8000-$FFFFFF. (Standard 68000 behaviour; not re-verified in a fetched source this session.)
- Polarity of $A10001 bits 7/6 as commonly documented: bit 7 = 1 overseas (US/EU), 0 = domestic (Japan); bit 6 = 1 PAL (50 Hz), 0 = NTSC. The fetched sources only give the pin names (/LANG, /PAL), so the tutor should present polarity with a "check in an emulator" note.
- For a beginner, the safe rule is: only touch the documented registers, use byte access on odd I/O addresses, word/long access on VDP ports, never read $C00011, and never touch the VDP before the TMSS step.

### Gaps
- Exact real-hardware VDP mirror/lockup conditions (which address bits within $C00000-$DFFFFF must be zero) were not verified: Charles MacDonald's genvdp.txt mirror failed to load, and GPGX's handler masks are an emulator's model.
- Whether 68000 reads of Z80 RAM without holding the bus lock up or just return garbage on hardware: GPGX does not check bus ownership; Plutiedev only says "always pause first".
- Model 1/2/3 differences in the map itself: none found beyond TMSS and I/O chip revision.

---

## 2. ROM header at $100-$1FF

### Takeaway
The header is 256 fixed-width, space-padded ASCII fields after the 64-entry vector table. On real hardware only the "SEGA" in the system-type field at $100 matters (TMSS); the checksum and region fields are checked only by game code or by emulators.

### Cited Findings
- Field layout: $100 system type (16), $110 copyright/date (16), $120 domestic title (48), $150 overseas title (48), $180 serial (14), $18E checksum (2), $190 device support (16), $1A0 ROM start/end (8), $1A8 RAM start/end (8), $1B0 extra memory/SRAM (12), $1BC modem (12), $1C8 reserved spaces (40), $1F0 region (3), $1F3 reserved spaces (13). — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- System type examples: "SEGA MEGA DRIVE " and "SEGA GENESIS    " (also "SEGA 32X", "SEGA EVERDRIVE", "SEGA SSF", "SEGA MEGAWIFI", "SEGA PICO", "SEGA TERA68K"/"SEGA TERA286"). — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- Copyright format `(C)XXXX YYYY.ZZZ` (4-char publisher code, 4-digit year, 3-letter uppercase month). Serial `XX YYYYYYYY-ZZ` (GM = game, AI = aid, OS/BR = boot ROMs; ZZ = revision from 00). Titles: uppercase, space-padded; may contain Shift-JIS (the only field allowing non-ASCII). — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- Checksum ($18E): 16-bit sum of every big-endian word from $000200 to the end of ROM, keep the low 16 bits; some games and emulators verify it, otherwise no effect. — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- Example of game-side checking: Sonic 1 sums $200-end on cold boot, compares with the header, and on mismatch fills the palette red and halts (header: "SEGA MEGA DRIVE ", "(C)SEGA 1991.APR", serial "GM 00004049-01", checksum $AFC7, I/O "J", RAM $FF0000-$FFFFFF, region "JUE"). — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm)
- Device support codes: J 3-button, 6 6-button, 0 Master System pad, A analog, 4 multitap, G lightgun, L Activator, M mouse, B trackball, T tablet, V paddle, K keyboard, R RS-232, P printer, C CD-ROM, F floppy, D download. Only list "6" if the extra buttons are used. — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- ROM range: start $000000, end = ROM size - 1 (e.g. $07FFFF for 512 KB, $3FFFFF for 4 MB). RAM range: $FF0000-$FFFFFF. — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- Extra memory ($1B0): spaces if none; SRAM = "RA", type byte, $20, 4-byte start, 4-byte end. Type $A0/$B0/$B8 = non-saving 16-bit/even/odd; $E0/$F0/$F8 = battery-backed 16-bit/even/odd. EEPROM = "RA",$E8,$40 then start/end (often both $200001). — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- Modem field: spaces if unsupported; otherwise `MOxxxxyy,zww`. — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- Region ($1F0): old style = letters J (Japan), U (Americas), E (Europe) in any order, space padded ("JUE" = all; Plutiedev recommends old style for homebrew); new style = one ASCII hex digit: bit 0 domestic 60 Hz, bit 1 domestic 50 Hz, bit 2 overseas 60 Hz, bit 3 overseas 50 Hz. "E" is ambiguous (old = Europe, new = all except Japan); check all three bytes, don't assume trailing spaces. — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- Hardware check: the system-type field is the only part the console checks; without "SEGA" there, TMSS consoles refuse to boot. Emulators may use other fields (window title, peripheral defaults). — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- TMSS looks for "SEGA" or " SEGA" at $100. — [Nicole Express, "The Truth about TMSS" (2026-06-07)](https://nicole.express/2026/the-truth-about-tmss.html); consistent with Sega Retro's description of the longword "SEGA" at $100 (search snippet only; page blocked) — [Sega Retro: TMSS](https://segaretro.org/TMSS)

### Inferences
- For homebrew: start the header with exactly `"SEGA MEGA DRIVE "` or `"SEGA GENESIS    "` (both begin with "SEGA" at $100), region "JUE", I/O "J", checksum either correct or zero. A wrong checksum only matters if your own code checks it (or an emulator warns).
- Region lock is purely software: the header region letters do not stop a cartridge from running; games enforce region by reading $A10001.

### Gaps
- No authoritative statement found on whether any emulator refuses to run (rather than warn) with a bad checksum.
- No verified minimum ROM size requirement for flash carts/emulators was found (some people pad to a power of two; unverified).

---

## 3. TMSS (TradeMark Security System)

### Takeaway
On TMSS consoles the VDP stays locked (68000 halts on VDP access) until the cartridge writes the ASCII longword "SEGA" ($53454741) to $A14000; the boot ROM also requires "SEGA" at $100 of the header. Detect the need by reading $A10001: if bits 3-0 are nonzero, do the write. Doing it unconditionally on old consoles is the standard pattern's alternative but the version check is what Sega and SGDK do.

### Cited Findings
- SGDK boot: `move.b 0xA10001,d0` / `andi.b #0x0f,%d0` / `beq.s NoTMSS` / `move.l #0x53454741,0x2f00(%a0)` with a0 = $A11100 (so the target is $A14000), commented "Sega Security Code (SEGA)". — [SGDK sega.s](https://github.com/Stephane-D/SGDK/blob/master/src/boot/sega.s)
- Sonic 1's entry code does the same: read $A10001, mask the low nibble, if nonzero write 'SEGA' to $A14000. — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm)
- GPGX: "VDP requires 'SEGA' value to be written in TMSS register"; on match the VDP ports are mapped to the real handlers, otherwise to lockup handlers; VDP is locked by default at hard reset when the TMSS BIOS option is enabled. Only word writes to $A14000 are accepted. — [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c); [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c)
- TeraDrive hardware notes: writing 'SEGA' to $A14000 unlocks; hardware treats writes as word-wide, so byte writes cannot unlock (search-snippet summary). — [BlastEm wiki: TeradriveHardwareNotes](https://www.retrodev.com/blastem/trac/wiki/TeradriveHardwareNotes?version=14)
- Not doing the write means the VDP won't cooperate on hardware that requires it, and the version register tells you whether it is needed (forum reply; not a formal spec). — [SpritesMind forum (search snippet)](https://gendev.spritesmind.net/forum/viewtopic.php?p=36906)
- Version nibble: 0 on 315-5309 I/O chip, 1 on 315-5402 and later; 315-5402 (seen only in Japanese machines, VA5) shows no TMSS in JP mode but does in EN mode; the 'SEGA' write is reportedly unnecessary when the language jumper is JP. — [SpritesMind forum thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=36906)
- Models (2026 hardware tests): Model 1 VA3 Genesis has no security; Model 1 VA6 onward shows the TMSS screen; Mega Drive 2 (Japan), Genesis 3 (export and Japan) and Sega CDX reject a cartridge with a modified header; PAL consoles reportedly behave like US ones. A game with "SEGA" in the header but no $A14000 write works on Japanese consoles but fails on export ones; overwriting the header "SEGA" makes a game fail even in Japan. The boot ROM shows its screen and then turns the VDP off again. — [Nicole Express (2026-06-07)](https://nicole.express/2026/the-truth-about-tmss.html)
- Sega patent description (search snippet): boot code writes "SEGA" to a VDP-related register during init; if an incorrect code is written, the CPU is stopped when it accesses the VDP. — [Sega Retro TMSS / patent (search snippet)](https://segaretro.org/TMSS)

### Inferences
- Practical rule for the tutor: (1) header starts with "SEGA"; (2) very first thing in the entry point, before any VDP access: `move.b $A10001,d0 / andi.b #$0F,d0 / beq.s .skip / move.l #'SEGA',$A14000`. Use `move.l` (two word writes), never `move.b`.
- Biggest beginner trap: GPGX applies TMSS only when its BIOS option is on, so a ROM that forgets the write can run fine in emulators but black-screen/hang on a real Model 1 VA6+, Model 2 or Model 3. Test in an emulator with TMSS BIOS enabled.
- Never write to $A14101 in homebrew.

### Gaps
- The exact boot-ROM string comparison (bytes $100-$103 vs $101-$104 for " SEGA") is described by Nicole Express but not by a disassembly fetched in this session.
- Sega Retro's model/revision table could not be read (bot wall).

---

## 4. Recommended init sequence (Sega-style vs community)

### Takeaway
A safe beginner init order is: interrupts off → (optional soft-reset check) → clear RAM → TMSS → read VDP control port → write all VDP registers with display off → clear VRAM/CRAM/VSRAM → Z80: request bus, release reset, wait for grant, load a tiny program, pulse reset (also resets the YM2612), release bus → silence PSG → set up controller ports → load graphics → enable display + VBlank interrupt → lower SR mask.

### Cited Findings
**Sonic 1 / Sega-style block (s1disasm `EntryPoint`)**
- Soft-reset check: test the port 1 control and expansion control registers ($A10008 long / $A1000C word); if already nonzero, the console was initialized before, so skip setup. — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm); same tests (`tst.l 0xa10008`, `tst.w 0xa1000c`) in [SGDK sega.s](https://github.com/Stephane-D/SGDK/blob/master/src/boot/sega.s)
- Then: TMSS; read VDP control port to clear the write-pending flag; write VDP registers $80-$92 from a table: $80=$04, $81=$14 (Mode 5, DMA on, display off), $82=$30 (plane A $C000), $83=$3C (window $F000), $84=$07 (plane B $E000), $85=$6C (sprites $D800), $86=$00, $87=$00 (backdrop), $88/$89=$00, $8A=$FF (HInt counter), $8B=$00, $8C=$81 (H40), $8D=$37 (H-scroll $DC00), $8E=$00, $8F=$01, $90=$01 (64-wide planes), $91=$00, $92=$00; then DMA length $FFFF, DMA fill VRAM ($97=$80) with command $40000080 to clear all VRAM. — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm)
- Z80: request bus and wait; copy a small Z80 program that clears the rest of Z80 RAM with LDIR, clears registers, sets IM 1, DI, then spins (overwrites its first byte with $E9 `jp (hl)`); assert reset, release bus, release reset. — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm)
- Clear work RAM (longword loop), set display mode and autoincrement, clear CRAM and VSRAM (20 longs), silence PSG by writing $9F, $BF, $DF, $FF to $C00011, clear registers, interrupts disabled, jump to the game. — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm)

**SGDK (`sega.s`)**
- `move #0x2700,%sr`; stack setup; write $0100 to $A11100 (Z80 bus request) and $A11200 (end Z80 reset); soft-reset check; TMSS check/write; jump to C startup. No VDP status read or PSG init in this file (done later in C). Vector table: $68 level 2 ext int, $70 level 4 HInt, $78 level 6 VInt, other autovectors to a generic handler. Uses GNU as syntax (`%` register prefixes). — [SGDK sega.s](https://github.com/Stephane-D/SGDK/blob/master/src/boot/sega.s)

**Plutiedev (community, beginner-oriented)**
- Read the control port first (`tst.w (VdpCtrl)`) because the console may have been reset mid-command; it puts the VDP in a known state. — [Plutiedev: VDP setup](https://plutiedev.com/vdp-setup)
- Suggested registers: 0=$04, 1=$04, 2=$30 (A at $C000), 3=$34 (window $D000), 4=$07 (B at $E000), 5=$78 (sprites $F000), 7=$00, 10=$FF, 11=$00, 12=$81 (H40), 13=$3D (H-scroll $F400), 15=$02, 16=$01 (64x32), 17=$00, 18=$00; DMA registers left alone. — [Plutiedev: VDP setup](https://plutiedev.com/vdp-setup)
- Clear VRAM (64 KB, command $40000000), CRAM (128 bytes, $C0000000), VSRAM (80 bytes, $40000010) by writing zero longs to the data port; neither power-on nor reset leaves them clean; emulators may show clean memory but hardware doesn't. Do not use `clr` on hardware registers (68000 does a dummy read first, which confuses the VDP). — [Plutiedev: VDP setup](https://plutiedev.com/vdp-setup)
- Controller ports: write $40 to control and data ports, with the Z80 bus held (hardware bug). — [Plutiedev: Controllers](https://plutiedev.com/controllers)
- Z80 load: assert reset, request bus, release reset (Z80 RAM inaccessible while in reset), copy program bytewise to $A00000, assert reset and wait at least 192 cycles (else the YM2612 may misbehave), release reset, release bus. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)

**VDP register bit meanings needed for init**
- Reg 0: bit 4 IE1 (HInt enable), bit 1 freeze HV counter, bit 2 always 1. Reg 1: bit 6 DISP, bit 5 IE0 (VInt enable), bit 4 DMA enable, bit 3 V30 (PAL only), bit 2 always 1 (Mode 5). Reg 10: lines between HInts. Reg 11: bit 3 IE2 (ext int), bit 2 vscroll mode, bits 1-0 hscroll mode. Reg 12: bits 7 and 0 = H40 when both set ($81), bit 3 shadow/highlight, bits 2-1 interlace. Reg 15: autoincrement. Reg 16: plane size (32/64/128 combos; others misbehave). In H40, window base must be $1000-aligned and sprite table $400-aligned. — [Plutiedev: VDP registers](https://plutiedev.com/vdp-registers)
- Address register encodings, cross-checked against Sonic's comments: reg 2 = addr >> 10 ($C000→$30), reg 3 = addr >> 10 ($F000→$3C), reg 4 = addr >> 13 ($E000→$07), reg 5 = addr >> 9 ($D800→$6C), reg 13 = addr >> 10 ($DC00→$37). — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm); [Plutiedev: VDP registers](https://plutiedev.com/vdp-registers)

**YM2612 and pitfalls**
- Z80 reset also resets the YM2612 in GPGX (`/* reset Z80 & YM2612 */ fm_reset`). — [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c)
- On some (especially early) boards, Z80 activity during DMA can corrupt video memory; emulators don't show it; pause the Z80 around DMA. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)
- On hard reset the 68000 always starts at the same point in the VDP frame (GPGX comment). — [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c)

### Inferences
- Note a conflict in Plutiedev's register table as summarized: the bit-field description gave "bits 6-2" for the window address, but its own value $34 only decodes sensibly as addr >> 10 = $D000, matching Sonic's $3C = $F000 >> 10. Teach the shift formulas, not bit positions.
- The SGDK/Sonic soft-reset skip relies on the I/O control registers being $00 after power-on (GPGX defaults) and surviving the reset button. For a beginner ROM, simply re-running the full init on every reset is simpler and safe.
- Z80 ordering matters: the bus-grant bit only reads "granted" when reset is released (GPGX requires bus requested AND reset released), so polling for the grant while the Z80 is still in reset loops forever. Release reset before polling.
- "ICD_BLK4" (the name of Sega's official init file) could not be found online under that name; the Sonic 1 entry block is widely treated as Sega's standard security/init block, but that attribution is community lore, not confirmed here.

### Gaps
- Sega's official ICD_BLK4 source/Software Manual text was not found; Big Evil Corporation and ChibiAkumas init code were not read in full (ChibiAkumas keeps its register table in an image).
- No source fetched on a mandatory YM2612 register initialization beyond reset; leaving the Z80/YM2612 reset pulse in place is the only verified "safe state".

---

## 5. Controllers (3-button, 6-button, multitap, edge detection)

### Takeaway
Set TH (bit 6) as an output by writing $40 to the control port, then alternately write TH=1/TH=0 to the data port and read: TH=1 gives C B Right Left Down Up (bits 5-0), TH=0 gives Start A 0 0 Down Up. Bits are active-low. A 6-button pad is detected when the third TH=0 read has bits 3-0 = 0000, and the next TH=1 read gives C B Mode X Y Z. Read each pad once per frame.

### Cited Findings
- Ports: pad 1 data $A10003 / control $A10009; pad 2 data $A10005 / control $A1000B. Init: write $40 to control and data of each pad with the Z80 bus held. — [Plutiedev: Controllers](https://plutiedev.com/controllers)
- 3-button: write $40, wait a few NOPs, read → bit5 C, bit4 B, bit3 Right, bit2 Left, bit1 Down, bit0 Up; write $00, wait, read → bit5 Start, bit4 A, bits 3-2 = 0, bit1 Down, bit0 Up. 0 = pressed. If bits 3-2 of the TH=0 read aren't 00, no pad is connected. Suggested RAM layout "SACBRLDU". — [Plutiedev: Controllers](https://plutiedev.com/controllers)
- 6-button: writes $40,$00,$40,$00,$40,$00,$40; steps 1-2 normal; steps 3-5 ignored; step 6 ($00): bits 3-0 = 0000 means 6-button (else 3-button, stop); step 7 ($40): bit5 C, bit4 B, bit3 Mode, bit2 X, bit1 Y, bit0 Z (X and Z are easy to swap). 4 NOPs after each write; 6-button pads are pickier about delay. Holding Mode at power-on forces 3-button mode. — [Plutiedev: Controllers](https://plutiedev.com/controllers)
- Alternative implementation: Hugues Johnson's code uses 2 NOPs per TH write, detects 3-button pads by comparing the cycle-6 read to %00110011, reads once per frame in VBlank, and notes "after a short delay the controller flips back to cycle 0". — [Hugues Johnson: 6 Button Controllers](https://huguesjohnson.com/programming/genesis/6button/)
- Counter mechanics: the 6-button pad increments an internal counter on each TH 0→1 transition (forum); BlastEm counts rising TH edges and clears the counter after a timeout (search snippets). — [SpritesMind "controller auto reset"](https://gendev.spritesmind.net/forum/viewtopic.php?p=31662); [BlastEm changeset](https://www.retrodev.com/repos/blastem/rev/462e43f54abf)
- Timeout value conflicts: the MOA emulator added a 1.5 ms TH-counter reset (needed for Sonic 2 to work); BlueRetro describes ~1 ms (3 falling TH edges within ~1 ms); the Exodus emulator tracker says exact timeouts still need hardware tests (all via search snippets). — [MOA commit](https://git.applefritter.com/Macintosh-Tools/moa/commit/4ca0c9b62507462a8a9f47dbf68c2002d2227208); [BlueRetro log](https://hackaday.io/project/170365-blueretro/log/180790-evolution-of-segas-io-interface-from-sg-1000-to-saturn); [Exodus EX-78](https://exodusemulator.atlassian.net/browse/EX-78)
- Edge detection: just pressed = now AND NOT before; just released = NOT now AND before; consider a few frames of grace for simultaneous presses/diagonals. Read each controller at most once per frame and store the result in RAM. — [Plutiedev: Controllers](https://plutiedev.com/controllers)
- Sega multitap (Team Player): reports peripheral ID 7 (%0111); write $60 to its control and data registers; handshake: bits 3-0 should read %0011, write $20, read %1111; each nibble is fetched by flipping bit 5 and waiting (with timeout) for bit 4 to match; packet = 6-nibble header (first two zero, then 4 port types: 0000 3-button, 0001 6-button, 0010 mouse, 1111 empty) followed by 2/3/6 nibbles per 3-button/6-button/mouse; write $60 when done; header device field should include "4"; EA's 4-Way Play uses a different scheme. — [Plutiedev: Sega multitap](https://plutiedev.com/sega-multitap)

### Example code (original, vasm/Devpac Motorola syntax; untested)
```asm
IO_DATA1    equ $A10003
Z80_BUSREQ  equ $A11100

; ReadPad3: d0.b = SACBRLDU, 1 = held. Clobbers d1, a0.
ReadPad3:
        move.w  #$0100,Z80_BUSREQ   ; hold Z80 off the bus (I/O bug workaround, no wait needed)
        lea     IO_DATA1,a0
        move.b  #$40,(a0)           ; TH=1
        nop
        nop
        nop
        nop
        move.b  (a0),d0             ; ..CBRLDU
        move.b  #$00,(a0)           ; TH=0 (avoid clr: it reads first)
        nop
        nop
        nop
        nop
        move.b  (a0),d1             ; ..SA00DU
        move.b  #$40,(a0)           ; leave TH high
        move.w  #$0000,Z80_BUSREQ
        andi.b  #$3F,d0
        andi.b  #$30,d1
        lsl.b   #2,d1               ; S,A -> bits 7,6
        or.b    d1,d0
        not.b   d0                  ; active-high
        rts

; ReadPad6: d0.w = %0000MXYZ SACBRLDU (1 = pressed); bits 11-8 stay 0 on a 3-button pad.
; Call at most once per frame (counter must time out between calls).
ReadPad6:
        move.w  #$0100,Z80_BUSREQ
        lea     IO_DATA1,a0
        moveq   #0,d0
        moveq   #0,d3
        move.b  #$40,(a0)           ; step 1 TH=1
        nop
        nop
        nop
        nop
        move.b  (a0),d0             ; ..CBRLDU
        move.b  #$00,(a0)           ; step 2 TH=0
        nop
        nop
        nop
        nop
        move.b  (a0),d1             ; ..SA00DU
        move.b  #$40,(a0)           ; step 3
        nop
        nop
        nop
        nop
        move.b  #$00,(a0)           ; step 4
        nop
        nop
        nop
        nop
        move.b  #$40,(a0)           ; step 5
        nop
        nop
        nop
        nop
        move.b  #$00,(a0)           ; step 6
        nop
        nop
        nop
        nop
        move.b  (a0),d2             ; 6-button pad: bits 3-0 = 0000
        move.b  #$40,(a0)           ; step 7 TH=1
        nop
        nop
        nop
        nop
        move.b  (a0),d3             ; ..CBMXYZ (6-button only)
        move.w  #$0000,Z80_BUSREQ
        andi.b  #$3F,d0
        andi.b  #$30,d1
        lsl.b   #2,d1
        or.b    d1,d0
        not.b   d0                  ; d0.w = 00000000 SACBRLDU
        andi.b  #$0F,d2
        bne.s   .done               ; not 0000 -> 3-button pad
        not.b   d3
        andi.w  #$000F,d3           ; MXYZ, active-high
        lsl.w   #8,d3
        or.w    d3,d0
.done:
        rts

; Edge detection each frame (PadHeld/PadPressed are RAM bytes):
;       bsr     ReadPad3            ; d0 = held now
;       move.b  PadHeld,d1          ; held last frame
;       move.b  d0,PadHeld
;       not.b   d1
;       and.b   d0,d1               ; d1 = pressed this frame (now AND NOT before)
;       move.b  d1,PadPressed
```

### Inferences
- Plutiedev's detection (bits 3-0 of the 6th read = 0000) is more robust than comparing the whole byte to %00110011, because the latter changes if Start/A/Up/Down are held during detection.
- Reading once per frame (16.7 ms NTSC / 20 ms PAL) is far longer than any reported 1-1.5 ms timeout, so a once-per-frame 7-step read is safe; reading twice in quick succession is what breaks 6-button pads.

### Gaps
- Exact 6-button timeout (~1 ms vs ~1.5 ms) is not hardware-confirmed in any fetched source.
- The precise nature of the "hardware bug" that motivates holding the Z80 bus during I/O access is not explained on Plutiedev.
- Extension-port ($A10007/$A1000D) peripherals and EA 4-Way Play protocol not researched.

---

## 6. Z80 bus control

### Takeaway
The 68000 must own the Z80 bus (write $0100 to $A11100 and poll until bit 0 of the byte at $A11100 reads 0) before touching Z80 RAM or (when a Z80 sound driver is running) the YM2612; access Z80 RAM bytewise only; release with $0000. $A11200 is the Z80 (and YM2612) reset line: $0000 holds reset, $0100 releases.

### Cited Findings
- $A11100: write $100 to request, $000 to release (word writes); $A11200: write $000 to assert reset, $100 to release. To access Z80 RAM: request, then poll until granted (`btst #0` + `bne` loop); release needs no wait. `FastPauseZ80` (request without waiting) is only for blocking Z80 bus traffic, not for touching Z80 RAM. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)
- Grant bit (GPGX): byte read at $A11100 bit 0, or word read bit 8, is 0 only when BUSREQ is asserted and the Z80 is not in reset; other bits are open bus. — [GPGX mem68k.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/mem68k.c)
- Z80 RAM can't be accessed while the Z80 is in reset; program must start at $0000, fit in 8 KB, initialize itself; copy with byte accesses only; hold reset at least 192 cycles before releasing or the YM2612 may not work. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)
- Z80 RAM is the only communication channel between CPUs; 8-bit accesses are the only atomic unit (16-bit values can tear). — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)
- The YM2612 is on the Z80 bus; if the 68000 writes it while a Z80 driver runs, wrap accesses in pause/resume. Halt the Z80 during DMA on affected boards. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)
- Asserting or releasing Z80 reset also resets the YM2612 (GPGX `fm_reset`). The Z80 can write but not read 68000 RAM through its bank window ($E0-$FF pages). — [GPGX genesis.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/genesis.c)

### Inferences
- Why sound drivers need this: the Z80 runs the music driver from its own 8 KB RAM and owns the YM2612/PSG timing; the 68000 must stop it (bus request) to upload a driver, to post commands into Z80 RAM, or to touch the YM2612 itself.
- Leaving the Z80 held in reset forever is a legitimate choice for a first ROM with no FM sound (and keeps the YM2612 silent), but then nothing on the Z80 side can corrupt DMA or I/O either.

### Gaps
- Whether the 68000 itself must wait after releasing BUSREQ before the Z80 resumes (Plutiedev says no wait needed; no hardware timing source found).

---

## 7. Interrupts (levels 2, 4, 6)

### Takeaway
The VDP raises level 6 for VBlank (vector $78), level 4 for HBlank (vector $70) and level 2 for the external/lightgun interrupt (vector $68). Each must be enabled in a VDP register (reg 1 bit 5, reg 0 bit 4, reg 11 bit 3 respectively) and unmasked in the 68000 SR (`move.w #$2300,sr` allows 4-7; `#$2500` allows only 6-7; `#$2700` blocks all). The interrupt is acknowledged automatically by the 68000's interrupt-acknowledge cycle.

### Cited Findings
- Vector table slots: $68 level 2 ext int (`_EXTINT`), $70 level 4 HInt (`hintCaller`), $78 level 6 VInt (`_VINT`), other autovectors to a default handler; boot starts with `move #0x2700,%sr`. — [SGDK sega.s](https://github.com/Stephane-D/SGDK/blob/master/src/boot/sega.s)
- Enables: reg 0 bit 4 IE1 = HInt; reg 1 bit 5 IE0 = VInt; reg 11 bit 3 IE2 = external interrupt; reg 10 = HInt line count. — [Plutiedev: VDP registers](https://plutiedev.com/vdp-registers)
- External interrupt also needs bit 7 of the relevant I/O control port. — [Plutiedev: I/O ports](https://plutiedev.com/io-ports)
- GPGX: level 6 for VInt, level 4 for HInt; the 68000 interrupt acknowledge (`vdp_68k_irq_ack`) clears the VInt pending flag (status bit 7); a 68000 status read does not clear bit 7 in GPGX. — [GPGX vdp_ctrl.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Status register bits: 0 PAL, 1 DMA busy, 2 HBlank, 3 VBlank (also set when display disabled), 4 odd frame (interlace), 5 sprite collision, 6 sprite overflow, 7 VInt occurred, 8 FIFO full, 9 FIFO empty, 10-15 open bus. Reading the control port clears the command "pending" flag. — [GPGX vdp_ctrl.c](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.c)
- Typical VInt handler (SGDK): increments a frame counter (`vtimer`), runs callbacks, `rte`. — [SGDK sega.s](https://github.com/Stephane-D/SGDK/blob/master/src/boot/sega.s)
- Pad reads are typically done once per frame in VBlank. — [Hugues Johnson](https://huguesjohnson.com/programming/genesis/6button/)

### Inferences
- Beginner pattern: the VInt handler only does `addq.l #1,FrameCounter / rte`; the main loop copies the counter and spins until it changes, then does its per-frame work (pad read, CRAM/VRAM updates while still in VBlank). Polling status bit 3 (VBlank) is an alternative with no interrupts at all.
- Level-n autovector address = (24+n)*4 ($68/$70/$78 for 2/4/6), consistent with the SGDK table.
- Avoid touching the VDP control port in both the main loop and an interrupt handler without care: an interrupt between the two words of a command corrupts the command (the handler's own access resets the pending state).

### Gaps
- Real-hardware detail of when status bit 7 clears on a status read (GPGX's Mode-4 path clears it; Mode 5 68000 path doesn't) was not confirmed by Charles MacDonald's doc (mirror failed).
- HV counter bit format (H counter scaling, interlace mode) not researched in a fetched source; only "high byte V, low byte H".

---

## 8. SRAM / battery save basics

### Takeaway
Typical cartridge SRAM is 8-bit on odd addresses $200001-$20FFFF (32 KB usable), declared in the header as "RA",$F8,$20,$00200001,$0020FFFF; write 1 to $A130F1 to map it in and 0 to map ROM back (mandatory for ROMs over 2 MB, recommended always).

### Cited Findings
- Header: 'RA', $F8, $20, start $200001, end $20FFFF; odd bytes only, byte access; split multi-byte values. — [Plutiedev: Saving with SRAM](https://plutiedev.com/saving-sram)
- $A130F1: write 1 to unlock/map SRAM, 0 to lock; for ROMs > 2 MB the SRAM overlays the upper ROM, so the code touching it must be in the lower 2 MB or RAM. — [Plutiedev: Saving with SRAM](https://plutiedev.com/saving-sram)
- Pitfalls: garbage on first run (use a signature), checksum saves and keep a backup copy, handle dead batteries, avoid $200001 and $20FFFF (reportedly more prone to data loss per Sega). — [Plutiedev: Saving with SRAM](https://plutiedev.com/saving-sram)
- SRAM type byte meanings ($E0/$F0/$F8 saving 16-bit/even/odd; $A0/$B0/$B8 non-saving) and EEPROM marker ($E8,$40). — [Plutiedev: ROM header](https://plutiedev.com/rom-header)
- $A130F0-$A130FF is the "Sega mapper" range and asserts /TIME. — [Plutiedev: $A130xx usage](https://plutiedev.com/a130xx-usage)

### Inferences
- In emulators, SRAM presence is usually inferred from the header, so the "RA" field must be correct for saves to persist.

### Gaps
- Bit-level meaning of $A130F1 beyond "1 = SRAM on" (e.g. a write-protect bit 1) was not found in fetched sources.
- Interaction between SRAM access and a running Z80 not covered by sources found.

---

## 9. Complete minimal "Hello World" ROM

### Takeaway
Below is an original, self-contained Hello World in vasm Motorola (Devpac-compatible) syntax, built from the verified facts above: vector table, header, RAM clear, TMSS, VDP status read, VDP registers, VRAM/CRAM/VSRAM clear, Z80 load + reset pulse, controller init, PSG silence, a hand-drawn 4bpp font, palette, text on plane A, VBlank interrupt and a main loop that changes the background colour when Start is newly pressed. It was not assembled or run in this session (no binaries may be run); each hardware value is cross-referenced to sources in sections 1-8.

### Cited Findings (facts the example depends on)
- VDP write command = ((addr & $3FFF) << 16) | ((addr & $C000) >> 14) | base, with base $40000000 VRAM, $C0000000 CRAM, $40000010 VSRAM; write words/longs only (no byte writes) to $C00000. — [Plutiedev: Writing to video memory](https://plutiedev.com/writing-video)
- Tiles: 8x8 pixels, 4 bits per pixel, 32 bytes, each nibble indexes a 16-colour palette; colour 0 of each palette is transparent (backdrop colour is chosen by reg 7). — [s3unlocked](https://s3unlocked.blogspot.com/2017/05/an-introduction-to-mega-drive-graphics.html); [Rasterscroll: VDP inner workings](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- CRAM colour word pattern `0000BBB0GGG0RRR0`; CRAM = 128 bytes = 4 palettes x 16 colours. — [s3unlocked](https://s3unlocked.blogspot.com/2017/05/an-introduction-to-mega-drive-graphics.html); [Rasterscroll](https://rasterscroll.com/mdgraphics/vdp-inner-workings/)
- Nametable entry: bit 15 priority, bits 14-13 palette, bits 12/11 vertical/horizontal flip, bits 10-0 tile index. — [s3unlocked](https://s3unlocked.blogspot.com/2017/05/an-introduction-to-mega-drive-graphics.html); [Sega Retro: Planes (search snippet)](https://segaretro.org/Sega_Mega_Drive/Planes). Conflict: a search summary of the mrcrowbar library labelled bit 12 as horizontal flip and bit 11 as vertical — [mrcrowbar source](https://mrcrowbar.readthedocs.io/en/latest/_modules/mrcrowbar/lib/hardware/megadrive.html); the majority (and Sega Retro) say bit 12 = V-flip, bit 11 = H-flip.
- ChibiAkumas' Genesis Hello World (Lesson H5) uses VASM, a 1bpp font expanded to 4bpp, plane A at $C000 in a 64-wide map with VRAM address $C000 + Y*128 + X*2, palette via $C0nn0000 commands, and runs in Fusion. — [ChibiAkumas Hello World series](https://www.chibiakumas.com/68000/helloworld.php)
- VInt is level 6 at vector $78; reg 1 = $64 turns on display + VInt in Mode 5. — [SGDK sega.s](https://github.com/Stephane-D/SGDK/blob/master/src/boot/sega.s); [Plutiedev: VDP registers](https://plutiedev.com/vdp-registers)
- PSG silence bytes $9F/$BF/$DF/$FF to $C00011. — [Sonic 1 disassembly](https://github.com/sonicretro/s1disasm/blob/AS/sonic.asm)

### Example code: hello.asm (original; vasm `mot` syntax; untested)
Suggested build: `vasmm68k_mot -Fbin -m68000 -no-opt -o hello.bin hello.asm` (flags from vasm's documented options, not run here; `-no-opt` guarantees vasm never rewrites `move #0` into `clr`, which does a read before write on the 68000).

```asm
; ---------------------------------------------------------------
; hello.asm - minimal Mega Drive / Genesis Hello World
; Syntax: vasm Motorola (Devpac-style). Not assembled in research session.
; ---------------------------------------------------------------
VDP_DATA    equ $C00000
VDP_CTRL    equ $C00004
PSG_PORT    equ $C00011
IO_VERSION  equ $A10001
IO_DATA1    equ $A10003
IO_DATA2    equ $A10005
IO_CTRL1    equ $A10009
IO_CTRL2    equ $A1000B
Z80_RAM     equ $A00000
Z80_BUSREQ  equ $A11100
Z80_RESET   equ $A11200
TMSS_REG    equ $A14000

RAM_BASE     equ $FF0000
FrameCounter equ RAM_BASE+0     ; long
BgColor      equ RAM_BASE+4     ; word
PadHeld      equ RAM_BASE+6     ; byte

PLANE_A     equ $C000           ; must match VDP reg 2 ($30)
TEXT_X      equ 14
TEXT_Y      equ 13
TEXT_ADDR   equ PLANE_A+((TEXT_Y*64+TEXT_X)*2)   ; 64-tile-wide plane

        org     $000000
; ---------------- 68000 vector table: 64 longs, $000-$0FF ----------------
        dc.l    $00FFFE00       ; 0: initial supervisor stack pointer
        dc.l    EntryPoint      ; 1: initial PC
        rept    23              ; 2-24: bus/address error ... spurious IRQ
        dc.l    ErrorTrap
        endr
        dc.l    NullInt         ; 25: level 1
        dc.l    NullInt         ; 26: level 2  external ($68)
        dc.l    NullInt         ; 27: level 3
        dc.l    NullInt         ; 28: level 4  HBlank ($70)
        dc.l    NullInt         ; 29: level 5
        dc.l    VBlankHandler   ; 30: level 6  VBlank ($78)
        dc.l    NullInt         ; 31: level 7
        rept    32              ; 32-63: TRAP #0-15 and reserved
        dc.l    ErrorTrap
        endr

; ---------------- ROM header: $100-$1FF ----------------
        dc.b    "SEGA MEGA DRIVE "              ; $100 system type (16)
        dc.b    "(C)DEMO 2026.NOV"              ; $110 copyright (16)
        dc.b    "HELLO WORLD"                   ; $120 domestic name
        dcb.b   $150-*,$20                      ;      pad to 48 bytes
        dc.b    "HELLO WORLD"                   ; $150 overseas name
        dcb.b   $180-*,$20
        dc.b    "GM 00000000-00"                ; $180 serial (14)
        dc.w    $0000                           ; $18E checksum (optional)
        dc.b    "J"                             ; $190 I/O: 3-button pad
        dcb.b   $1A0-*,$20
        dc.l    $00000000,RomEnd-1              ; $1A0 ROM start/end
        dc.l    $00FF0000,$00FFFFFF             ; $1A8 RAM start/end
        dcb.b   $1F0-*,$20                      ; $1B0 no SRAM, no modem, reserved
        dc.b    "JUE"                           ; $1F0 regions
        dcb.b   $200-*,$20                      ; pad header to $200

; ---------------- Entry point ($200) ----------------
EntryPoint:
        move.w  #$2700,sr               ; supervisor mode, all IRQs masked

        ; clear 64 KB work RAM (no BSR yet, so the stack holds nothing)
        lea     RAM_BASE,a0
        moveq   #0,d0
        move.w  #($10000/4)-1,d1
.clrRam:
        move.l  d0,(a0)+
        dbf     d1,.clrRam

        ; TMSS: must happen before ANY VDP access
        move.b  IO_VERSION,d0
        andi.b  #$0F,d0
        beq.s   .noTmss
        move.l  #$53454741,TMSS_REG     ; 'SEGA' as one long (= two word writes)
.noTmss:

        ; put the VDP in a known state, then load registers (display off)
        tst.w   VDP_CTRL                ; status read clears pending command
        lea     VdpRegs(pc),a0
        lea     VDP_CTRL,a1
        moveq   #((VdpRegsEnd-VdpRegs)/2)-1,d0
.setReg:
        move.w  (a0)+,(a1)
        dbf     d0,.setReg

        ; clear VRAM (64 KB), CRAM (128 B), VSRAM (80 B); autoincrement is 2
        lea     VDP_DATA,a2
        moveq   #0,d1
        move.l  #$40000000,(a1)         ; VRAM write @ $0000
        move.w  #($10000/4)-1,d0
.clrVram:
        move.l  d1,(a2)
        dbf     d0,.clrVram
        move.l  #$C0000000,(a1)         ; CRAM write @ 0
        moveq   #(128/4)-1,d0
.clrCram:
        move.l  d1,(a2)
        dbf     d0,.clrCram
        move.l  #$40000010,(a1)         ; VSRAM write @ 0
        moveq   #(80/4)-1,d0
.clrVsram:
        move.l  d1,(a2)
        dbf     d0,.clrVsram

        ; Z80: request bus, release reset, wait for grant
        move.w  #$0100,Z80_BUSREQ
        move.w  #$0100,Z80_RESET        ; grant never comes while Z80 is in reset
.waitBus:
        btst    #0,Z80_BUSREQ           ; 0 = bus granted
        bne.s   .waitBus
        lea     Z80Prog(pc),a0          ; copy tiny Z80 program, bytewise
        lea     Z80_RAM,a3
        moveq   #(Z80ProgEnd-Z80Prog)-1,d0
.copyZ80:
        move.b  (a0)+,(a3)+
        dbf     d0,.copyZ80
        ; controller ports (done while Z80 is off the bus): TH = output, high
        move.b  #$40,IO_DATA1
        move.b  #$40,IO_DATA2
        move.b  #$40,IO_CTRL1
        move.b  #$40,IO_CTRL2
        ; reset pulse: restarts Z80 at $0000 and resets the YM2612
        move.w  #$0000,Z80_RESET
        moveq   #$7F,d0
.z80Delay:
        dbf     d0,.z80Delay            ; well over the 192 cycles needed
        move.w  #$0100,Z80_RESET
        move.w  #$0000,Z80_BUSREQ       ; let the Z80 run its idle loop

        ; silence the 4 PSG channels (volume = 15 = off)
        lea     PSG_PORT,a0
        move.b  #$9F,(a0)
        move.b  #$BF,(a0)
        move.b  #$DF,(a0)
        move.b  #$FF,(a0)

        ; palette 0: colour 0 = backdrop, colour 1 = text
        move.w  #$0400,BgColor          ; 0000BBB0GGG0RRR0: dark blue
        move.l  #$C0000000,VDP_CTRL     ; CRAM write @ 0
        move.w  BgColor,VDP_DATA
        move.w  #$0EEE,VDP_DATA         ; white

        ; font tiles go to tile 1 onward (tile 0 stays blank = space)
        move.l  #$40200000,VDP_CTRL     ; VRAM write @ $0020 (tile 1)
        lea     FontTiles(pc),a0
        move.w  #((FontTilesEnd-FontTiles)/4)-1,d0
.loadFont:
        move.l  (a0)+,VDP_DATA
        dbf     d0,.loadFont

        ; print the message on plane A
        move.l  #$40000000|((TEXT_ADDR&$3FFF)<<16)|(TEXT_ADDR>>14),d0
        lea     Message(pc),a0
        bsr     PrintString

        ; display on + VBlank IRQ on (Mode 5), then unmask level 6
        move.w  #$8164,VDP_CTRL
        move.w  #$2500,sr

; ---------------- Main loop: one pass per frame ----------------
MainLoop:
        move.l  FrameCounter,d0
.waitVBlank:
        cmp.l   FrameCounter,d0
        beq.s   .waitVBlank             ; VBlank IRQ bumps the counter

        bsr     ReadPad1                ; d0.b = SACBRLDU, 1 = held
        move.b  PadHeld,d1              ; last frame
        move.b  d0,PadHeld
        not.b   d1
        and.b   d0,d1                   ; d1 = newly pressed
        btst    #7,d1                   ; Start?
        beq.s   MainLoop
        eori.w  #$0404,BgColor          ; toggle dark blue <-> dark red
        move.l  #$C0000000,VDP_CTRL     ; still inside VBlank: safe CRAM write
        move.w  BgColor,VDP_DATA
        bra.s   MainLoop

; ---------------- Subroutines ----------------
; PrintString: a0 = zero-terminated ASCII, d0.l = VDP write command.
; Tile index = position of the character in FontChars (space = 0).
PrintString:
        move.l  d0,VDP_CTRL
.nextChar:
        moveq   #0,d1
        move.b  (a0)+,d1
        beq.s   .done
        lea     FontChars(pc),a1
        moveq   #0,d2
.find:
        move.b  (a1)+,d3
        beq.s   .notFound
        cmp.b   d3,d1
        beq.s   .found
        addq.w  #1,d2
        bra.s   .find
.notFound:
        moveq   #0,d2                   ; unknown char -> blank tile
.found:
        move.w  d2,VDP_DATA             ; palette 0, no flip, low priority
        bra.s   .nextChar
.done:
        rts

; ReadPad1: d0.b = SACBRLDU (1 = held). Clobbers d1, a0.
ReadPad1:
        move.w  #$0100,Z80_BUSREQ
        lea     IO_DATA1,a0
        move.b  #$40,(a0)               ; TH = 1
        nop
        nop
        nop
        nop
        move.b  (a0),d0                 ; ..CBRLDU
        move.b  #$00,(a0)               ; TH = 0
        nop
        nop
        nop
        nop
        move.b  (a0),d1                 ; ..SA00DU
        move.b  #$40,(a0)
        move.w  #$0000,Z80_BUSREQ
        andi.b  #$3F,d0
        andi.b  #$30,d1
        lsl.b   #2,d1
        or.b    d1,d0
        not.b   d0
        rts

VBlankHandler:
        addq.l  #1,FrameCounter
        rte

NullInt:
        rte

ErrorTrap:
        bra.s   ErrorTrap               ; hang here on any CPU exception

; ---------------- Data ----------------
VdpRegs:
        dc.w    $8004   ; 0: HInt off
        dc.w    $8104   ; 1: display off, VInt off, DMA off, Mode 5
        dc.w    $8230   ; 2: plane A  @ $C000
        dc.w    $8334   ; 3: window   @ $D000
        dc.w    $8407   ; 4: plane B  @ $E000
        dc.w    $8578   ; 5: sprites  @ $F000
        dc.w    $8600   ; 6: unused
        dc.w    $8700   ; 7: backdrop = palette 0, colour 0
        dc.w    $8800   ; 8: unused
        dc.w    $8900   ; 9: unused
        dc.w    $8AFF   ; 10: HInt counter
        dc.w    $8B00   ; 11: no ext IRQ, full-screen scroll
        dc.w    $8C81   ; 12: H40 (320 px), no interlace, no S/H
        dc.w    $8D3D   ; 13: H-scroll table @ $F400
        dc.w    $8E00   ; 14: unused
        dc.w    $8F02   ; 15: autoincrement 2
        dc.w    $9001   ; 16: planes 64x32 tiles
        dc.w    $9100   ; 17: window X = 0 (off)
        dc.w    $9200   ; 18: window Y = 0 (off)
VdpRegsEnd:

; 4bpp tiles: one hex digit per pixel, leftmost digit = leftmost pixel
FontTiles:
        dc.l $11000110,$11000110,$11000110,$11111110,$11000110,$11000110,$11000110,$00000000 ; H
        dc.l $11111110,$11000000,$11000000,$11111100,$11000000,$11000000,$11111110,$00000000 ; E
        dc.l $11000000,$11000000,$11000000,$11000000,$11000000,$11000000,$11111110,$00000000 ; L
        dc.l $01111100,$11000110,$11000110,$11000110,$11000110,$11000110,$01111100,$00000000 ; O
        dc.l $11000110,$11000110,$11000110,$11010110,$11111110,$11101110,$11000110,$00000000 ; W
        dc.l $11111100,$11000110,$11000110,$11111100,$11011000,$11001100,$11000110,$00000000 ; R
        dc.l $11111000,$11001100,$11000110,$11000110,$11000110,$11001100,$11111000,$00000000 ; D
        dc.l $00110000,$00110000,$00110000,$00110000,$00110000,$00000000,$00110000,$00000000 ; !
FontTilesEnd:

FontChars:
        dc.b    " HELOWRD!",0           ; index = tile number
Message:
        dc.b    "HELLO WORLD!",0
Z80Prog:
        dc.b    $F3,$18,$FE             ; DI / JR $ (spin forever)
Z80ProgEnd:
        even
RomEnd:
```

Optional checksum fixer (original; plain Python, reads/writes the ROM file):
```python
import sys
rom = bytearray(open(sys.argv[1], "rb").read())
if len(rom) % 2: rom.append(0)
s = sum((rom[i] << 8) | rom[i+1] for i in range(0x200, len(rom), 2)) & 0xFFFF
rom[0x18E:0x190] = bytes([s >> 8, s & 0xFF])
open(sys.argv[1], "wb").write(rom)
```

### Inferences
- Address arithmetic check for the text position: $C000 + (13*64 + 14)*2 = $C000 + 1692 = $C000 + $69C = $C69C → command $469C0003 (computed by the assembler from TEXT_ADDR). Tile 1 at VRAM $0020 → command $40200000. Register values decode to plane A $C000, window $D000, plane B $E000, sprites $F000 ($F000 >> 9 = $78), H-scroll $F400 ($3D << 10), matching Plutiedev's suggested layout.
- With VRAM cleared, plane B, sprite table and H-scroll table are all zero, so only plane A's text and the backdrop colour show.
- The Z80 idle program ($F3 DI, $18 $FE JR -2) keeps the Z80 busy in its own RAM so it never touches the 68000 bus; holding the Z80 in reset forever would also work for this demo.
- Writing CRAM right after VBlank begins avoids the "CRAM dots" artefact some hardware shows when CRAM is written during active display (well-known community advice; not verified in a fetched source this session).
- The header uses `dcb.b <next offset>-*,$20` padding so a too-long string becomes an assembler error instead of silently shifting later fields; this requires the absolute `org $000000`.

### Gaps
- Not assembled or run (session constraint: no binaries). vasm directive support (`rept/endr`, `dcb.b`, `even`, `-no-opt`, `-m68000`) and the macOS build (`make CPU=m68k SYNTAX=mot`) are from vasm's documentation as remembered, not re-checked this session; the tutor should verify with a first assemble and an emulator with TMSS BIOS enabled (e.g. Genesis Plus GX/BlastEm), then hardware via a flash cart.
- The "leftmost pixel = high nibble" ordering of tile data was not stated explicitly in the fetched sources (s3unlocked and Rasterscroll only say 4 bits/pixel, 32 bytes/tile); it is the standard convention.
- clownassembler and Macro Assembler AS syntaxes were not compared; the Sonic 1 disassembly (AS) and SGDK (GNU as) show the other two main dialects.
