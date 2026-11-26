# A complete NROM program: a smiley sprite you move with the D-pad

The reference shape for lesson code: ca65 syntax, NROM-256, the linker config from toolchain_ca65.md (save it
as `nrom.cfg`). Every hardware value below is from the verified notes (system_boot_io.md, ppu.md). Not yet
assembled in ACT (no assembler installed); build with:
```
ca65 hello.s -g -o hello.o
ld65 hello.o -C nrom.cfg -o hello.nes --dbgfile hello.dbg
```

```
; hello.s - a smiley you move with the D-pad. NROM-256, ca65.

; ---- hardware registers ----
PPUCTRL   = $2000
PPUMASK   = $2001
PPUSTATUS = $2002
OAMADDR   = $2003
PPUSCROLL = $2005
PPUADDR   = $2006
PPUDATA   = $2007
OAMDMA    = $4014
JOYPAD1   = $4016

; ---- cartridge header ----
.segment "HEADER"
    .byte "NES", $1A
    .byte 2              ; PRG ROM: 2 x 16 KB
    .byte 1              ; CHR ROM: 1 x 8 KB
    .byte $01            ; mapper 0, vertical mirroring
    .byte $00
    .res 8, $00

; ---- variables ----
.segment "ZEROPAGE": zeropage
frame_count: .res 1      ; the NMI adds 1 every frame
buttons:     .res 1      ; bit 7 A ... bit 0 Right
sprite_x:    .res 1
sprite_y:    .res 1

.segment "OAM"
oam:         .res 256    ; shadow OAM: 64 sprites x 4 bytes, sent to the PPU every frame

; ---- code ----
.segment "CODE"

reset:
    sei                  ; ignore IRQs
    cld                  ; no decimal mode on the NES
    ldx #$40
    stx $4017            ; APU frame counter: IRQ off
    ldx #$FF
    txs                  ; stack starts at $01FF
    inx                  ; X = 0
    stx PPUCTRL          ; NMI off
    stx PPUMASK          ; rendering off
    stx $4010            ; DMC IRQs off
    bit PPUSTATUS        ; clear the vblank flag (unknown after reset)
@vblank1:                ; first wait: the PPU is warming up
    bit PPUSTATUS
    bpl @vblank1

@clear_ram:              ; X is 0 here, so this runs 256 times
    lda #$00
    sta $0000,x
    sta $0100,x
    sta $0300,x
    sta $0400,x
    sta $0500,x
    sta $0600,x
    sta $0700,x
    lda #$FF
    sta oam,x            ; Y = $FF hides every sprite
    inx
    bne @clear_ram

@vblank2:                ; second wait: now the PPU accepts writes
    bit PPUSTATUS
    bpl @vblank2

    ; Palettes: 32 bytes at PPU $3F00.
    bit PPUSTATUS        ; reset the PPUADDR write latch
    lda #$3F
    sta PPUADDR          ; high byte first
    lda #$00
    sta PPUADDR          ; then low byte
    ldx #0
@load_palettes:
    lda palettes,x
    sta PPUDATA          ; the address moves up by 1 each write
    inx
    cpx #32
    bne @load_palettes

    ; Nametable 0 and its attributes: 1024 bytes of tile 0 (blank) at PPU $2000.
    lda #$20
    sta PPUADDR
    lda #$00
    sta PPUADDR          ; A is 0: the value we'll write
    ldx #4               ; 4 x 256 = 1024 bytes
    ldy #0
@clear_nametable:
    sta PPUDATA
    iny
    bne @clear_nametable
    dex
    bne @clear_nametable

    ; Start the smiley near the middle of the screen.
    lda #124
    sta sprite_x
    lda #112
    sta sprite_y

    ; Turn NMIs on, wait for one, then turn rendering on at the start of vblank.
    lda #%10000000       ; NMI on; sprites and background use pattern table 0
    sta PPUCTRL
    lda frame_count
@first_frame:
    cmp frame_count
    beq @first_frame
    lda #%00011110       ; show sprites and background, including the left 8 pixels
    sta PPUMASK

main_loop:
    jsr read_joypad
    jsr move_sprite

    ; Sprite 0 in shadow OAM: Y, tile, attributes, X.
    lda sprite_y
    sta oam+0
    lda #1               ; tile 1: the smiley
    sta oam+1
    lda #%00000000       ; palette 4, in front of the background, no flip
    sta oam+2
    lda sprite_x
    sta oam+3

    lda frame_count      ; wait for the NMI: one game step per frame
@wait_frame:
    cmp frame_count
    beq @wait_frame
    jmp main_loop

; Reads controller 1 into buttons (1 = pressed): bit 7 A, 6 B, 5 Select, 4 Start, 3 Up, 2 Down, 1 Left, 0 Right.
read_joypad:
    lda #$01
    sta JOYPAD1          ; strobe on: the controller latches its buttons
    sta buttons          ; marker bit: after 8 rotates it falls into carry
    lsr a                ; A = 0
    sta JOYPAD1          ; strobe off: now we can read them one at a time
@read_bit:
    lda JOYPAD1
    lsr a                ; this button -> carry
    rol buttons          ; carry -> bit 0, everything else moves left
    bcc @read_bit        ; the marker reaching carry ends the loop
    rts

; One pixel per frame in each direction held. (No screen-edge limits yet: lesson 18 adds them.)
move_sprite:
    lda buttons
    and #%00000001       ; Right
    beq @not_right
    inc sprite_x
@not_right:
    lda buttons
    and #%00000010       ; Left
    beq @not_left
    dec sprite_x
@not_left:
    lda buttons
    and #%00000100       ; Down
    beq @not_down
    inc sprite_y
@not_down:
    lda buttons
    and #%00001000       ; Up
    beq @not_up
    dec sprite_y
@not_up:
    rts

; Runs at the start of every vblank: send the sprites, fix the scroll, count the frame.
nmi:
    pha                  ; save A, X, Y: we interrupted the main loop
    txa
    pha
    tya
    pha

    lda #$00
    sta OAMADDR
    lda #>oam            ; the page our shadow OAM lives on ($02)
    sta OAMDMA           ; copy 256 bytes into the PPU's OAM

    bit PPUSTATUS        ; reset the write latch
    lda #$00
    sta PPUSCROLL        ; X scroll 0
    sta PPUSCROLL        ; Y scroll 0

    inc frame_count

    pla                  ; restore Y, X, A in reverse order
    tay
    pla
    tax
    pla
    rti

irq:
    rti                  ; NROM has no IRQ sources we use

; ---- data ----
.segment "RODATA"
palettes:
    ; background palettes 0-3 (the first byte is the shared backdrop color)
    .byte $21, $0F, $00, $10     ; sky blue backdrop, black, dark gray, light gray
    .byte $21, $0F, $00, $10
    .byte $21, $0F, $00, $10
    .byte $21, $0F, $00, $10
    ; sprite palettes 4-7 (first byte mirrors the backdrop; colors 1-3 are what sprites use)
    .byte $21, $0F, $28, $30     ; 1 black, 2 yellow, 3 white
    .byte $21, $0F, $28, $30
    .byte $21, $0F, $28, $30
    .byte $21, $0F, $28, $30

.segment "VECTORS"
    .addr nmi, reset, irq        ; $FFFA NMI, $FFFC reset, $FFFE IRQ

; ---- graphics: 8 KB of CHR (the linker fills the unused part with zeros) ----
.segment "CHARS"
    ; tile 0: blank (every pixel color 0, transparent)
    .res 16, $00
    ; tile 1: a smiley. Plane 0 = low color bit, plane 1 = high color bit.
    ; Color 1 (black) = outline, eyes, mouth; color 2 (yellow) = face.
    .byte %00111100      ; plane 0, row 0   ..####..
    .byte %01000010      ;          row 1   .#....#.
    .byte %10100101      ;          row 2   #.#..#.#   eyes
    .byte %10000001      ;          row 3   #......#
    .byte %10100101      ;          row 4   #.#..#.#   mouth corners
    .byte %10011001      ;          row 5   #..##..#   mouth
    .byte %01000010      ;          row 6   .#....#.
    .byte %00111100      ;          row 7   ..####..
    .byte %00000000      ; plane 1, row 0
    .byte %00111100      ;          row 1   face fill
    .byte %01011010      ;          row 2
    .byte %01111110      ;          row 3
    .byte %01011010      ;          row 4
    .byte %01100110      ;          row 5
    .byte %00111100      ;          row 6
    .byte %00000000      ;          row 7
```

## How it works, section by section
- **Header**: tells emulators "NROM, 32 KB PRG, 8 KB CHR, vertical mirroring" (system_boot_io.md §3).
- **Variables**: zero page for the bytes touched every frame (shorter, faster instructions). `oam` is page $0200
  because the linker config puts the OAM segment there, and OAM DMA copies whole pages.
- **reset**: the init sequence from system_boot_io.md §4, with each step commented. The shadow-OAM page is
  filled with $FF so no stray sprites appear.
- **Palettes and nametable** are written while rendering is still off, so timing doesn't matter yet. The
  PPUSTATUS read resets the address latch so the high byte really goes first.
- **Turning on**: NMIs first, then wait for one, then PPUMASK — so rendering starts at the beginning of a
  vblank, as the PPU registers page recommends.
- **main_loop**: input → movement → shadow OAM → wait for the NMI. The NMI does all PPU work (DMA + scroll).
  (If an NMI lands while the main loop is halfway through writing OAM, that frame shows a half-updated sprite;
  harmless here, and later lessons fix it with a "ready" flag.)
- **read_joypad**: the ring-counter routine (system_boot_io.md §6).
- **move_sprite**: masks one button bit at a time; BEQ skips when the bit is 0.
- **nmi**: saves registers, OAM DMA, scroll reset after any PPUADDR use, frame counter, restores, RTI.
- **CHR**: tile 1's two planes combine per pixel: plane0 1 + plane1 0 = color 1 (black), plane0 0 + plane1 1 =
  color 2 (yellow).

## Exercises this program supports
- Change the backdrop color ($3F00) and the smiley's colors (sprite palette 4).
- Flip the sprite with attribute bits 6/7; move it behind the background with bit 5.
- Add screen-edge limits with CMP and BCS/BCC.
- Add a second sprite, or a 2×2 metasprite.
- Draw text: put letter tiles in CHR and write their numbers into the nametable at $2000 + y × 32 + x.
