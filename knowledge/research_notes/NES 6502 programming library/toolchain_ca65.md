# Toolchain: ca65 (assembler) and ld65 (linker) from the cc65 suite

**[verified 2026-11-25]** against the cc65 manuals (cc65.github.io/doc/ca65.html and ld65.html) unless marked.
ACT can't run the tools yet; this is what the learner's code targets.

## 1. Building a .nes [verified options]
```
ca65 main.s -g -o main.o                                   # assemble (-g: keep debug info)
ld65 main.o -C nrom.cfg -o game.nes -m game.map --dbgfile game.dbg   # link with our config
```
- `-C file` uses a linker config; it can't be combined with `-t` (a built-in target). ld65 does have a built-in
  `nes` target, but plain-assembly NES projects normally supply their own config so they control the memory
  layout **[the built-in target's intended use was not documented in what was read]**.
- `-m` writes a map file (where every segment and symbol ended up) — great for teaching.
- `--dbgfile` writes debug info (needs `-g` when assembling); debugging emulators can show source lines from it.
- Installing on macOS: `brew install cc65` **[unverified this session, standard Homebrew formula]**.

## 2. Labels and scope
- Normal labels: `reset:` — global within the file.
- Cheap local labels: `@loop:` — visible only between two normal labels. Perfect for loops inside a routine.
- Anonymous labels: a bare `:`; refer to them with `:+` (next), `:-` (previous), `:++`, `:--` (two away).
  Handy but hard to read; prefer named `@labels` with beginners.
- `.proc name` ... `.endproc` — a named scope; `name` is also a label in the outer scope, and labels inside are
  local to it. `.scope`/`.endscope` with `Name::symbol` to reach inside.

## 3. Directives the course uses
| Directive | Example | Meaning |
|---|---|---|
| `.segment` | `.segment "CODE"` | put what follows into a segment; `.segment "ZEROPAGE": zeropage` marks zero page |
| shortcuts | `.code` `.rodata` `.bss` `.data` `.zeropage` | `.zeropage` = `.segment "ZEROPAGE": zeropage` |
| `.byte` | `.byte $0F, $30, "HI"` | bytes (and string bytes) |
| `.word` / `.addr` | `.addr nmi, reset, irq` | 16-bit little-endian values |
| `.res` | `.res 256` / `.res 8, $00` | reserve n bytes (optionally filled) |
| `.include` | `.include "constants.inc"` | paste in another source file |
| `.incbin` | `.incbin "tiles.chr"` | paste in a binary file (e.g. graphics) |
| `.macro` | `.macro inc16 addr` ... `.endmacro` | a macro; use `.local` for labels inside it |
| constants | `PPUCTRL = $2000` | a named number (`:=` also makes a label for debuggers) |
| `.import` / `.export` (`zp` variants) | | share symbols between files |

## 4. Byte operators
`<expr` = low byte (bits 0-7), `>expr` = high byte (bits 8-15); also `.lobyte()` / `.hibyte()`.
`LDA #>oam` loads the page number of `oam` (for OAM DMA); `LDA #<table / STA ptr / LDA #>table / STA ptr+1`
builds a pointer.

## 5. Zero page vs absolute addressing [verified rules]
ca65 picks zero page when it knows the address fits in a byte: a constant under $100, an expression using
`<`/`>`, or a symbol from a zero-page segment / `.importzp`. Otherwise it uses absolute. Undefined-yet symbols
default to absolute — so declare zero-page variables before code uses them (or import them as zp). Force a mode
with `z:` (zero page) or `a:` (absolute), e.g. `LDA a:$0010` **[force prefixes: from a summary of the manual's
middle section, not read verbatim]**.

## 6. ld65 config files [verified syntax]
Two sections:
- `MEMORY` — named areas: `start`, `size` (both required), `type = ro|rw`, `file = %O` (the output file) or
  `file = ""` (not written: RAM), `fill = yes` + `fillval` to pad unused space. Areas with `file = %O` are
  written to the output in the order listed — that's how header, PRG and CHR end up in the right order.
- `SEGMENTS` — each segment says where it goes: `load = AREA`, `type = ro|rw|bss|zp`, and optionally `start`
  (fixed address, e.g. the vectors at $FFFA), `align`, `define`, `optional`.

An NROM-256 config (32 KB PRG, 8 KB CHR) matching hello_nes.md:
```
MEMORY {
    ZP:     start = $0000, size = $0100, type = rw, file = "";
    OAM:    start = $0200, size = $0100, type = rw, file = "";
    RAM:    start = $0300, size = $0500, type = rw, file = "";
    HEADER: start = $0000, size = $0010, type = ro, file = %O, fill = yes, fillval = $00;
    PRG:    start = $8000, size = $8000, type = ro, file = %O, fill = yes, fillval = $00;
    CHR:    start = $0000, size = $2000, type = ro, file = %O, fill = yes, fillval = $00;
}
SEGMENTS {
    ZEROPAGE: load = ZP,     type = zp;
    OAM:      load = OAM,    type = bss, align = $100;
    BSS:      load = RAM,    type = bss;
    HEADER:   load = HEADER, type = ro;
    CODE:     load = PRG,    type = ro;
    RODATA:   load = PRG,    type = ro;
    VECTORS:  load = PRG,    type = ro, start = $FFFA;
    CHARS:    load = CHR,    type = ro;
}
```
For NROM-128, PRG is `start = $C000, size = $4000` and the header's PRG count is 1 **[standard]**.

## 7. Emulators for testing [unverified this session]
Commonly recommended for development: Mesen (accurate, strong debugger, reads ca65/ld65 debug files) and FCEUX
(long-standing debugger). Accurate emulators matter because some mistakes (writing the PPU outside vblank,
uninitialized RAM) can look fine in forgiving emulators and fail on hardware. ACT's own NES pane will come with
the planned emulator step.
