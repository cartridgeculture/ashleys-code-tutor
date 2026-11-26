# The NES APU (sound)

**[verified 2026-11-25]** against the NESdev Wiki "APU" and "APU Pulse" pages unless marked.

## 1. Register map
| Address | Channel |
|---|---|
| $4000-$4003 | pulse 1 |
| $4004-$4007 | pulse 2 |
| $4008-$400B | triangle ($4009 unused) |
| $400C-$400F | noise ($400D unused) |
| $4010-$4013 | DMC (delta-modulation samples) |
| $4015 | channel enable (write) / status (read) |
| $4017 | frame counter |

**$4015 write** `---D NT21`: 1 = enable DMC (D), noise (N), triangle (T), pulse 2, pulse 1. Writing 0 to a bit
silences that channel (its length counter is cleared). Power-up/reset acts like writing $00, so a program must
enable channels before they make sound.
**$4015 read** `IF-D NT21`: DMC IRQ, frame IRQ, DMC active, and whether each length counter is above 0.
Reading clears the frame IRQ flag.
**$4017** `MI-- ----`: bit 7 mode (0 = 4-step), bit 6 IRQ inhibit. Init code writes $40 (4-step, IRQ off).

## 2. A pulse channel, bit by bit (pulse 1 shown; pulse 2 is the same at $4004-$4007)
- **$4000** `DDLC VVVV`
  - DD duty: 0 = 12.5%, 1 = 25%, 2 = 50%, 3 = 75% (sounds like 25%, inverted)
  - L: 1 = length counter halted (the note sustains) and the envelope loops; 0 = one-shot
  - C: 1 = constant volume (VVVV is the volume); 0 = use the decaying envelope (VVVV is its speed)
  - VVVV: volume 0-15 or envelope period
- **$4001** `EPPP NSSS` sweep: E enable, PPP period, N negate (1 = pitch rises), SSS shift.
  Gotcha: even with the sweep disabled, a computed target period above $7FF mutes the channel (this hits low
  notes). Writing $08 (negate flag set, sweep off) avoids it.
- **$4002** timer low 8 bits.
- **$4003** `LLLL LTTT`: L = length counter load (table index), T = timer high 3 bits. Writing $4003 reloads the
  length counter, restarts the envelope and resets the waveform phase (a click), so for vibrato change only
  $4002.

## 3. Pitch
f = CPU clock / (16 × (t + 1)), so t = CPU clock / (16 × f) − 1, with t the 11-bit timer value ($4003 bits 2-0
are bits 10-8, $4002 is bits 7-0). NTSC CPU clock = 1,789,773 Hz; PAL = 1,662,607 Hz.
Example: A440 on NTSC: 1,789,773 / (16 × 440) − 1 ≈ 253 = $0FD → $4002 = $FD, $4003 low bits = 0.
If t < 8 the pulse channel is silent.

## 4. A beep (pulse 1, A440, constant volume, sustained)
```
    lda #%00000001
    sta $4015        ; enable pulse 1
    lda #%10111111   ; duty 50% (10), halt length (1), constant volume (1), volume 15
    sta $4000
    lda #$08
    sta $4001        ; sweep off, negate set (avoids the low-note mute)
    lda #$FD
    sta $4002        ; timer low
    lda #$00
    sta $4003        ; timer high = 0; the length counter loads but won't count down while halted
```
Stop it with `LDA #$30 / STA $4000` (constant volume 0) or by clearing bit 0 of $4015.

## 5. Sound effects that play over time [standard]
Keep a small state machine in RAM: an effect pointer and a frame counter. Each NMI (or main-loop frame), step
the effect: write new volume/pitch values for that frame, decrement the counter, stop at the end. Data tables
like `.byte volume, timer_lo, timer_hi` per frame keep it readable. Full music needs a sound engine
(FamiTone2/FamiStudio export, etc.) **[unverified tool names; mention only as next steps]**.

## 6. Other channels in one line each [standard]
- Triangle ($4008-$400B): fixed volume, smooth bass/melody, an octave lower than a pulse at the same timer.
- Noise ($400C-$400F): drums, explosions, hiss; picks from 16 preset periods.
- DMC ($4010-$4013): 1-bit delta samples from ROM ($C000-$FFF0); also the source of the controller-read glitch.
