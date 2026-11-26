# Sega Genesis / Mega Drive Sound Programming (YM2612, PSG, Z80, sound drivers)

Research date: 2026-11-18. Audience: an AI tutor that teaches a beginner 68k asm homebrew, and later Sonic ROM hacking.
Method: register facts were cross-checked across Plutiedev, the Sega Genesis Technical Manual (SMS Power transcription), the MegaDrive Wiki (md.railgun.works), SMS Power's SN76489 page, and SpritesMind / NESdev forum posts. Conflicts are flagged inline. All code is original, short, and **untested on hardware or emulator in this session**.

Note on sources: Sonic Retro (info.sonicretro.org) and Sega Retro (segaretro.org) article pages returned bot-protection "Access Denied" pages to the fetch tool. Facts about SMPS and GEMS below come from search-result snippets of those pages plus GitHub listings, which is weaker than reading the pages in full.

---

## YM2612 (FM): ports, busy flag, register map, operators/algorithms, frequency formula, ch3 special mode, DAC, timing, and why games drive it from the Z80

### Takeaway
The YM2612 is a 6-channel, 4-operator FM chip on the Z80's bus. You reach it at $A04000-$A04003 from the 68k (after taking the Z80 bus) or $4000-$4003 from the Z80. Part I ($A04000/1) holds the global registers and channels 1-3; Part II ($A04002/3) holds channels 4-6. Each write is "register number to the address port, value to the data port". Bit 7 of the status byte is the busy flag. The note pitch is an 11-bit F-number plus a 3-bit block (octave): F-number = f_Hz × 2^(21−block) / (clock/144). The clock is about 7.67 MHz on NTSC and 7.60 MHz on PAL, so clock/144 is about 53,267 Hz (NTSC) or 52,781 Hz (PAL). Example: A4 (440 Hz) is block 4 with F-number 1083 on NTSC.

### Cited Findings

**Ports and parts**
- Part I (global registers plus channels 1-3) is at Z80 $4000-$4001 and 68k $A04000-$A04001. Part II (channels 4-6) is at Z80 $4002-$4003 and 68k $A04002-$A04003. The data bus is 8 bits. — [MegaDrive Wiki YM2612](https://md.railgun.works/index.php?title=YM2612); same addresses in the [Genesis Technical Manual YM2612 section](https://www.smspower.org/maxim/Documents/YM2612)
- Write order: register address to $4000 (or $4002), then data to $4001 (or $4003). — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- Global registers exist only in bank 0 (Part I). — [Plutiedev YM2612 registers](https://plutiedev.com/ym2612-registers)
- The YM2612 sits on the Z80 bus. While the Z80 is running, the 68k must pause it (request the bus) before accessing the YM, then resume it. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)

**Status / busy flag**
- Reading any of the four port addresses returns the status byte. Bit D7 is Busy: "1 if busy, 0 if ready for new data". The status also has Timer A/B overflow flags (their bit positions were illegible in the transcription). Before writing, read and wait until busy clears. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- The busy period varies by operation. TL writes seem to need more time than DAC writes. TmEE's engine, "as do many others", ignores the busy bit entirely. On a Model 2, a PCM loop that waits on Busy tops out "somewhere near 33KHz". — TmEE in [SpritesMind YM2612 reference thread p.7](https://gendev.spritesmind.net/forum/viewtopic.php?p=5699)
- Stef (SGDK author) found that 28 Z80 cycles between two register *address* writes is enough on both MD1 and MD2 (YM3438). Data writes may need up to about 72 Z80 cycles (he was unsure of the exact figure). He prefers polling busy before each unsafe access over fixed delays. — [SpritesMind "General guidelines on working with PSG/YM2612 natively"](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)

**Clocks and sample rate**
- Master clock: 53.693175 MHz (NTSC) / 53.203424 MHz (PAL). The 68000 and YM2612 run at master/7, which is 7.67045357 MHz (NTSC) / 7.60048914 MHz (PAL). The Z80 and PSG run at master/15, which is 3.579545 MHz (NTSC) / 3.54689493 MHz (PAL). — [rhargreaves mega-drive-midi-interface wiki](https://github.com/rhargreaves/mega-drive-midi-interface/wiki/Sound-chip-timings-with-PAL-vs.-NTSC)
- The chip outputs one sample every 144 clocks, which gives about 53,267 Hz on NTSC. Sik confirms the YM uses the same clock as the 68000, so the rate varies slightly between NTSC and PAL. — tepples and Sik in [NESdev "YM2612 frequency range"](https://forums.nesdev.org/viewtopic.php?p=146930)
- Sega Retro gives the FM sample rate as 53.267 kHz (NTSC) and 52.781 kHz (PAL). — [Sega Retro YM3438](https://segaretro.org/YM3438) (via search snippet; page itself was bot-blocked)

**Global registers (Part I only)**
- `$22` LFO: `0000 EN F2 F1 F0`. Rate runs from 3.82 Hz (000) to 69.22 Hz (111). — [Plutiedev](https://plutiedev.com/ym2612-registers). The MegaDrive Wiki gives 3.98 to 72.2 Hz instead and notes that the LFO must be enabled globally, per channel (AMS/PMS) and per operator (AM bit). — [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612). *Conflict explained under Inferences: the two use different clock assumptions.*
- `$24`/`$25` Timer A: 10 bits. `$24` holds bits 9-2 and `$25` holds bits 1-0. The MSB register is written first. — [Plutiedev](https://plutiedev.com/ym2612-registers), [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612). Nemesis adds that the Timer A registers are *not* latched as a pair like the frequency registers. A new value takes effect at the next overflow or load. — [SpritesMind p.7](https://gendev.spritesmind.net/forum/viewtopic.php?p=5699)
- `$26` Timer B: 8 bits. — [Plutiedev](https://plutiedev.com/ym2612-registers)
- Timer periods:
  - Sega manual: Timer A = 18 × (1024 − A) µs; Timer B = 288 × (256 − B) µs. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
  - Plutiedev, clock-corrected: Timer A = ($400 − A) × 18.77 µs; Timer B = ($100 − B) × 300.34 µs. — [Plutiedev](https://plutiedev.com/ym2612-registers)
  - Nemesis's general formula: Timer A µs = 144 × (1024 − NA) / M, and Timer B µs = 2304 × (256 − NB) / M, where M is the clock in MHz. — [SpritesMind p.7](https://gendev.spritesmind.net/forum/viewtopic.php?p=5699)
  - Timers raise no interrupts, so software must poll the status flags. The Sega manual remarks that no one at Sega had used the timers. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- `$27` ch3 mode/timer control: `M1 M0 RST_B RST_A EN_B EN_A LOAD_B LOAD_A`. Mode 00 is normal, 01 is ch3 special, and 10 is CSM. — [Plutiedev](https://plutiedev.com/ym2612-registers). The Sega manual calls 10/11 "illegal". — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- `$28` key on/off: bits 7-4 are the operator key bits and bits 2-0 are the channel. Channel codes: 000 = ch1, 001 = ch2, 010 = ch3, 100 = ch4, 101 = ch5, 110 = ch6. Values 011 and 111 are unused. — agreed by [Plutiedev](https://plutiedev.com/ym2612-registers), [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612) and [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612). Sega always set all four operator bits of a channel the same, so `$F0` = ch1 all operators on and `$00` = ch1 off. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- Key-on starts the attack and key-off starts the release. Writing the same state again does not affect the envelope. — [Plutiedev](https://plutiedev.com/ym2612-registers)
- `$2A` DAC data: unsigned 8-bit, output in place of FM channel 6. — [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612), [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- `$2B` DAC enable: bit 7 (1 = DAC, 0 = FM6). — [Plutiedev](https://plutiedev.com/ym2612-registers). DAC output is panned by ch6's `$B6` L/R bits. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- Undocumented `$2C` (found by Oerg866, 2012): with bit 5 set, the PCM/DAC panning depends on how many FM channels have L or R set. — [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612)

**Per-operator registers ($30-$9F)**
- Bit layouts:
  - `$30` DT/MUL: `0 DT2 DT1 DT0 MUL3..0` (MUL 0 = ×0.5)
  - `$40` TL: `0 TL6..0` (0.75 dB per step, $7F quietest)
  - `$50` RS/AR: `RS1 RS0 0 AR4..0`
  - `$60` AM/D1R: `AM 0 0 D1R4..0`
  - `$70` D2R: `000 D2R4..0`
  - `$80` D1L/RR: `D1L3..0 RR3..0` (RR has one bit fewer than the other rates)
  - `$90` SSG-EG: `0000 EN M2..0` (AR must be 31 for SSG-EG to behave)
  — [Plutiedev](https://plutiedev.com/ym2612-registers)
- Address = base + channel (0-2) + operator offset ($0, $4, $8, $C). Example for ch1: $30, $34, $38, $3C. Part II repeats the layout for ch4-6. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612), [Plutiedev](https://plutiedev.com/ym2612-registers)
- **Operator naming quirk.** In Yamaha datasheet naming, register offsets +0/+4/+8/+C are operators S1, S3, S2, S4, not S1-S4 in order. — [Plutiedev](https://plutiedev.com/ym2612-registers). The Sega manual instead numbers operators 1-4 in register order (op1 = +0, op2 = +4, op3 = +8, op4 = +C). — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612). **Flag:** tools, docs and algorithm diagrams use one convention or the other, so check which one a source uses.
- Silencing a channel: TL alone is not enough, because the next note inherits the leftover envelope. For a true stop, set TL=$7F, D1L and RR to max, and key off. — Count SymphoniC and Stef in [SpritesMind guidelines thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)

**Per-channel registers ($A0-$B6)**
- `$A0-$A2` F-number low 8 bits (ch1-3).
- `$A4-$A6` = `00 BLK2..0 F10..F8`. **Write the high register ($A4+) first.** The new frequency only takes effect when the low byte is written.
- `$B0-$B2` = `00 FB2..0 ALG2..0` (feedback applies to operator 1's self-modulation).
- `$B4-$B6` = `L R AMS1 AMS0 0 PMS2..0`.
— [Plutiedev](https://plutiedev.com/ym2612-registers); the high-first rule is also in the [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- Eight algorithms (0-7). The Sega manual suggests uses such as alg 0 for distortion guitar, alg 4 for flute/bells/drums, and alg 7 for pipe organ. In alg 7, all four operators are carriers summed to the output. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)

**Frequency (F-number / block)**
- Sik: block acts like a left shift (each block doubles the frequency), the F-number maximum is 2047, and a usual octave table runs from 644 (C) to 1214 (B). — [NESdev thread](https://forums.nesdev.org/viewtopic.php?p=146930)
- TmEE's table generator computes F-number = f × 131072 / (master/7/144), with the octave placed at bit 11 (block). — [NESdev thread](https://forums.nesdev.org/viewtopic.php?p=146930)
- Plutiedev's approximate semitone values in block 0 include C = 644, C# = 681 and B = 1214. Each block increment doubles the pitch. — [Plutiedev](https://plutiedev.com/ym2612-registers)
- The Sega manual's 12-tone table (617, 653, 692, 733, 777, 823, 872, 924, 979, 1037, 1099, 1164) is garbled in the transcription: one row is out of order and another has only 11 entries. Its example note is `$A4=$22, $A0=$69` (block 4, F-number 617). — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- Highest output frequency is half the sample rate (about 26.4 kHz on PAL). High notes alias. — TmEE in [NESdev thread](https://forums.nesdev.org/viewtopic.php?p=146930)

**Channel 3 special mode**
- With $27 mode = 01, each ch3 operator has its own frequency. — [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612)
- **CONFLICT in operator-to-register mapping:**
  - Plutiedev (datasheet naming): S1 = $AD/$A9, S2 = $AE/$AA, S3 = $AC/$A8, S4 = $A6/$A2, the last being ch3's normal frequency registers. — [Plutiedev](https://plutiedev.com/ym2612-registers)
  - Sega manual: op1 = $A2/$A6, op2 = $A8/$AC, op3 = $A9/$AD, op4 = $AA/$AE. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
  - As with all frequency registers, write the high byte ($AC-$AE) before the low byte ($A8-$AA).

**DAC**
- The DAC must be fed at exact sample times in software, usually on the Z80. — [Plutiedev](https://plutiedev.com/ym2612-registers), [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612)
- The Sega manual warns that, short of very clever software, FM channels can't be used at the same time as the DAC. — [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- The original YM2612's output multiplexer truncates the 14-bit output to 9 bits, which causes the "ladder effect" distortion. Later Model 2 consoles use an improved chip (YM3438-type) that doesn't have it. — [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612)

**Why Z80 vs 68k**
- Stef: more games avoid the Z80 for the YM2612 than use it. Sonic 1 and Phantasy Star IV use the Z80 mainly for DAC samples. — [SpritesMind guidelines thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)
- Sonic 2 decompresses each tune into Z80 RAM before playing it. — Gigasoft in [SpritesMind guidelines thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)

### Inferences
- **Frequency formula (derived from the cited pieces):** f_Hz = F × 2^block × (clock/144) / 2^21, so F = f × 2^(21−block) / (clock/144). This matches TmEE's block-4 constant 131072 = 2^17 and Sik's 644-1214 table. Checks against the formula:
  - C0 (16.35 Hz) at block 0 → F = 644. A4 (440 Hz) at block 4 → F = 440 × 131072 / 53267 ≈ 1083 (NTSC). The same note on PAL (52,781 Hz) needs F ≈ 1093.
  - With 644-1214 F-numbers, block number = octave number in scientific pitch (C4 = middle C = block 4, F 644).
  - NTSC/PAL F-numbers differ by about 0.9% (about 16 cents). One forum post calls this inaudible. Strict tuning needs a per-region table, which the rhargreaves MIDI interface does.
- **Why the Sega manual's numbers look off:** its timer constants (18 µs, 288 µs), the MegaDrive Wiki's LFO range (3.98-72.2 Hz) and its F-number table (617 for C) all fit an assumed 8 MHz clock.
  - 144/8 = 18 µs and 617 × 8 MHz/144/2^21 = 16.35 Hz = C0.
  - Plutiedev's values (18.77 µs, 3.82-69.22 Hz, C = 644) are the same quantities rescaled to the real 7.67 MHz clock.
  - Teach the Plutiedev/Sik table (644…1214) rather than the manual's. *This is my calculation; no source states it.*
- **Ch3 mapping:** Plutiedev's mapping agrees with how I remember MAME's `fm.c` (register $A9 to slot 1, $AA to slot 2, $A8 to slot 3, $A2 to slot 4), but I did not fetch MAME source this session. Treat Plutiedev's table as likely correct and the Sega manual's as using different operator numbering, unverified.
- **Key-on bits:** Plutiedev maps bit 4 = S1, bit 5 = S2, bit 6 = S3, bit 7 = S4 (datasheet names). Because S2 lives at register offset +8, bit 5 controls the operator at +8, not +4. The Sega manual's ordering would imply otherwise. Beginners should key all four ($F0 | ch) and avoid the question.
- **Why most drivers put YM/DAC work on the Z80:** the 68k can only touch the YM by stopping the Z80. That stall wrecks Z80-timed DAC playback, and DAC writes need steady timing anyway. Many classic designs still keep music logic on the 68k and use the Z80 only for samples (Sonic 1, MDSDRV, Mega PCM). Pure-Z80 drivers (SMPS Z80, XGM, Echo) free the 68k entirely.
- **Hidden hazard when both CPUs write the YM:** suppose the Z80 has written `$2A` to the address port and the 68k takes the bus before the Z80 writes the data byte. The Z80's next data write then lands in whatever register the 68k selected. Drivers that share the YM must re-select the register after every bus handoff. *This is my reasoning; I found no source confirming it.*

#### Minimal example: play one FM note (A4 on ch1) from the 68k, no sound driver
Assumes the Z80 is out of reset and the 68k holds the Z80 bus (see the Z80 section). Values come from the cited register layouts. Alg 7 with only one carrier audible gives a plain sine.

```asm
YM_A0   equ $A04000          ; Part I address / status
YM_D0   equ $A04001          ; Part I data

; d0.b = register, d1.b = value   (Part I only)
YmWrite:
.busy1: btst    #7,(YM_A0).l      ; bit 7 = busy
        bne.s   .busy1
        move.b  d0,(YM_A0).l
        nop                       ; small gap after address write
        nop
        move.b  d1,(YM_D0).l
        rts

; table of (register, value) pairs, terminated by $FF
FmPatch:
        dc.b $22,$00, $27,$00, $2B,$00, $28,$00   ; LFO off, ch3 normal, DAC off, ch1 key off
        dc.b $B0,$07, $B4,$C0                      ; FB=0 ALG=7, L+R on
        dc.b $30,$01, $34,$01, $38,$01, $3C,$01    ; DT=0 MUL=1, all 4 ops
        dc.b $40,$00, $44,$7F, $48,$7F, $4C,$7F    ; TL: op@+0 loud, others silent
        dc.b $50,$1F, $54,$1F, $58,$1F, $5C,$1F    ; AR=31
        dc.b $60,$00, $64,$00, $68,$00, $6C,$00    ; D1R=0
        dc.b $70,$00, $74,$00, $78,$00, $7C,$00    ; D2R=0
        dc.b $80,$0F, $84,$0F, $88,$0F, $8C,$0F    ; D1L=0 RR=15
        dc.b $90,$00, $94,$00, $98,$00, $9C,$00    ; SSG-EG off
        dc.b $A4,$24, $A0,$3B                      ; block 4, F=$43B (1083) -> ~440 Hz NTSC; HIGH FIRST
        dc.b $28,$F0                               ; key on ch1, all ops
        dc.b $FF
        even

PlayFmNote:
        lea     FmPatch(pc),a0
.loop:  move.b  (a0)+,d0
        cmp.b   #$FF,d0
        beq.s   .done
        move.b  (a0)+,d1
        bsr.s   YmWrite
        bra.s   .loop
.done:  rts
; later: d0=$28, d1=$00 -> key off (release)
```

### Gaps
- I did not find the exact busy-flag duration in YM clocks from a primary measurement, only Stef's estimates (28 / ~72 Z80 cycles) and TmEE's qualitative notes. Nemesis's full test write-ups in the SpritesMind thread were not read beyond page 7.
- The bit positions of the Timer A/B overflow flags in the status byte were illegible in the manual transcription. They are commonly given as bit 0 = A and bit 1 = B, but that is unverified here.
- I could not confirm from a fetched source whether status reads are reliable on all four port addresses on every console model. Some community lore says to read only $4000 / $A04000. This is unverified, so beginners should poll $A04000.
- I could not confirm from a source fetched this session that asserting Z80 reset ($A11200 = 0) also holds the YM2612 in reset. Many developers report it does, so YM writes made while the Z80 is held in reset may be lost. Verify before teaching it.
- The ch3 special-mode operator mapping conflicts between sources (see above). This needs checking against MAME/Genesis Plus GX source or Nemesis's tests.
- Test register $21 and YM3438-vs-YM2612 differences beyond the ladder effect are not covered.

---

## PSG (SN76489-compatible): port, latch/data format, channels, attenuation, frequency, silencing at boot

### Takeaway
The PSG is built into the VDP. It is write-only at 68k $C00011 or Z80 $7F11, and it has three square-wave tone channels plus one noise channel, each with 4-bit attenuation (0 = loudest, 15 = off, 2 dB per step). Tone pitch is a 10-bit divider N: f = clock / (32 × N), with clock 3,579,545 Hz on NTSC and 3,546,895 Hz on PAL. To silence everything, write `$9F, $BF, $DF, $FF`.

### Cited Findings
- **Ports:** 68k $C00011 (mirrored at $C00013/15/17) and Z80 $7F11 (mirrored at $7F13/15/17). In SMS compatibility mode it is reached through I/O ports $40-$7F instead. — [SMS Power SN76489](https://www.smspower.org/Development/SN76489); [Plutiedev PSG](https://plutiedev.com/psg) gives $C00011 / $7F11
- **Channels:** tone channels 0-2 (square waves) and channel 3 (noise). Noise is typically used for hi-hats and sound effects. — [Plutiedev PSG](https://plutiedev.com/psg)
- **Latch byte** `1 c c t d d d d`: `cc` = channel, `t` = 1 for volume or 0 for tone/noise, `dddd` = low 4 data bits. **Data byte** `0 - D D D D D D`: 6 high bits of the latched 10-bit tone register. A data byte never clears the latch. — [SMS Power](https://www.smspower.org/Development/SN76489)
- Practical forms of the byte formulas:
  - Volume: `$90 | (ch<<5) | atten`.
  - Tone: first `$80 | (ch<<5) | (N & $0F)`, then `N >> 4`.
  - N ranges from 0 to 1023, and lower N gives a higher pitch.
  — [Plutiedev PSG](https://plutiedev.com/psg)
- **Attenuation:** 2 dB per step. %0000 is full volume and %1111 is silent. — [SMS Power](https://www.smspower.org/Development/SN76489); [Plutiedev](https://plutiedev.com/psg) agrees (15 mutes)
- **Frequency:** f = clock / (32 × N). With a 3,579,545 Hz clock, N = $0FE gives about 440.4 Hz. N = 0 or 1 outputs a constant +1, which is silent. — [SMS Power](https://www.smspower.org/Development/SN76489)
- Plutiedev's C-3..B-3 values: 851, 803, 758, 715, 675, 637, 601, 568, 536, 506, 477, 450. Each octave up halves N. — [Plutiedev PSG](https://plutiedev.com/psg)
- PSG/Z80 clock: 3.57954500 MHz (NTSC) / 3.54689493 MHz (PAL). — [rhargreaves wiki](https://github.com/rhargreaves/mega-drive-midi-interface/wiki/Sound-chip-timings-with-PAL-vs.-NTSC)
- **Lowest note:** TmEE calculates the lowest PSG tone on NTSC as 3579545/32/1024, about 109.2 Hz (around A2). For lower sounds, use the periodic ("6.25% duty") noise mode or the YM. — [SpritesMind guidelines thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)
- **Noise register:** bit 2 selects white (1) or periodic (0) noise. Bits 1-0 select the shift rate: the counter reloads with $10 (00), $20 (01) or $40 (10), or follows Tone 2's value (11). The noise output clocks the LFSR rather than going to the mixer directly. — [SMS Power](https://www.smspower.org/Development/SN76489)
- Single noise bytes: periodic `$E0-$E3` and white `$E4-$E7` (the last of each set follows channel 2). When the noise follows channel 2, mute channel 2. — [Plutiedev PSG](https://plutiedev.com/psg)
- Sega's integrated PSG uses a 16-bit LFSR with white-noise taps at bits 0 and 3 ($0009). Discrete SN76489 parts use 15 bits with different taps, so Sega noise sounds different from a ColecoVision or BBC Micro. — [SMS Power](https://www.smspower.org/Development/SN76489)
- **Power-on state:** Sega's integrated versions "seem to" start with zero tone registers and volumes at silence. Discrete chips start random. — [SMS Power](https://www.smspower.org/Development/SN76489)
- The PSG has no hardware envelopes. Fake them by rewriting volume/pitch every frame. Plutiedev suggests its EEF envelope format (the same format Echo uses). — [Plutiedev PSG](https://plutiedev.com/psg)

### Inferences
- **Boot silencing:** applying the volume formula with attenuation 15 to channels 0-3 gives `$9F, $BF, $DF, $FF`. SMS Power says the Sega PSG *seems* to boot silent, but that is hedged and a soft reset doesn't clear the PSG, so always write these four bytes during init.
- **PAL tuning:** A4 is N ≈ 254 on NTSC and N ≈ 252 on PAL (3,546,895 / (32 × 440)). Both values are my calculation.
- In the noise rate formula, "clock/512" is the same as the SMS Power "reset to 0x10" counter description (16 × 32). The equivalence is my reading.

#### Minimal example: play a PSG tone (≈440 Hz on NTSC)
```asm
PSG     equ $C00011

InitPsg:
        lea     PSG,a0
        move.b  #$9F,(a0)       ; ch0 volume off
        move.b  #$BF,(a0)       ; ch1 off
        move.b  #$DF,(a0)       ; ch2 off
        move.b  #$FF,(a0)       ; noise off
        rts

PlayPsgA4:                      ; N = 254 = $0FE
        lea     PSG,a0
        move.b  #$80|($0FE&$0F),(a0)   ; latch ch0 tone, low 4 bits ($8E)
        move.b  #($0FE>>4),(a0)        ; data byte, high 6 bits ($0F)
        move.b  #$90|$0,(a0)           ; ch0 attenuation 0 = full volume
        rts
```
The PSG lives on the VDP, not the Z80 bus, so the 68k needs no bus request to write it. *This follows from the $C00011 address being VDP space; no source states it outright.* If a Z80 driver also writes the PSG, two-byte tone writes from both CPUs can interleave, so let only one CPU own the PSG.

### Gaps
- The noise "clock/512, /1024, /2048" phrasing comes from my reading of the SMS Power counter values ($10, $20, $40 × 32). The page itself states counter reset values.
- No fetched source documents the PSG's analogue mix level relative to the YM across Model 1/2. That affects balance but not register programming.

---

## Z80: 8 KB RAM, bus request/reset protocol, bank window and register, why drivers run there, loading a driver

### Takeaway
The Z80 has 8 KB of RAM, seen at $A00000-$A01FFF by the 68k and at $0000-$1FFF by the Z80. The 68k controls the Z80 through two 16-bit registers:
- **$A11100 (bus request):** write $100 and wait until bit 0 of the byte at $A11100 reads 0; write $000 to release.
- **$A11200 (reset):** write $000 to hold the Z80 in reset and $100 to release it.

To load a driver:
1. Assert reset, request the bus, then release reset.
2. Copy the program into Z80 RAM byte by byte.
3. Pulse reset, then release the bus.

The Z80 sees 68k memory through a 32 KB window at $8000-$FFFF. The window is selected by a 9-bit serial bank register at $6000: write it 9 times, one bit each in bit 0, starting with address bit A15.

### Cited Findings
- Constants: `Z80Ram $A00000`, `Z80BusReq $A11100`, `Z80Reset $A11200`. RAM is 8 KB, and the Z80 program starts at $0000, sets itself up, and must fit in 8 KB. — [Plutiedev: Using the Z80](https://plutiedev.com/using-the-z80)
- Z80 RAM can't be accessed while the Z80 is held in reset. The access sequence is `move.w #$000,(Z80Reset)` / `move.w #$100,(Z80BusReq)` / `move.w #$100,(Z80Reset)`. — [Plutiedev](https://plutiedev.com/using-the-z80)
- A proper reset holds $000 in Z80Reset for at least 192 cycles (Plutiedev loops `dbf` 20 times; longer is harmless). To start the Z80, write `#$100` to Z80Reset and then `#$000` to Z80BusReq. — [Plutiedev](https://plutiedev.com/using-the-z80)
- Use only byte accesses to Z80 RAM from the 68k ("word accesses won't work"). — [Plutiedev](https://plutiedev.com/using-the-z80)
- Pause macro: `move.w #$100,(Z80BusReq)`, then loop on `btst #0,(Z80BusReq)` / `bne` until the bit clears. The fast variant skips the wait and should be used only when not touching Z80 RAM. — [Plutiedev](https://plutiedev.com/using-the-z80)
- The 68k and Z80 communicate only through Z80 RAM. A 16-bit Z80 access can be split by a bus request, because "the Z80 may get interrupted in the middle of an instruction". Make shared flags single bytes. — [Plutiedev](https://plutiedev.com/using-the-z80)
- **DMA hazard:** on some board revisions, especially early ones, the Z80 running during VDP DMA can put garbage into VRAM, and emulators never show this. The workaround is to request the Z80 bus around DMA. — [Plutiedev](https://plutiedev.com/using-the-z80)
- Z80-side addresses:
  - YM2612 at $4000-$4003. — [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612), [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
  - PSG at $7F11. — [SMS Power](https://www.smspower.org/Development/SN76489), [Plutiedev PSG](https://plutiedev.com/psg)
- **Bank register ($6000):**
  - It is a serial shift register. Each write enters at bit 23 and the earlier bits shift down, so after 9 writes the first value written sits at bit 15. — [SpritesMind "z80 BankSwitch reset/initialize"](https://gendev.spritesmind.net/forum/viewtopic.php?p=31294)
  - Writing the nine high address bits one at a time into bit 0 works in practice. — [SpritesMind p=31296](https://gendev.spritesmind.net/forum/viewtopic.php?p=31296)
  - The 9-bit value drives 68k address lines VA23-VA15, and the Z80's own address lines supply the lower bits. That gives a 32 KB window. — [SpritesMind thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=31294) (via search summary)
  - The register's value after reset is undocumented, so set it explicitly. — [SpritesMind thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=31294) (via search summary)
- **Z80 interrupt:** Stef saw the Z80 VBlank IRQ routine run 2-3 times per frame on hardware versus once in emulators, because the IRQ line stays asserted for about 60 µs. Spending about 180 Z80 cycles in the handler before returning prevents re-entry. — [SpritesMind guidelines thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)
- On the Mega CD, the Z80 can write to main work RAM but can't read it. — Chilly Willy in [SpritesMind guidelines thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)

### Inferences
- **Bank number:** bank = (68k_address >> 15) & $1FF, written LSB first. A Z80 byte read at $8000 + (addr & $7FFF) then returns the ROM byte at addr.
- **Why drivers live on the Z80:**
  - The 68k is freed for game logic.
  - The Z80 can be cycle-counted for DAC timing.
  - The Z80 has its own path to the YM and PSG.
  - The costs: only 8 KB of RAM, and every read through the bank window stalls for 68k bus arbitration. XGM's documented 30-40% idle Z80 load shows how much the parsing costs.
- The Z80 should not read ROM through the bank window while the 68k does DMA. MDSDRV's and XGM's "DMA protection" features exist for this reason.

#### Minimal example: load a Z80 program from the 68k (based on Plutiedev's sequence)
```asm
Z80Ram    equ $A00000
Z80BusReq equ $A11100
Z80Reset  equ $A11200

LoadZ80:                       ; a0 = program, d0.w = size in bytes
        move.w  #$000,(Z80Reset).l
        move.w  #$100,(Z80BusReq).l
        move.w  #$100,(Z80Reset).l      ; Z80 out of reset but stopped by busreq
.wait:  btst    #0,(Z80BusReq).l
        bne.s   .wait
        lea     Z80Ram,a1
        subq.w  #1,d0
.copy:  move.b  (a0)+,(a1)+             ; BYTE accesses only
        dbf     d0,.copy
        move.w  #$000,(Z80Reset).l      ; reset pulse so the Z80 starts at $0000
        moveq   #20,d0
.rst:   dbf     d0,.rst
        move.w  #$100,(Z80Reset).l
        move.w  #$000,(Z80BusReq).l     ; let it run
        rts

Z80Idle: dc.b $F3,$18,$FE               ; di / jr $  (park the Z80 so the 68k can own the YM)
Z80IdleEnd:
        even
```
For the FM example in the YM2612 section:
1. Load `Z80Idle` with this routine.
2. Before calling `PlayFmNote`, request the bus (`move.w #$100,(Z80BusReq)` and wait for bit 0 to clear).
3. Release it afterwards.

#### Z80-side bank select (sketch)
```z80
; in: HL = bank number (68k address >> 15), 9 bits used
SetBank:  ld   de,$6000
          ld   b,9
.next:    ld   a,l
          ld   (de),a        ; only bit 0 is latched
          srl  h
          rr   l             ; HL >>= 1
          djnz .next
          ret
```

### Gaps
- No primary Sega document on the bank register was fetched; it rests on SpritesMind forum descriptions. The bit order (A15 first) agrees across the two posts found.
- The exact stall cost of Z80 reads from the 68k bus (often quoted as about 3+ Z80 cycles extra per access) was not sourced this session.
- Whether $A11100 bit 0 must be polled through a byte read (as Plutiedev's `btst #0` does) or a word read (bit 8) is a matter of access size. Plutiedev's byte form is the one to teach.

---

## Sound drivers for homebrew and hackers, licensing, asm integration, and tracker tools

### Takeaway
For a pure-asm beginner as of Nov 2026, there are three open-licensed, asm-friendly choices:
- **Echo** (Sik; zlib; Z80-only; ESF streams; DefleMask/XM converters)
- **MDSDRV** (superctr; zlib; 68k driver with Z80 PCM; MML via ctrmml/mmlgui)
- **Mega PCM 2** (vladikcomper; MIT; Z80 DAC driver paired with a 68k FM/PSG driver such as SMPS 68k)

**XGM/XGM2** (SGDK, MIT; SGDK 2.11, April 2025) is the most popular for C projects and takes VGM input, which fits the Furnace/DefleMask → VGM → XGM2 pipeline. **SMPS** variants (Sega's own driver, in Sonic disassemblies and community forks such as Clone Driver v2 and Flamewing's S3K driver) are the standard in Sonic hacking but are Sega code with no open license. **GEMS** is a historical Sega of America driver with only reverse-engineering tools.

### Cited Findings

**Echo (Sik)**
- Repository: github.com/sikthehedgehog/Echo. Main programmer Sik, auxiliary programmer Oerg866. Licensed "under the zlib license". — [Echo GitHub](https://github.com/sikthehedgehog/Echo)
- No releases are published (empty Releases section). The README refers to Echo 1.4 (`Echo_SetVolumeEx` ABI grew from 13 to 16 bytes). The repo has 77 commits; the date of the last commit was not visible. — [Echo GitHub](https://github.com/sikthehedgehog/Echo)
- **Asm integration:** include `src-68k/echo.68k` and point its `@Z80Program` include at the prebuilt blob `built/prog-z80.bin`. — [Echo GitHub](https://github.com/sikthehedgehog/Echo)
- Asm API (unless stated, routines preserve all registers):
  - `Echo_Init` takes `a0` = instrument list built with the `Echo_ListEntry` / `Echo_ListEnd` macros pointing at EIF/EEF/EWF data. It loads and starts the Z80 engine.
  - BGM: `Echo_PlayBGM` (a0 = ESF), `Echo_StopBGM`, `Echo_PauseBGM`, `Echo_ResumeBGM`.
  - SFX: `Echo_PlaySFX` (a0 = ESF), `Echo_StopSFX`.
  - `Echo_PlayDirect` injects up to 128 bytes of events.
  - Volume: `Echo_SetVolume` (d0.b 0-255) and `Echo_SetVolumeEx` (16-byte list).
  - `Echo_GetStatus` returns d0.w: bit0 = SFX, bit1 = BGM, bit14 = direct pending, bit15 = busy.
  - `Echo_SetPCMRate` defaults to $04, about 10,653 Hz on NTSC. `Echo_SetStereo` is also available.
  - The API waits automatically if Echo is busy.
  — [Echo doc/api-asm.68k](https://raw.githubusercontent.com/sikthehedgehog/Echo/master/doc/api-asm.68k)
- Data formats documented in `doc/`: ESF (streams), EIF (FM instruments), EEF (PSG envelopes), EWF (PCM). — [Echo doc folder](https://github.com/sikthehedgehog/Echo/tree/master/doc)
- Tools referenced: the mdtools repo, dmf2esf (DefleMask → ESF, two versions), and xm2esf (XM → ESF, by Oerg866) with an ESF optimizer. — [Echo GitHub](https://github.com/sikthehedgehog/Echo)

**MDSDRV (Ian "superctr" Karlsson)**
- zlib license, © 2019-2022. The 68000 runs the driver and the Z80 handles PCM. — [MDSDRV GitHub](https://github.com/superctr/MDSDRV)
- Features:
  - 16 monophonic tracks for music or SFX, each with one of 4 priority levels, freely mixing FM, PSG and PCM.
  - FM3 special mode per operator.
  - PCM: 2 channels at about 17.5 kHz or 3 channels at about 13.3 kHz.
  - Envelopes, portamento, fades and tempo control.
  - About 1 KB of RAM, position-independent.
  — [MDSDRV GitHub](https://github.com/superctr/MDSDRV)
- **Asm integration:** include the blobs `mdsdrv.bin`, `mdsseq.bin` and `mdspcm.bin` and call entry points inside `mdsdrv.bin` (API in `doc/api.md`). The repo includes an SGDK sample. Music is written in MML with **mmlgui** and compiled by **ctrmml**'s `mdslink`, and `quickrom.bat` turns one .mml/.mds file into a test ROM. Building the driver itself still needs the non-free `asm68k`. — [MDSDRV GitHub](https://github.com/superctr/MDSDRV)

**XGM / XGM2 (Stéphane Dallongeville, SGDK)**
- SGDK's current version is "SGDK 2.11 (April 2025)". The SGDK library and its custom tools are MIT-licensed, while GCC/libgcc are GPL3 with a runtime exception. The README lists MDSDRV, Echo and MiniMusic as alternative drivers. — [SGDK GitHub](https://github.com/Stephane-D/SGDK)
- **XGM (v1, 2015):**
  - Takes VGM or XGM input.
  - 4 PCM channels at a fixed 14 kHz. SFX have 16 priority levels, and music uses PCM channel 1. Sample IDs 1-63 are for music and 64-255 for SFX.
  - Parsing runs on the Z80 at about 40% (NTSC) / 30% (PAL) idle load.
  - Includes DMA-contention avoidance options.
  — [SGDK inc/snd/xgm.h](https://github.com/Stephane-D/SGDK/blob/master/inc/snd/xgm.h)
- **XGM2 (2023):**
  - Takes VGM or XGM2 input.
  - 3 PCM channels at 13.3 kHz or 6.65 kHz, FM/PSG volume control, and PCM SFX with 16 priorities.
  - DMA protection.
  - Tempo is synced automatically to 60 or 50 per second depending on region.
  - Resuming after a pause misses some notes until the next key-on.
  — [SGDK inc/snd/xgm2.h](https://github.com/Stephane-D/SGDK/blob/master/inc/snd/xgm2.h)

**SMPS (Sega's "Sample Music Playback System") and Sonic-hacking variants**
- SMPS exists in two families named for the CPU that runs most of the driver: SMPS 68000 and SMPS Z80. Sonic 1 uses a modified SMPS 68k (Type 1b) running on the 68k. Sonic 2's driver is a Z80 port of Sonic 1's 68k driver that uses only Z80 RAM. Knuckles' Chaotix and Tempo use modified SMPS-Z80, and SMPS-PCM runs on the Sega CD's 68000. Hidden Palace found and released the source code of both SMPS-68000 and SMPS-Z80 in 2020. — search snippets of [Sonic Retro SMPS](https://info.sonicretro.org/SMPS), [Sega Retro SMPS/Headers](https://segaretro.org/SMPS/Headers), [SCHG: Port Sonic 2 Final Sound Driver to Sonic 1](https://info.sonicretro.org/SCHG_How-to:Port_Sonic_2_Final_Sound_Driver_to_Sonic_1) (pages bot-blocked; content via search summary)
- **Sonic 2 Clone Driver v2 (Clownacy):**
  - Version v2.8.0.1, a heavily modified version of Sonic 1's SMPS 68k driver.
  - Aims to fix bugs and play music from Sonic 2, S3K and Chaotix, with a focus on advanced DAC use.
  - Built with The Macroassembler AS. Repo last pushed in August 2024.
  - A C++ reimplementation (clone-driver-v2-cpp) began in October 2024 and needs ClownMDSDK.
  - Its wiki recommends an SMPS Z80 driver such as Flamewing's if you only need DAC drums.
  — [Clone Driver v2 listing](https://awesome.ecosyste.ms/projects/github.com%2Fclownacy%2Fsonic-2-clone-driver-v2), [About wiki mirror](https://github.yxlr123.workers.dev/Clownacy/Sonic-2-Clone-Driver-v2/wiki/About), [C++ listing](https://awesome.ecosyste.ms/projects/github.com%2Fclownacy%2Fclone-driver-v2-cpp)
- **Flamewing's S3K driver (often called "Flamedriver"):**
  - A bug-fixed, documented version of the Sonic 3 & Knuckles Z80 SMPS driver.
  - The skdisasm credits list Flamewing for thorough Z80 sound driver documentation and bugfixes, and MarkeyJester for the original disassembly.
  - Sonic Retro has a guide on porting it to other Sonic disassemblies.
  - A "flamedriver" branch name appears in a Sonic Clean Engine fork.
  — [SCHG How-to: Port Flamewing's S3K Sound Driver](https://info.sonicretro.org/SCHG_How-to:Port_Flamewing%27s_Sonic_3_%26_Knuckles_Sound_Driver), [skdisasm](https://github.com/sonicretro/skdisasm), [S.C.E. listing](https://awesome.ecosyste.ms/projects/github.com%2Ftheblad768%2Fsonic-clean-engine-s.c.e.-extended-) (search-level evidence)

**Mega PCM 2 (vladikcomper)**
- A Z80 DAC driver that runs alongside a 68k FM/PSG driver. The core is MIT-licensed; bundled tools carry their own licenses (AS GPL-2.0, sjasmplus BSD-3, asm68k/psylink proprietary "abandonware"). — [MegaPCM GitHub](https://github.com/vladikcomper/MegaPCM)
- Formats: 8-bit unsigned WAV/PCM (up to 25.1 kHz with effects, 32 kHz in turbo mode) and DPCM-HQ/DPCM (up to 20.6 kHz, 25.8 kHz turbo). It has 16 volume levels and 256 pitch levels. — [MegaPCM GitHub](https://github.com/vladikcomper/MegaPCM)
- Buffering lets playback survive DMA transfers of up to 24 KB without stopping the Z80. — [MegaPCM GitHub](https://github.com/vladikcomper/MegaPCM)
- Mainly aimed at Sonic 1 disassemblies with SMPS 68k. It ships bundles for AS, ASM68K and ASM68K-linkable, and lists TheBlad768's Sonic 2/3 clone-driver ports. — [MegaPCM GitHub](https://github.com/vladikcomper/MegaPCM)

**GEMS**
- GEMS was developed by Recreational Brainware (Jonathan Miller, Burt Sloane, Chris Grigg, Mark Miller) at Sega of America's request and replaced an earlier Western driver. It was used by many STI and Blue Sky Software games and by Sonic Spinball, and was first released in 1992. — search snippets of [Sega Retro GEMS](https://segaretro.org/GEMS), [Battle of the Bits](https://battleofthebits.com/arena/Entry/Raw+GEMS/56319)
- An LGPL research/tools project exists: realmonster/GEMS. — [GitHub realmonster/GEMS](https://github.com/realmonster/GEMS)

**Dual PCM / AMPS**
- Furnace's VGM export has a "direct stream mode" whose purpose is to let DualPCM work; the docs say not to use it for other chips. — [Furnace export docs](https://github.com/tildearrow/furnace/blob/master/doc/2-interface/export.md)
- AMPS (a Sonic 1 2005-based driver project by Awuwunya/Natsumi) appears in search results as an alternative 68k driver. — [AMPS-Sonic-1-2005](https://github.com/Awuwunya/AMPS-Sonic-1-2005) (not opened)

**Trackers and export formats**
- Furnace exports:
  - Audio (WAV/Opus/FLAC/Vorbis/MP3).
  - **VGM**, with up to two of each chip type, per-chip volume only from VGM 1.70, a "DeadFish VgmPlay (1.02×)" speed option, and direct-stream mode for DualPCM.
  - ZSM (Commander X16), FCS command stream, and text.
  - **DMF**, legacy DefleMask 0.12 format, which supports Genesis and Genesis ext-ch3. Genesis is not in the 1.1.3+ list.
  - **ROM export** exists only for Atari 2600 (TIunA) and PC Speaker targets, **not Genesis**.
  — [Furnace export docs](https://github.com/tildearrow/furnace/blob/master/doc/2-interface/export.md)

### Inferences
- **Pipelines a beginner can use today:**
  1. Furnace or DefleMask → VGM → SGDK `rescomp` → XGM/XGM2. XGM2's header says it takes VGM input; that rescomp does the conversion is a common understanding but was not confirmed in a fetched rescomp doc.
  2. DefleMask .dmf (or Furnace saving legacy .dmf) → dmf2esf → Echo.
  3. MML in mmlgui → ctrmml `mdslink` → MDSDRV blobs.
  4. Sonic hacks: SMPS2ASM-format songs in the disassembly, with Mega PCM 2 or Clone Driver v2 for DAC.
- **Licensing:**
  - Echo (zlib), MDSDRV (zlib), Mega PCM 2 (MIT) and SGDK/XGM (MIT) are safe for homebrew, including commercial releases. zlib and MIT need only notice retention, and zlib not even in binaries.
  - SMPS and GEMS are Sega-owned code: the 2020 source release and the disassemblies don't grant a license. Hackers use them de facto in ROM hacks, but they are inappropriate for an original commercial homebrew.
  - Clone Driver v2 and Flamedriver derive from Sega code, so the same caution applies. Their repos' own license terms were not checked.
- **Pure-asm fit:**
  - Echo has a native 68k asm API and is the most beginner-friendly for an original asm game.
  - MDSDRV is a binary blob called from asm.
  - XGM2 is written for SGDK's C API. Using it from pure asm would mean reimplementing the 68k side (driver load, command mailbox), which is undocumented here.
- For Sonic ROM hacks, the tutor should teach SMPS concepts (68k driver in Sonic 1, Z80 driver in Sonic 2/3K) before swapping drivers.

### Gaps
- **Echo:** exact latest version and last-commit date (no releases page; 1.4 is mentioned, and newer 1.5/1.6 tags may exist). Channel count and PCM details were not confirmed from the docs fetched.
- **XGM2 from asm:** no documented asm interface was found.
- **SMPS:** Sonic Retro and Sega Retro pages were bot-blocked, so details come from search snippets. Not confirmed: SMPS authorship (often credited to Sega/Cube and composer-programmers), SMPS2ASM's current maintainer and format, and SMPSPlay status.
- **Flamedriver:** canonical repository URL and license not found.
- **GEMS:** whether it runs on the Z80 or 68k was not confirmed by any source fetched. It is commonly described as a Z80-resident driver with a 68k-side API, but that is unverified here. No homebrew license exists.
- **DefleMask:** current export formats (VGM; the historical ROM export for Genesis) were not checked against DefleMask's own docs.
- **Dual PCM:** author, license and repository were not confirmed beyond Furnace's mention.
- **SGDK:** whether there is a release newer than 2.11 between April 2025 and November 2026; the README showed 2.11.

---

## Pitfalls: YM busy waits, 68k accessing YM while Z80 runs, DAC noise, PAL/NTSC tempo

### Takeaway
The classic pitfalls for a beginner:
1. Writing the YM from the 68k without taking the Z80 bus.
2. Skipping busy-waits, which works in emulators and fails on hardware.
3. Writing frequency low-then-high (the change won't latch).
4. Expecting TL=$7F alone to silence a note.
5. Letting the Z80 read ROM or run during DMA.
6. Scratchy DAC from irregular Z80 timing.
7. Music running about 17% slow on PAL when the driver ticks on VBlank.

### Cited Findings
- The YM is on the Z80 bus. Pause the Z80 before 68k access. — [Plutiedev Z80](https://plutiedev.com/using-the-z80)
- Busy timing varies by register and many engines ignore it, but timing that works in emulators can fail on hardware. Stef recommends polling busy before unsafe writes. — [SpritesMind p.7](https://gendev.spritesmind.net/forum/viewtopic.php?p=5699), [SpritesMind guidelines](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406). A driver "perfectly working on emulator ... failed miserably on real hardware" is reported in forum results for this topic. — [SpritesMind thread search result](https://gendev.spritesmind.net/forum/viewtopic.php?p=24724) (snippet only)
- Frequency high byte must be written first. — [Plutiedev](https://plutiedev.com/ym2612-registers), [Genesis Technical Manual](https://www.smspower.org/maxim/Documents/YM2612)
- A true note stop needs TL=$7F, max RR/D1L, and key-off. A key-on during release restarts the attack from the current level. — [SpritesMind guidelines](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)
- The Z80 running during DMA can corrupt VRAM on early boards, so request the bus around DMA. — [Plutiedev Z80](https://plutiedev.com/using-the-z80). MDSDRV's Z80 code guards against ROM reads during DMA. — [MDSDRV](https://github.com/superctr/MDSDRV). XGM is "designed to avoid DMA contention", and the Z80 can miss its VInt if the bus is held or DMA stalls it. — [xgm.h](https://github.com/Stephane-D/SGDK/blob/master/inc/snd/xgm.h)
- **DAC quality:**
  - The original YM2612's 9-bit truncation (ladder effect) adds distortion. — [MegaDrive Wiki](https://md.railgun.works/index.php?title=YM2612)
  - Mega PCM 2 advertises "clean, non-scratchy" output and DMA-survivable buffering as its selling point. That implies naive drivers sound scratchy when the Z80 is stalled. — [MegaPCM](https://github.com/vladikcomper/MegaPCM)
  - DAC replaces FM6 while enabled. — [Plutiedev](https://plutiedev.com/ym2612-registers)
- Z80 VInt fires 2-3 times per frame on hardware unless the handler takes long enough, about 180 Z80 cycles. — [SpritesMind guidelines](https://gendev.spritesmind.net/forum/viewtopic.php?p=24406)
- **Tempo and tuning across regions:**
  - XGM2 syncs to 60 or 50 per second by region and exposes `XGM2_isPAL` / tempo control. — [xgm2.h](https://github.com/Stephane-D/SGDK/blob/master/inc/snd/xgm2.h)
  - Pitch differs slightly between regions because clocks differ, and per-region tables are used. — [rhargreaves wiki](https://github.com/rhargreaves/mega-drive-midi-interface/wiki/Sound-chip-timings-with-PAL-vs.-NTSC)
  - CPU speed scales with the clock, so timer periods look the same to code. — forum snippet in the [YM2612 search results](https://gendev.spritesmind.net/forum/viewtopic.php?p=24411)
- Use byte-only access to Z80 RAM. 16-bit Z80 variables can tear across a bus request. — [Plutiedev Z80](https://plutiedev.com/using-the-z80)

### Inferences
- **PAL tempo:** a driver that advances one tick per VBlank plays at 50/60 = 83% speed on PAL, so about 17% slower. The fixes are to tick from YM Timer A/B (clock-scaled, so nearly identical in both regions), to run an extra tick every 5 frames on PAL, or to use a driver with region-aware tempo (XGM2). *The arithmetic is mine; the region-sync fact is XGM2's.*
- **Pitch:** YM and PSG pitch is about 0.9% flat on PAL with NTSC tables. That is minor but audible next to an in-tune instrument, so offer per-region tables only if the tutor goes deep.
- **Mixed 68k/Z80 YM access:** if the 68k writes the YM while a Z80 DAC driver is running, it must request the bus first. Even then, it can break the Z80's pending address/data pair (see the YM2612 section). Prefer one owner per chip, or a mailbox in Z80 RAM that the Z80 driver services.
- **Tutor checklist for the first hardware-safe sound test:**
  1. Silence the PSG (4 bytes).
  2. Park the Z80 with a known program.
  3. Take the bus.
  4. Initialize all YM key-offs and the DAC off.
  5. Busy-wait before each YM write.
  6. Write high frequency bytes first.
  7. Key on, then release the bus.

### Gaps
- No measured numbers for how much a 68k bus request jitters Z80 DAC playback were found.
- How Sonic 1/2/3 handle PAL tempo (e.g. SMPS speed-up logic) was not sourced, because the Sonic Retro pages were blocked.
- No source was found for whether the busy flag behaves differently on YM3438 / Model 2 ASIC boards beyond Stef's "28 cycles enough on both".
