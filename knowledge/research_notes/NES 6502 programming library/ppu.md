# The NES PPU (picture processing unit, Ricoh 2C02)

Everything below is **[verified 2026-11-25]** against the NESdev Wiki pages named in each section unless marked.

## 1. Registers (CPU $2000-$2007, plus $4014) — "PPU registers"
**PPUCTRL $2000 (write)** — `VPHB SINN`
- bit 7 V: NMI at the start of vblank (1 = on)
- bit 6 P: PPU master/slave; never set it on a stock console
- bit 5 H: sprite size (0 = 8×8, 1 = 8×16)
- bit 4 B: background pattern table (0 = $0000, 1 = $1000)
- bit 3 S: sprite pattern table for 8×8 sprites (0 = $0000, 1 = $1000; ignored in 8×16 mode)
- bit 2 I: PPUDATA address increment (0 = +1, going across; 1 = +32, going down)
- bits 1-0 NN: base nametable (0 = $2000, 1 = $2400, 2 = $2800, 3 = $2C00); also the 9th bit of the X (bit 0)
  and Y (bit 1) scroll

**PPUMASK $2001 (write)** — `BGRs bMmG`
- bit 0: greyscale
- bit 1: show background in the leftmost 8 pixels; bit 2: show sprites in the leftmost 8 pixels
- bit 3: show background; bit 4: show sprites
- bits 5, 6, 7: emphasize red, green, blue (red and green swap on PAL/Dendy)
- Typical: $00 while loading screens, $1E during gameplay.

**PPUSTATUS $2002 (read)** — `VSO- ----`
- bit 7 V: vblank started (set at scanline 241 dot 1; cleared by reading and at the pre-render line)
- bit 6 S: sprite 0 hit; bit 5 O: sprite overflow (the hardware's overflow logic is buggy)
- Reading also resets the shared write latch (w) used by PPUSCROLL and PPUADDR.
- Using bit 7 to detect vblank in a running game is unreliable; use the NMI.

**OAMADDR $2003, OAMDATA $2004** — OAM address / data. Most games write 0 to OAMADDR and use OAM DMA instead of
OAMDATA ("Do not write directly to this register in most cases").

**PPUSCROLL $2005 (write ×2)** — first write X scroll, second write Y scroll.

**PPUADDR $2006 (write ×2)** — first write the high byte, second the low byte of a 14-bit PPU address.
PPUSCROLL and PPUADDR share the w latch; read PPUSTATUS to reset it before a pair of writes. Write the scroll
(and PPUCTRL's nametable bits) after any PPUADDR writes, because PPUADDR disturbs the scroll position.

**PPUDATA $2007 (read/write)** — reads/writes PPU memory at the current address, then adds 1 or 32 (PPUCTRL
bit 2). Reads are buffered: after setting an address, the first read returns stale data, so read once and
discard. Palette reads ($3F00+) skip the buffer, but don't rely on that.

**OAMDMA $4014 (write)** — writing $XX copies CPU page $XX00-$XXFF into OAM. Takes 513 or 514 CPU cycles.

**When it's safe:** with rendering on, only during vblank. With rendering off (PPUMASK bits 3-4 clear), any
time — use that for big transfers like a whole screen. After power/reset the PPU ignores writes to $2000,
$2001, $2005 and $2006 for about 29,658 NTSC (33,132 PAL) CPU cycles; the two vblank waits in the init code
cover this. On PAL, do OAM DMA at the start of vblank.

## 2. PPU memory map — "PPU memory map"
| Range | What |
|---|---|
| $0000-$0FFF | pattern table 0 (CHR, on the cartridge) |
| $1000-$1FFF | pattern table 1 |
| $2000-$23BF / $23C0-$23FF | nametable 0 / its attribute table |
| $2400 / $27C0 | nametable 1 / attributes |
| $2800 / $2BC0 | nametable 2 / attributes |
| $2C00 / $2FC0 | nametable 3 / attributes |
| $3000-$3EFF | usually a mirror of $2000-$2EFF |
| $3F00-$3F1F | palette RAM; $3F20-$3FFF mirror it |
OAM (sprite memory, 256 bytes) is separate, inside the PPU.

## 3. Tiles (CHR format) — "PPU pattern tables"
- A tile is 8×8 pixels, 16 bytes: bytes 0-7 are bit plane 0 (each pixel's low color bit), bytes 8-15 are bit
  plane 1 (the high bit). One byte per row; the leftmost pixel is bit 7 **[standard; the wiki shows it in a
  diagram]**.
- Pixel color index = plane1 bit × 2 + plane0 bit (0-3). Index 0 is transparent (shows what's behind).
- Each pattern table holds 256 tiles (4 KB). Tile address: table base + tile number × 16.

## 4. Nametables (the background map) — "PPU nametables"
- 32 × 30 tiles (256 × 240 pixels) = 960 bytes of tile numbers, followed by a 64-byte attribute table: 1 KB.
- Tile at column x (0-31), row y (0-29): address = $2000 + y × 32 + x (for nametable 0).
- The console has 2 KB of nametable RAM, so only two of the four nametables are real; the other two are
  mirrors (section 7).

## 5. Attribute tables (which palette each area uses) — "PPU attribute tables"
- 64 bytes at $23C0 (and $27C0, $2BC0, $2FC0), an 8 × 8 grid. Each byte covers 4 × 4 tiles (32 × 32 pixels),
  split into four 2 × 2-tile (16 × 16) quadrants:
  bits 1-0 top-left, bits 3-2 top-right, bits 5-4 bottom-left, bits 7-6 bottom-right.
- byte = (bottom-right << 6) | (bottom-left << 4) | (top-right << 2) | top-left.
  Example from the wiki: TL=3, TR=1, BL=2, BR=2 gives $A7.
- Attribute byte for tile (x, y): $23C0 + (y / 4) × 8 + (x / 4) **[standard arithmetic]**.

## 6. Palettes — "PPU palettes"
- 32 bytes at $3F00-$3F1F: background palettes 0-3 at $3F00/$3F04/$3F08/$3F0C, sprite palettes 0-3 (called
  4-7 in OAM terms) at $3F10/$3F14/$3F18/$3F1C. Four entries each.
- Entry 0 of every palette is transparent; $3F00 is the universal backdrop color shown where everything is
  transparent. $3F10/$3F14/$3F18/$3F1C mirror $3F00/$3F04/$3F08/$3F0C, so the backdrop can be written through
  $3F00 or $3F10.
- Values are 6-bit color numbers $00-$3F. Black is $0F. **Never use $0D** ("blacker than black", can upset
  some TVs).
- Handy colors **[standard]**: $0F black, $00 dark gray, $10 light gray, $30 white, $16 red, $1A green,
  $12 blue, $21 sky blue, $28 yellow, $27 orange.
- Load palettes with PPUADDR = $3F00, then 32 PPUDATA writes (with rendering off or during vblank).

## 7. Mirroring — "Mirroring", "iNES"
- Vertical mirroring (iNES flags 6 bit 0 = 1, "horizontal arrangement"): $2000 = $2800 and $2400 = $2C00. The
  two real nametables sit side by side (a 64 × 30 tile map), good for horizontal scrolling.
- Horizontal mirroring (bit 0 = 0, "vertical arrangement"): $2000 = $2400 and $2800 = $2C00 (a 32 × 60 map),
  good for vertical scrolling.
- (These pairs follow from the documented wiring: vertical = CIRAM A10 ← PPU A10, horizontal = CIRAM A10 ←
  PPU A11. One fetch of the nametables page during research reported them the other way round; the wiring
  and the Mirroring page's 64×30 / 32×60 descriptions confirm the version above.)

## 8. Sprites (OAM) — "PPU OAM"
- 64 sprites × 4 bytes = 256 bytes. Sprite n is at OAM offset n × 4. Lower numbers draw in front.
- Byte 0: Y of the top edge, minus 1 (sprite data is delayed one scanline; a sprite with Y = 99 appears on line
  100). Sprites can't be partly off the top.
- Byte 1: tile number. 8×8 mode: from the pattern table chosen by PPUCTRL bit 3. 8×16 mode: bit 0 picks the
  pattern table, the top half is tile (n AND $FE), the bottom half the next tile.
- Byte 2: attributes — bits 1-0 palette (sprite palettes 4-7), bits 4-2 unused (read 0), bit 5 priority
  (0 = in front of the background, 1 = behind), bit 6 flip horizontally, bit 7 flip vertically.
- Byte 3: X of the left edge (X ≥ $F9 runs off the right edge).
- Hide a sprite by setting Y to anything from $EF to $FF.
- Only 8 sprites can share a scanline; extras on that line aren't drawn.
- The usual method: keep a 256-byte shadow copy in RAM (page $0200), change it during the frame, and send it
  with OAM DMA (`LDA #$00 / STA $2003 / LDA #$02 / STA $4014`) in the NMI.

## 9. Scrolling basics — "PPU registers" (+ [standard])
- Set the fine scroll by writing PPUSCROLL twice (X, then Y) during vblank, after any PPUADDR use; pick the
  nametable with PPUCTRL bits 1-0. Scroll is in pixels; X 0-255 plus the nametable bit gives 0-511.
- Writing PPUADDR (e.g. to update tiles) changes the internal scroll position, so always rewrite PPUSCROLL and
  PPUCTRL at the end of the NMI.
- New columns/rows must be written into the off-screen part of the nametable before they scroll into view;
  that's a mid-course topic (lesson 21).
