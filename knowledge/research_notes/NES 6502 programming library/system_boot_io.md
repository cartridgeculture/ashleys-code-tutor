# NES system: memory map, cartridge header, booting, the frame loop, controllers

## 1. CPU memory map [verified 2026-11-25, NESdev "CPU memory map"]
| Range | Size | What |
|---|---|---|
| $0000-$07FF | 2 KB | internal RAM: $0000-$00FF zero page, $0100-$01FF stack, $0200-$02FF most commonly the shadow OAM (sprite buffer) |
| $0800-$1FFF | | three mirrors of $0000-$07FF |
| $2000-$2007 | 8 | PPU registers |
| $2008-$3FFF | | mirrors of $2000-$2007, repeating every 8 bytes |
| $4000-$4017 | | APU and I/O registers ($4014 OAM DMA, $4016/$4017 controllers) |
| $4018-$401F | | APU/I/O test functions, normally disabled |
| $4020-$FFFF | | cartridge space; usually PRG RAM at $6000-$7FFF and PRG ROM (plus mapper registers) at $8000-$FFFF |

Vectors (16-bit, little-endian), supplied by the cartridge **[verified]**:
- $FFFA-$FFFB: NMI handler address
- $FFFC-$FFFD: Reset handler address (where the program starts)
- $FFFE-$FFFF: IRQ/BRK handler address

Unmapped reads return "open bus" (whatever was last on the data bus); never rely on them.

## 2. NROM, the simplest cartridge [verified, NESdev "NROM"]
- iNES mapper 0. No bank switching, no registers.
- PRG ROM: 16 KB (NROM-128, appears at $8000-$BFFF and is mirrored at $C000-$FFFF) or 32 KB (NROM-256,
  $8000-$FFFF). The -128/-256 suffixes are kilobits.
- CHR ROM: 8 KB at PPU $0000-$1FFF (both pattern tables).
- Nametable mirroring is fixed by the board (solder pads); the iNES header tells emulators which.

## 3. The iNES header (16 bytes at the start of a .nes file) [verified, NESdev "iNES"]
| Byte | Meaning |
|---|---|
| 0-3 | "NES" then $1A |
| 4 | PRG ROM size in 16 KB units |
| 5 | CHR ROM size in 8 KB units (0 = the board uses CHR RAM) |
| 6 | Flags 6: bit 0 nametable arrangement (0 = vertical arrangement, "horizontal mirroring"; 1 = horizontal arrangement, "vertical mirroring"); bit 1 battery-backed PRG RAM at $6000-$7FFF; bit 2 512-byte trainer; bit 3 alternative nametable layout; bits 4-7 low nybble of the mapper number |
| 7 | Flags 7: bits 4-7 high nybble of the mapper; bits 2-3 = 2 means NES 2.0 format |
| 8-15 | iNES 1.0: byte 8 PRG RAM size, byte 9 bit 0 TV system; the rest padding. Write zeros. |

Mapper number = (flags7 AND $F0) OR (flags6 >> 4). For NROM with vertical mirroring: flags 6 = $01, flags 7 = $00.

ca65:
```
.segment "HEADER"
    .byte "NES", $1A
    .byte 2          ; PRG ROM: 2 x 16 KB (NROM-256)
    .byte 1          ; CHR ROM: 1 x 8 KB
    .byte $01        ; mapper 0 (low nybble), vertical mirroring
    .byte $00        ; mapper 0 (high nybble), iNES 1.0
    .res 8, $00      ; bytes 8-15: zeros
```

## 4. Booting: the reset handler [verified, NESdev "Init code"]
The steps and why each exists:
1. `SEI` — ignore IRQs. (The CPU sets I on reset anyway; doing it lets code fake a reset with `JMP ($FFFC)`.)
2. `CLD` — clear decimal mode. The 2A03 has no decimal mode; this keeps generic 6502 debuggers happy.
3. `LDX #$40 / STX $4017` — APU frame counter: inhibit its IRQ, which is enabled at power-up.
4. `LDX #$FF / TXS` — stack pointer to $FF (stack starts at $01FF).
5. `INX` (X = 0), then `STX $2000` (PPUCTRL: NMI off) and `STX $2001` (PPUMASK: rendering off). On a Famicom
   or top-loading NES the Reset button does not reset the PPU, so NMI and rendering must be turned off here.
6. `STX $4010` — DMC control: disable DMC IRQs.
7. `BIT $2002` — read PPUSTATUS once to clear the vblank flag, which is in an unknown state after reset, so the
   first wait can't exit instantly.
8. First vblank wait: `@v1: BIT $2002 / BPL @v1` (loop until bit 7, the vblank flag, is set).
9. Clear RAM ($0000-$07FF) while waiting for the PPU. Fill the shadow-OAM page with $FF instead of $00, so all
   sprites start offscreen (Y = $FF); zeros would stack all 64 sprites in the top-left corner. If some RAM must
   survive Reset (high scores), skip it.
10. Second vblank wait (same loop). The PPU needs about 30,000 cycles to warm up; two waits cover it. Until
    then it ignores writes to $2000, $2001, $2005 and $2006 (about 29,658 NTSC cycles after reset) **[verified,
    PPU registers]**.
Now it's safe to load palettes, nametables and CHR RAM, then turn on NMI and rendering.

## 5. The frame loop and the NMI
- With PPUCTRL bit 7 set, the PPU fires an NMI at the start of every vblank (60 times a second on NTSC).
- Vblank is the only time with rendering on that the CPU may write VRAM and OAM **[verified, PPU registers]**.
  So the NMI handler does the PPU work, quickly: OAM DMA, small VRAM updates prepared earlier, then the scroll.
- Don't poll PPUSTATUS bit 7 to find vblank once the game is running: the PPU registers page calls the flag
  unreliable for that (reading it at the wrong moment can miss a frame). Use the NMI **[verified]**.
- A common structure: the main loop does game logic, then waits for the NMI to signal "frame done":
```
main_loop:
    jsr read_joypad
    jsr update_game      ; logic + fill shadow OAM
    lda frame_count
@wait:
    cmp frame_count      ; the NMI increments frame_count
    beq @wait
    jmp main_loop

nmi:
    pha                  ; save registers: we interrupted the main loop
    txa
    pha
    tya
    pha
    lda #$00
    sta $2003            ; OAMADDR = 0 (recommended before DMA)
    lda #>oam            ; high byte of the shadow OAM page, e.g. $02
    sta $4014            ; OAM DMA: copies $0200-$02FF into OAM (513-514 cycles)
    bit $2002            ; reset the PPUSCROLL/PPUADDR write latch
    lda #$00
    sta $2005            ; scroll X
    sta $2005            ; scroll Y (write the scroll after any PPUADDR use)
    inc frame_count
    pla
    tay
    pla
    tax
    pla
    rti
```
- The PPU registers page also recommends changing PPUMASK (rendering on/off) only in vblank, e.g. by writing a
  shadow copy from the NMI **[verified]**.

## 6. Controllers [verified, NESdev "Standard controller", "Controller reading code"]
- Write 1 then 0 to bit 0 of $4016 ("strobe"). While it's 1, the controllers keep reloading their buttons;
  dropping it to 0 freezes them for reading. One strobe latches both controllers.
- Then read $4016 (controller 1) or $4017 (controller 2) eight times; bit 0 of each read is one button, in this
  order: A, B, Select, Start, Up, Down, Left, Right. (Reads 9+ return 1 on official controllers.)
- Ring-counter read (132 cycles; the 1 stored first falls into carry after 8 rotates and ends the loop):
```
read_joypad:
    lda #$01
    sta $4016        ; strobe on
    sta buttons      ; marker bit
    lsr a            ; A = 0
    sta $4016        ; strobe off
@loop:
    lda $4016
    lsr a            ; button bit -> carry
    rol buttons      ; carry -> bit 0; the marker moves toward carry
    bcc @loop
    rts
```
  Result in `buttons`: bit 7 A, 6 B, 5 Select, 4 Start, 3 Up, 2 Down, 1 Left, 0 Right (1 = pressed).
- New presses this frame (edge detection): `pressed = buttons AND NOT last_buttons`:
```
    lda last_buttons
    eor #$FF
    and buttons
    sta pressed
    lda buttons
    sta last_buttons     ; (do this after computing pressed)
```
- DMC conflict: on NTSC, DMC sample playback can cause extra reads that drop a bit (usually a fake Right).
  Fixes: read until two reads match, or time reads right after OAM DMA. Only matters if the game plays DMC
  samples **[verified]**.
