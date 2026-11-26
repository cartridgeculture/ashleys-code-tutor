# NES 6502 programming library: overview (for a beginner tutor)

Research date: 2026-11-25. Written for ACT's "6502 Assembly (NES)" track. The NES hardware facts were checked
this session against these NESdev Wiki pages (all fetched, HTTP 200): PPU registers, PPU OAM, PPU palettes,
PPU attribute tables, PPU nametables, PPU memory map, PPU pattern tables, iNES, Mirroring, NROM, Init code,
CPU memory map, Controller reading code, Standard controller, APU, APU Pulse. The assembler facts were checked
against the cc65 manuals for ca65 and ld65 (cc65.github.io). The 6502 instruction facts (cpu_6502.md) come from
standard 6502 documentation and were NOT re-fetched this session; they are long-settled, but treat cycle counts
as "check before relying on exact timing".

Marks used in these notes:
- **[verified 2026-11-25]**: read on the source page this session.
- **[standard]**: well-established 6502/NES knowledge, not re-fetched this session.
- **[unverified]**: a common recommendation or tool detail that wasn't checked; say so if you rely on it.

## Which file has what
- `cpu_6502.md`: registers, the status flags, every addressing mode, the 56 official instructions with the flags
  they change, common cycle counts, 2A03 differences (no decimal mode), the stack, interrupts, pitfalls.
- `system_boot_io.md`: the CPU memory map, the vectors, the iNES header, NROM, the reset/init sequence, the NMI
  frame loop, OAM DMA, reading controllers (with edge detection).
- `ppu.md`: PPU registers bit by bit, PPU memory, the CHR tile format, nametables, attribute tables, palettes,
  OAM sprites, mirroring, scrolling, when it's safe to touch the PPU.
- `apu.md`: the APU register map, the pulse channel bit by bit, pitch math, a beep, sound-effect structure.
- `toolchain_ca65.md`: ca65 syntax (labels, scopes, directives, < and >, zero page vs absolute), ld65 config
  files, building a .nes, debug info, emulators.
- `hello_nes.md`: a complete, commented NROM program (a smiley sprite you move with the D-pad) plus its linker
  config, explained section by section. Use it as the reference shape for lesson code.

## Teaching notes
- ACT can't assemble or run NES code yet. Teach by having the learner write real ca65 code and trace it by hand:
  tables of A/X/Y/flags per line, memory before/after, what the PPU would show.
- Beginners stumble on: # (immediate) vs an address; forgetting CLC before ADC / SEC before SBC; branches that
  test the wrong flag after CMP (BCS = "greater or equal", BCC = "less than", unsigned); the PPUADDR write
  order (high byte first) and its shared latch; touching the PPU outside vblank with rendering on; sprite Y
  being one line off; palette entry 0 being shared/transparent; 8-bit wraparound (255 + 1 = 0).
- The learner's research partner dislikes copy-paste recipes. Explain why each line of the init code and the
  NMI handler exists (the reasons are in system_boot_io.md), not just what to type.
- Prefer ca65 syntax. Older tutorials (for example Nerdy Nights) use NESASM syntax, which differs (`.inesprg`,
  `.bank`, different directives). If the learner brings NESASM code, translate it and say what changed.

## Sources
- NESdev Wiki: https://www.nesdev.org/wiki/ (pages listed above, e.g. https://www.nesdev.org/wiki/PPU_registers)
- cc65 documentation: https://cc65.github.io/doc/ca65.html and https://cc65.github.io/doc/ld65.html
- 6502 instruction references (standard, not fetched this session): the MOS MCS6500 programming manual;
  6502.org; the "Obelisk 6502" instruction reference.
