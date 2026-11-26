# Embeddable Sega Genesis / Mega Drive emulator cores for a native macOS (Swift/AppKit, arm64, no Xcode) teaching app

Research date: 2026-11-18. Repository metadata (license SPDX id, last push, latest GitHub release) was pulled from the public GitHub REST API (`https://api.github.com/repos/<owner>/<repo>` and `/releases`) on this date. Source files were read from GitHub raw URLs. Nothing was downloaded and run. retrodev.com (BlastEm's home page and Mercurial repo) did not respond to WebFetch or curl from this environment, so BlastEm facts come from the libretro GitHub mirror (`libretro/blastem`) plus secondary sources. segaretro.org and emulation.gametechwiki.com blocked fetches (Anubis/403), so claims attributed to them come only from search-result snippets and are flagged.

## 1. Candidates: maintenance, latest release, exact license, accuracy reputation, CPU cost, language, build system

### Takeaway
Only three candidates are realistic C libraries to link into a Swift app: Genesis Plus GX (GPGX), clownmdemu-core and PicoDrive. BlastEm is the accuracy reference, but it is GPLv3 and its 68k core is an x86 JIT, so arm64 support is unclear. ares (ISC, permissive) and jgenesis (GPLv3, Rust) are active but awkward to embed. Exodus (Windows-only, idle since early 2024) and MAME (huge) are not practical. Licensing is the deciding constraint: GPGX and PicoDrive forbid commercial use, clownmdemu is AGPLv3, BlastEm and jgenesis are GPLv3, and only ares is permissive.

### Cited Findings

**Genesis Plus GX (ekeeke/Genesis-Plus-GX; libretro fork libretro/Genesis-Plus-GX)**
- Active. Upstream last push 2026-11-11 (commit message: "[Gamecube/Wii] fixed file loading regression…"), and recent merges (PRs #686/#687, 2026-11-08) harden save-state restore for CD/MegaSD. The libretro fork was last pushed 2026-11-09. GitHub reports neither repo's license as SPDX ("NOASSERTION") and lists no GitHub releases. — [GitHub API: ekeeke/Genesis-Plus-GX](https://api.github.com/repos/ekeeke/Genesis-Plus-GX); [GitHub API: libretro/Genesis-Plus-GX](https://api.github.com/repos/libretro/Genesis-Plus-GX)
- The libretro core reports its library version as "v1.7.4" plus a git hash. — [libretro/Genesis-Plus-GX libretro.c](https://github.com/libretro/Genesis-Plus-GX/blob/master/libretro/libretro.c)
- License: the main GPGX code (Charles MacDonald 1998–2003, Eke-Eke 2007–2026, with portions from Nicola Salmoria and the MAME team) uses a BSD-like license with a non-commercial clause: redistributions "may not be sold, nor may they be used in a commercial product or activity". Modified redistributions must ship complete source. Bundled pieces carry their own licenses: Nuked OPN2 is LGPL-2.1+, Blip Buffer and the NTSC filter (Shay Green) are LGPL-2.1+, Tremor is BSD-style, minimp3 is CC0, and libchdr is BSD/zlib/MIT-style. — [GPGX LICENSE.txt](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/LICENSE.txt)
- The 68k CPU core is a modified Musashi 3.32 (Karl Stenerud). Its header says it "may be freely used for non-commercial purposes" and that other terms must be negotiated with the author. A second non-commercial term therefore applies to the CPU core. — [GPGX core/m68k/m68k.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/m68k/m68k.h)
- The optional CPU-hook debug module (`core/debug/cpuhook.h`, by DrMefistO and feos) uses the same non-commercial clause. — [GPGX core/debug/cpuhook.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/debug/cpuhook.h)
- Language: C. Build: plain Makefiles (`Makefile.libretro` in the libretro fork). Platform ports (GameCube/Wii, libretro, SDL) sit beside the shared `core/` directory. — [GitHub API](https://api.github.com/repos/ekeeke/Genesis-Plus-GX); [libretro.c](https://github.com/libretro/Genesis-Plus-GX/blob/master/libretro/libretro.c)
- Accuracy: its libretro documentation says it aims for complete, accurate emulation, including 68000/Z80, VDP timing and sound-chip synchronisation (search summary). A January 2022 community test showed GPGX drawing "squares instead of rain" at the start of the Titan *Overdrive 2* demo, while BlastEm played it normally. — [libretro forum: Genesis demos vs emulation](https://forums.libretro.com/t/genesis-demos-vs-emulation-is-this-a-good-way-to-measure-accuracy/43392)
- A search snippet from the gametechwiki says GPGX has higher game compatibility than BlastEm. — [Emulation General Wiki (via search snippet)](https://emulation.gametechwiki.com/index.php/BlastEm)

**clownmdemu (Clownacy/clownmdemu-core, plus clownmdemu-frontend and clownmdemu-libretro)**
- License: AGPL-3.0 (GitHub SPDX) for both core and frontend. The README says AGPLv3 "or any later version". The core moved from GPLv3 to AGPLv3 in a commit dated 2022-05-21 ("Relicense from GPLv3 to AGPLv3", citing game streaming). An earlier commit (2021-09-28) had added GPLv3+. — [GitHub API: clownmdemu-core](https://api.github.com/repos/Clownacy/clownmdemu-core); [LICENCE.txt history](https://github.com/Clownacy/clownmdemu-core/commits/master/LICENCE.txt); [README](https://github.com/Clownacy/clownmdemu-core)
- Active. Core last pushed 2026-11-09. The frontend's latest release is v1.6.12 (2026-09-17), after v1.6.11 (2026-05-10). The core has only one old tag (v0.1, 2022-06-23), because releases are cut on the frontend. — [GitHub API: core](https://api.github.com/repos/Clownacy/clownmdemu-core); [GitHub API: frontend releases](https://api.github.com/repos/Clownacy/clownmdemu-frontend/releases)
- Language: C. The code targets C89 and is meant to also compile as C++. Build: CMake with git submodules (clown68000, clownz80, clowncommon). The README says the build is simple enough to port to another system. The repo root also has a `unity.c` (single-translation-unit build). — [README](https://github.com/Clownacy/clownmdemu-core); [repo tree](https://github.com/Clownacy/clownmdemu-core)
- Design: library first. Platform logic lives in separate frontends. Global state is banned and the state struct holds no pointers, which the README ties to simple, fast save states. FM and PSG audio come out separately at native rates. Video arrives one scanline at a time as palette indices. — [README](https://github.com/Clownacy/clownmdemu-core)
- Accuracy: the README describes it as balancing correctness against performance, sitting more high-level than accuracy-focused emulators. Some features are still unemulated (see `TODO.md`). Supports Mega CD (source files `cdc.c`, `cdda.c`, `pcm.c`, `bus-sub-m68k.c`). — [README](https://github.com/Clownacy/clownmdemu-core); [repo tree](https://github.com/Clownacy/clownmdemu-core)
- The author's write-up covers real-hardware details the core models, such as how a real VDP handles byte writes (current address XOR 1) and how the 68000 copies a byte to both halves of the data bus on byte writes. — [MDDC board: ClownMDEmu thread](https://board.mddc.dev/threads/clownmdemu-the-greatest-mega-drive-emulator-ever-someday.71/) (via search summary)

**BlastEm (Michael Pavone; Mercurial at retrodev.com; GitHub mirror libretro/blastem)**
- License: GPLv3 or later (README "License" section; COPYING is the GPLv3 text). GitHub SPDX for the mirror is GPL-3.0. — [libretro/blastem README](https://github.com/libretro/blastem/blob/master/README); [COPYING](https://github.com/libretro/blastem/blob/master/COPYING)
- Releases: the last stable release is 0.6.2. MajorGeeks says the last stable release dates to 2019 and that nightlies continue (listing "0.6.3-pre-5c911effb5b4"). A June 2025 news post covers a "0.6.3 prev" nightly (28/06/2025). The libretro mirror was last pushed 2026-11-08, with Emscripten/CI work for the libretro core. The mirror's CHANGELOG still tops out at 0.6.2. — [MajorGeeks](https://www.majorgeeks.com/files/details/blastem.html); [t2e.pl](https://www.t2e.pl/News/bety-i-svny.406/sega-blastem-prev-0.6.3-28062025.24769); [libretro/blastem CHANGELOG](https://github.com/libretro/blastem/blob/master/CHANGELOG); [GitHub API: libretro/blastem](https://api.github.com/repos/libretro/blastem)
- Upstream commit logs show debugger work (Dec 2023 "save" command, Jan 2024 BASIC string support in the debugger language) and a "new 68K core" effort in 2024. — [retrodev shortlog (2024)](https://www.retrodev.com/repos/blastem/shortlog/0e9d7ef03983) (via search summary)
- Language: C, with code generated from CPU description files (`m68k.cpu`, `z80.cpu`, `cpu_dsl.py`). Build: GNU Make. — [libretro/blastem tree](https://github.com/libretro/blastem)
- Architecture: by default the 68k and Z80 are x86/x86-64 dynamic recompilers (`m68k_core_x86.o`, `z80_to_x86.o`). A `NEW_CORE` make option swaps in generated interpreter cores (`m68k.o`, `z80.o`). The mirror's Makefile still ends with `$(error $(CPU) is not a supported architecture)` unless CPU is x86_64 or i686, so arm64 needs Makefile changes or a different makefile. — [libretro/blastem Makefile](https://github.com/libretro/blastem/blob/master/Makefile)
- Conflicting evidence on Apple Silicon: Kodi's add-on mirror has a `game.libretro.blastem+osx-arm64` package, and RoaringApps says the macOS version is a universal binary that runs natively on Apple Silicon. — [Kodi mirror (MIT)](https://mirrors.mit.edu/kodi/addons/piers/game.libretro.blastem+osx-arm64); [RoaringApps](https://roaringapps.com/app/blastem)
- Accuracy: BlastEm is reported to pass all of Nemesis's VDP FIFO Testing ROM tests. It is also reported to be the only emulator other than Exodus that shows direct-colour DMA demos correctly (wiki claim, essentially self-reported). It played *Overdrive 2* fully in the Jan 2022 community test. The README credits Nemesis's sprite-overflow and VDP FIFO test ROMs. — [Emulation General Wiki (via search snippet)](https://emulation.gametechwiki.com/index.php/BlastEm); [libretro forum](https://forums.libretro.com/t/genesis-demos-vs-emulation-is-this-a-good-way-to-measure-accuracy/43392); [README](https://github.com/libretro/blastem/blob/master/README)
- BlastEm, BizHawk, Exodus, GPGX, higan and Mednafen pass flamewing's 68k BCD verifier test. — [flamewing/68k-bcd-verifier](https://github.com/flamewing/68k-bcd-verifier)

**PicoDrive (notaz/picodrive; active fork irixxxx/picodrive)**
- Upstream notaz is mostly idle: last release v1.93 (2019-01-25), last push 2026-04-14. Active development is in irixxxx/picodrive: latest release v2.05 (2025-05-31), last push 2026-11-17. — [GitHub API: notaz](https://api.github.com/repos/notaz/picodrive); [GitHub API: irixxxx](https://api.github.com/repos/irixxxx/picodrive)
- License: one MAME-style non-commercial license ("may not be sold, nor may they be used in a commercial product or activity"). Modified redistributions must include full source. The COPYING file doesn't separately list licenses for its CPU cores (Cyclone, FAME, DrZ80, CZ80). — [PicoDrive COPYING](https://github.com/notaz/picodrive/blob/master/COPYING)
- Accuracy: built for speed on weak (ARM) hardware. In the Jan 2022 test it lost sound at the end of *Overdrive 2*. — [libretro forum](https://forums.libretro.com/t/genesis-demos-vs-emulation-is-this-a-good-way-to-measure-accuracy/43392)

**ares (ares-emulator/ares)**
- Active. Last push 2026-11-18. Latest stable GitHub release v148 (2026-05-30). Language C++ (uses nall, libco, hiro, ruby). Build: CMake (CMakeLists.txt, CMakePresets.json). Nightlies exist for Windows and macOS. — [GitHub API](https://api.github.com/repos/ares-emulator/ares); [ares README](https://github.com/ares-emulator/ares)
- License: the main ares code is ISC ("Copyright (c) 2004-2025 ares team, Near et al"). The LICENSE file adds sections for third-party code, such as MAME-derived ROM decryption and arcade data under BSD-3-Clause. GitHub reports NOASSERTION because the file contains several licenses. — [ares LICENSE](https://github.com/ares-emulator/ares/blob/master/LICENSE)

**jgenesis (jsgroth/jgenesis)**
- Active. Last push 2026-11-16, latest release v0.14.1 (2026-08-22). GPL-3.0 (one frontend fork directory is MIT/Apache-2.0). Written in Rust. Covers Genesis, Sega CD, 32X, SMS/GG, NES, SNES, GB/GBC, GBA and PC Engine. Officially supports Linux, Windows and web (WASM). macOS is not officially supported. The README says nothing about a C API or a libretro core. — [GitHub API](https://api.github.com/repos/jsgroth/jgenesis); [jgenesis README](https://github.com/jsgroth/jgenesis)

**Exodus (RogerSanders/Exodus)**
- C++, Windows-only. GitHub SPDX is MIT. Last push 2024-02-16 and no GitHub releases, so effectively dormant. Described as cycle-accurate with high system requirements and lower game compatibility than BlastEm (wiki claim). — [GitHub API](https://api.github.com/repos/RogerSanders/Exodus); [Emulation General Wiki (via search snippet)](https://emulation.gametechwiki.com/index.php/BlastEm)

**MAME (mamedev/mame)**
- Very active. Last push 2026-11-19 UTC, latest GitHub release mame0289 (2026-07-30). C++. GitHub SPDX NOASSERTION (mixed licenses). — [GitHub API](https://api.github.com/repos/mamedev/mame)

### Inferences
- **CPU cost:** no benchmark figures were found. My understanding from the projects' design goals: PicoDrive is cheapest, GPGX and clownmdemu are cheap enough for any Apple Silicon Mac, BlastEm on its generated interpreter (`NEW_CORE`, needed off x86) is likely slower than its JIT but probably still fine on M-series chips, and Exodus is heavy. For a preview pane running one 320×224 ROM, all candidate C cores should be negligible on Apple Silicon. This is unmeasured.
- **The non-commercial clauses in GPGX and PicoDrive** (and Musashi's own term) are not OSI open-source licenses. They are also widely considered GPL-incompatible, so GPGX cannot be linked into a GPL app, and it cannot ship in a paid app or a "commercial activity" (arguably including a paid course).
- **ares** is the only accurate, permissively licensed option. However, it is a full multi-system C++ framework (nall/hiro/ruby) with no stable library API, so embedding one core means substantial extraction work.
- **jgenesis** would need a Rust `cdylib` with a hand-written C ABI shim, and it is GPLv3, so it offers nothing over clownmdemu for a Swift host.

### Gaps
- I could not reach retrodev.com, so BlastEm's official release page, current nightly version and official arm64 status were not verified first-hand. The x86-only Makefile in the mirror contradicts the Kodi osx-arm64 package and the RoaringApps "universal binary" claim.
- I found no current (2025–2026) side-by-side test-ROM table (VDP FIFO, DMA timing, *Overdrive 2*) covering clownmdemu, jgenesis or ares. The most recent comparison found is the Jan 2022 libretro forum thread. segaretro's comparison page was blocked.
- No CPU-usage benchmarks were found for any core.
- I didn't verify exact license text for MAME, or per-file licenses of PicoDrive's CPU cores.
- ares's Mega Drive debugging tools (tracer, memory/graphics viewers) and jgenesis's debug views were not confirmed from primary sources in this session.

## 2. Embedding in a Swift app: libretro vs direct C API, ROM from memory, fast reset, frame stepping, save states, headless

### Takeaway
Two practical routes. (a) Build a libretro core as a dylib or static lib and drive the standard `retro_*` functions from Swift. This is uniform, but it gives you only the frame buffer, audio, input and a couple of RAM blocks. (b) Link the core's C sources directly through a bridging header. GPGX (global arrays) and clownmdemu (one plain struct) both allow this and expose everything a teaching debugger needs. clownmdemu's API is the cleanest for an embedder. GPGX has the richest debug hooks.

### Cited Findings
**Genesis Plus GX via libretro**
- `retro_get_system_info` sets `need_fullpath = true`, `block_extract = false`, and extensions `m3u|mdx|md|smd|gen|bin|cue|iso|chd|bms|sms|gg|sg|68k|sgd`. Internally, `load_archive()` copies from an in-memory buffer (`g_rom_data`/`g_rom_size`) when one is set, and otherwise opens the file. — [libretro.c](https://github.com/libretro/Genesis-Plus-GX/blob/master/libretro/libretro.c)
- Pixel format: the core asks for `RETRO_PIXEL_FORMAT_RGB565` when built with `FRONTEND_SUPPORTS_RGB565`, and otherwise falls back to XRGB1555. The framebuffer is `uint16_t[720*576]` with a pitch of 720×2 bytes. — [libretro.c](https://github.com/libretro/Genesis-Plus-GX/blob/master/libretro/libretro.c)
- `retro_reset` calls `gen_reset(0)`. `retro_run` runs one frame (`system_frame_gen`/`_scd`/`_sms`) and then calls the video and audio callbacks. Serialization is supported: a fixed `STATE_SIZE` with `state_save()`/`state_load()`, flagged `RETRO_SERIALIZATION_QUIRK_PLATFORM_DEPENDENT`. — [libretro.c](https://github.com/libretro/Genesis-Plus-GX/blob/master/libretro/libretro.c)

**BlastEm via libretro (`libblastem.c`)**
- `need_fullpath = 0`, so the frontend can pass the ROM as a memory buffer. Pixel format is `RETRO_PIXEL_FORMAT_XRGB8888`. `retro_serialize`/`retro_unserialize` use the system's serialize/deserialize. — [libblastem.c](https://github.com/libretro/blastem/blob/master/libblastem.c)

**clownmdemu direct C API (`source/clownmdemu.h`)**
- Lifecycle: `ClownMDEmu_Constant_Initialise()`, then `ClownMDEmu_Initialise(emu, &config, &callbacks)`. `ClownMDEmu_SetCartridge(emu, const cc_u16l *buffer, length)` loads the ROM straight from memory as 16-bit words. `ClownMDEmu_HardReset`/`ClownMDEmu_SoftReset` reset the machine. `ClownMDEmu_Iterate(emu)` runs one frame. `ClownMDEmu_SaveState`/`ClownMDEmu_LoadState` work with a `ClownMDEmu_StateBackup`. `ClownMDEmu_SetLogCallback` hooks log output. — [clownmdemu.h](https://github.com/Clownacy/clownmdemu-core/blob/master/source/clownmdemu.h)
- Callbacks struct: `colour_updated(index, colour)`, `scanline_rendered` (indexed pixels per line), `input_requested(player, button)`, and separate `fm_/psg_/pcm_/cdda_audio_to_be_generated` pull-style audio callbacks. It also has save-file callbacks and an optional `sound_chip_written` (chip, address, data, cycle) that is useful for VGM-style logging. All callbacks receive a `user_data` pointer. — [clownmdemu.h](https://github.com/Clownacy/clownmdemu-core/blob/master/source/clownmdemu.h)
- A clownmdemu-libretro frontend also exists for RetroArch. — [README](https://github.com/Clownacy/clownmdemu-core)

**PicoDrive via libretro**
- `need_fullpath = true`, RGB565 pixel format, and it calls `RETRO_ENVIRONMENT_SET_MEMORY_MAPS`. — [irixxxx/picodrive platform/libretro/libretro.c](https://github.com/irixxxx/picodrive/blob/master/platform/libretro/libretro.c)

### Inferences
- **Swift hosting via libretro:** build the core as a `.dylib` (or static `.a`), `dlopen`/`dlsym` the `retro_*` symbols, or declare them in a bridging header compiled by `swiftc -import-objc-header`. Pass `@convention(c)` closures for `retro_set_video_refresh`, `retro_set_audio_sample_batch`, `retro_set_input_state`/`input_poll` and `retro_set_environment`. Convert RGB565/XRGB8888 frames to a `CGImage` or `MTLTexture` and feed audio to `AVAudioEngine`/`AudioQueue`. For a rebuilt ROM: `retro_unload_game` then `retro_load_game`, or for GPGX write the ROM to a temp file since `need_fullpath` is true. One `retro_run` call steps one frame. `retro_serialize` takes a snapshot. Headless use just means ignoring the video callback.
- **Swift hosting clownmdemu directly:** compile `unity.c` (or the CMake target) with clang into a static lib. The struct-only state means instant snapshots by plain `memcpy` (and multiple instances are possible, since there is no global state). The host builds RGB pixels from `scanline_rendered` (indices) plus `colour_updated` (CRAM to RGB), so the host fully controls the palette-to-RGB conversion. The cartridge buffer is `cc_u16l` words, so the host must convert the big-endian ROM bytes into 16-bit words. My reading of the API is that the bytes must be swapped into host order on arm64; check this in the frontend source.
- **GPGX direct linking** (skipping libretro) gives the same functions libretro.c calls (`load_rom`/`load_archive`, `system_init`, `system_frame_gen`, `gen_reset`, `state_save`/`state_load`) plus direct access to VDP globals. Its global state means one emulator instance per process.
- **macOS arm64 build sketches (unverified, no Xcode needed; all should work with Command Line Tools clang):**
  - clownmdemu: `git clone --recursive https://github.com/Clownacy/clownmdemu-core`, then either `cmake -B build -DCMAKE_OSX_ARCHITECTURES=arm64 && cmake --build build`, or `clang -O2 -c unity.c && ar rcs libclownmdemu.a unity.o`.
  - GPGX libretro: `make -f Makefile.libretro platform=osx` (libretro makefiles usually detect arm64 from `uname -m`). Direct linking means compiling `core/**/*.c` with the same defines Makefile.libretro uses (e.g. `LSB_FIRST`, a rendering-depth define, and `HOOK_CPU` for debugging). The exact define list should be copied from Makefile.libretro.
  - BlastEm: on arm64 the mirror's Makefile needs `NEW_CORE=1` plus a patch to its architecture check (see section 1).

### Gaps
- I didn't confirm whether GPGX's libretro build requests XRGB8888 when available, beyond the RGB565/XRGB1555 path seen.
- I didn't verify the exact Makefile.libretro invocation and defines for macOS arm64 in GPGX, or the byte order clownmdemu expects in `SetCartridge`.
- I didn't check whether clownmdemu has an instruction-level step or a per-instruction hook. The 68k interface found is `Clown68000_DoCycles(state, callbacks, cycles)`, which is cycle-batch based.

## 3. Debug introspection: 68k registers, memory, VRAM/CRAM/VSRAM, VDP registers, sprite table, breakpoints/single-step

### Takeaway
The libretro memory interface is too thin for a teaching debugger: GPGX and BlastEm expose only work RAM and SRAM, with no VRAM/CRAM. PicoDrive does expose `RETRO_MEMORY_VIDEO_RAM`. Linking directly fixes this. GPGX exposes `vram[]`, `cram[]`, `vsram[]`, `reg[]` and `sat[]` as globals, plus a compile-time `HOOK_CPU` system with execute/read/write hooks on the 68k and on VRAM/CRAM/VSRAM, which is ideal for breakpoints and watchpoints. clownmdemu exposes everything as plain struct fields but has no hook or breakpoint API in the core. BlastEm has the most complete built-in debugger (CLI plus a GDB remote stub), but it lives in the app, not in a library API.

### Cited Findings
- **GPGX libretro:** `retro_get_memory_data`/`_size` handle only `RETRO_MEMORY_SAVE_RAM` and `RETRO_MEMORY_SYSTEM_RAM` (68k `work_ram`, 0x10000 bytes on MD). There is no `RETRO_MEMORY_VIDEO_RAM` case. `SET_MEMORY_MAPS` descriptors (68KRAM at 0xFF0000, PRG-RAM, Word-RAM) are only registered in Mega CD mode. — [libretro.c](https://github.com/libretro/Genesis-Plus-GX/blob/master/libretro/libretro.c)
- **GPGX core:** `vdp_ctrl.h` declares `extern uint8 reg[0x20]; sat[0x400]; vram[0x10000]; cram[0x80]; vsram[0x80];` and `uint16 satb` (sprite table base). — [vdp_ctrl.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.h)
- **GPGX `HOOK_CPU`** (enabled by defining `HOOK_CPU` at build time) defines hook types `HOOK_M68K_E` (execute), `HOOK_M68K_R`/`_W`, `HOOK_VRAM_R`/`_W`, `HOOK_CRAM_R`/`_W` and `HOOK_VSRAM_R`/`_W` (and more). `m68k.h` includes `cpuhook.h` under `#ifdef HOOK_CPU`. — [cpuhook.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/debug/cpuhook.h); [m68k.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/m68k/m68k.h)
- **clownmdemu:** `ClownMDEmu_State` holds `m68k.ram[0x8000]` (16-bit words), Z80 `ram[0x2000]`, external RAM, the current scanline, DMA-freeze flags, and more. The `VDP` state has `vram[0x10000]`, `cram[64]` (palette lines × length), `vsram[64]`, a sprite-table cache, `sprite_table_address`, DMA mode and access state. `VDP_GetCachedSprite()` and `VDP_ReadVRAMWord()` helpers exist. `Clown68000_State` exposes `data_registers[8]`, `address_registers[8]`, `program_counter` and `status_register`. — [clownmdemu.h](https://github.com/Clownacy/clownmdemu-core/blob/master/source/clownmdemu.h); [vdp.h](https://github.com/Clownacy/clownmdemu-core/blob/master/source/vdp.h); [clown68000.h](https://github.com/Clownacy/clown68000/blob/master/source/interpreter/clown68000.h)
- **clownmdemu `VDP_WriteControl`** takes a `VDP_KDebugCallback`, which is a hook for the "KDebug" debug-message channel. The standalone frontend (not the core) has "a variety of debugging menus". — [vdp.h](https://github.com/Clownacy/clownmdemu-core/blob/master/source/vdp.h); [README](https://github.com/Clownacy/clownmdemu-core)
- **BlastEm built-in debugger:**
  - 68k: breakpoints (`b`, `d`), command lists on break (`co`), advance-to/step/step-over (`a`, `n`, `o`, `s`), continue, backtrace (`bt`), print register or memory (`p`, `di`), VDP sprite list (`vs`) and VDP register dump (`vr`).
  - Z80: breakpoints and stepping.
  - The `-d` flag starts in the debugger.
  - GDB remote stub: `target remote | blastem ROM.bin -D` from an m68k-elf gdb, or a socket on port 1234 on Windows. Trace points and watch points are not supported.
  - VDP debug windows: plane, VRAM, CRAM and compositing.
  - A `ram_init = random` option helps catch uninitialised-RAM bugs.
  - Sources: [BlastEm README](https://github.com/libretro/blastem/blob/master/README)
- **BlastEm libretro wrapper:** only `RETRO_MEMORY_SYSTEM_RAM` (Genesis `work_ram`, `RAM_WORDS * sizeof(uint16_t)`) and `RETRO_MEMORY_SAVE_RAM`. No VRAM. — [libblastem.c](https://github.com/libretro/blastem/blob/master/libblastem.c)
- **PicoDrive libretro:** handles `RETRO_MEMORY_SAVE_RAM`, `RETRO_MEMORY_SYSTEM_RAM` and `RETRO_MEMORY_VIDEO_RAM`, and registers memory maps. — [irixxxx/picodrive libretro.c](https://github.com/irixxxx/picodrive/blob/master/platform/libretro/libretro.c)

### Inferences
- **Word byte order:** both GPGX and clownmdemu (and BlastEm's `work_ram`) store 68k RAM as 16-bit words in host order or with an XOR-1 byte trick. A Swift memory viewer must therefore present bytes in 68k big-endian order by swapping or XOR-ing addresses. This needs checking per core.
- **What a teaching debugger can be built from each core:**
  - GPGX + `HOOK_CPU`: PC breakpoints (execute hook), memory watchpoints, "who wrote this VRAM tile / CRAM entry" (VRAM/CRAM write hooks), and single-step by pausing inside the execute hook. VRAM/CRAM/VSRAM/SAT viewers come from the globals. 68k registers come from Musashi (`m68k_get_reg`-style accessors).
  - clownmdemu: viewers are trivial (struct fields). Breakpoints would need either running `Clown68000_DoCycles` in small slices and checking `program_counter`, or patching the core. That is coarse unless a per-instruction hook is added (AGPL-licensed changes).
- **BlastEm as an external process** speaking the GDB remote protocol (pipe or socket) gives full breakpoints and stepping without linking GPL code into the app. It also matches how real homebrew developers debug with m68k-elf-gdb.

### Gaps
- I didn't read the full `cpuhook.h` API (callback signature, how to register) or Musashi's register accessors in GPGX. Only the hook-type enum was confirmed.
- I didn't verify the exact KDebug semantics in clownmdemu, or how its frontend implements its debugging menus (and whether it has breakpoints).
- I didn't confirm which memory PicoDrive's `RETRO_MEMORY_VIDEO_RAM` returns (presumably VDP VRAM).

## 4. Accuracy issues that matter to homebrew developers, and which emulator is strictest

### Takeaway
Common traps where emulators are more forgiving than hardware:
- TMSS lockout if "SEGA" isn't written to $A14000.
- 68k address errors on word/long access at odd addresses.
- VDP byte writes and odd-address quirks.
- DMA/fill edge cases (fill to an odd address, the source low bit ignored).
- VDP FIFO/DMA timing.
- Uninitialised RAM.

BlastEm is the strictest practical choice. It passes Nemesis's VDP FIFO tests, plays *Overdrive 2* fully, can randomise RAM at power-on, and ships a TMSS ROM source. GPGX is close behind and does emulate 68k address errors.

### Cited Findings
- **TMSS:** on TMSS consoles, if "SEGA" isn't written to the right address in time, the VDP is locked. Some emulators skip or mis-implement this, so homebrew can work in emulation and fail on hardware unless it writes the signature to $A14000. BigEvilCorp's "Hello World" shows the standard fix. — [MiSTer forum: TMSS BIOS](https://misterfpga.org/viewtopic.php?t=409); [BigEvilCorp Hello World (pastebin)](https://pastebin.com/FfaVsrFm) (via search summary)
- **Odd addresses:** word and long accesses at odd addresses raise a 68k address error on hardware, while byte accesses are fine. One homebrew demo ran in several emulators but showed "68K Address Error" on an EverDrive. Some emulators skip address-error emulation, so hacks may fail on hardware or in stricter emulators. — [MDDC board: 68K Address Error on EverDrive](https://board.mddc.dev/threads/im-getting-68k-address-error-when-i-try-to-run-my-homebrew-game-in-everdrive.97/); [Sonic Research: hardware/emulator quirks](https://sonicresearch.org/community/index.php?threads/hardware-emulator-quirks.4147/) (via search summary)
- **GPGX address errors:** GPGX's Musashi configuration sets `M68K_EMULATE_ADDRESS_ERROR OPT_ON` (with `M68K_CHECK_PC_ADDRESS_ERROR OPT_OFF`, `M68K_EMULATE_PREFETCH OPT_ON`, `M68K_EMULATE_TRACE OPT_OFF`). GPGX therefore traps odd data accesses but not odd-PC fetches. — [GPGX m68kconf.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/m68k/m68kconf.h)
- **VDP byte writes:** a real VDP writes each byte of a byte write to the current address XOR 1, and the 68000 copies the byte to both halves of the bus. This is the kind of detail simpler emulators get wrong. — [MDDC board: ClownMDEmu thread](https://board.mddc.dev/threads/clownmdemu-the-greatest-mega-drive-emulator-ever-someday.71/) (via search summary)
- Kabuto's hardware notes say writes to odd VDP addresses appear to have no effect. — [Plutiedev: Kabuto hardware notes](https://plutiedev.com/mirror/kabuto-hardware-notes) (via search summary)
- **DMA and fill:** a VRAM fill to an odd destination makes a spurious write to the preceding address, DMA ignores the low bit of the source address, and CRAM/VSRAM fill behaviour may differ between emulators. — [flamewing DMA macros gist](https://gist.github.com/flamewing/ac4b8586f74c74fe24fe30e5e0261fb0) (via search summary)
- **BlastEm** passes all of Nemesis's VDP FIFO Testing ROM tests (wiki claim). It credits Nemesis's sprite-overflow and FIFO test ROMs, played *Overdrive 2* fully in Jan 2022, offers `ram_init = random` "for developers that want to debug initialization issues", and its repo contains `tmss.s68`. — [Emulation General Wiki (via search snippet)](https://emulation.gametechwiki.com/index.php/BlastEm); [libretro forum](https://forums.libretro.com/t/genesis-demos-vs-emulation-is-this-a-good-way-to-measure-accuracy/43392); [BlastEm README](https://github.com/libretro/blastem/blob/master/README); [libretro/blastem tree](https://github.com/libretro/blastem)
- Forum commenters caution that some emulator authors tune for specific test ROMs without improving general compatibility, so demo results are not a full accuracy measure. — [libretro forum](https://forums.libretro.com/t/genesis-demos-vs-emulation-is-this-a-good-way-to-measure-accuracy/43392)

### Inferences
- **Lint checks for a teaching app:** many of these traps can be caught statically or with emulator hooks, independent of the core's strictness:
  - warn if the ROM never writes to $A14000;
  - warn on word/long access to odd addresses (a GPGX read/write hook, or the address-error exception);
  - flag VDP accesses that use byte writes;
  - flag reads of RAM never written (with random RAM init);
  - flag VRAM writes outside VBlank/DMA windows.
  GPGX's VRAM/CRAM write hooks make several of these straightforward.
- **Strictness ranking (subjective, for the learner's "will it work on hardware" check):** Exodus and BlastEm first (Exodus is impractical: Windows-only and dormant), then GPGX, then clownmdemu (self-described as higher-level), then PicoDrive.

### Gaps
- I found no source confirming whether BlastEm enforces TMSS lockout by default, or how its `tmss.s68` is used (config `system` model). I also didn't confirm whether BlastEm emulates 68k address errors.
- I found no published TMSS or address-error behaviour for clownmdemu or PicoDrive.
- There is no recent, primary, per-emulator result table for Nemesis's VDP FIFO/DMA test ROMs.

## 5. Recommendation: one core for the preview pane, plus an optional stricter "hardware check"

### Takeaway
- **Preview pane:** if the app will be free and non-commercial, use **Genesis Plus GX**, linked directly as C sources with `HOOK_CPU` (not only through libretro). It is the most accurate *and* most compatible C core that builds easily on arm64. It is actively maintained (commits in Nov 2026), already emulates 68k address errors, and offers built-in execute/read/write and VRAM/CRAM/VSRAM hooks plus globals for every VDP RAM. If the app might ever be sold or used commercially, GPGX (and PicoDrive) are ruled out. Use **clownmdemu-core** instead, accepting that the whole app must be AGPLv3, or extract **ares** (ISC) with much more effort.
- **"Hardware check":** run **BlastEm** as a separate process, either headless or driven over its GDB remote stub (`blastem rom.bin -D`). It has the best VDP timing accuracy, a random RAM-init option and a full debugger. Keeping it out-of-process avoids linking GPLv3 code. Its arm64 build status needs checking first (x86 JIT by default; `NEW_CORE` interpreter otherwise).

### Cited Findings
- GPGX: active (pushed 2026-11-11), C, libretro v1.7.4, non-commercial license including the Musashi CPU core. `HOOK_CPU` covers 68k execute/read/write and VRAM/CRAM/VSRAM. VDP RAM and registers are globals. Address errors are emulated. — [GitHub API](https://api.github.com/repos/ekeeke/Genesis-Plus-GX); [LICENSE.txt](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/LICENSE.txt); [m68k.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/m68k/m68k.h); [cpuhook.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/debug/cpuhook.h); [vdp_ctrl.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/vdp_ctrl.h); [m68kconf.h](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/core/m68k/m68kconf.h)
- clownmdemu: AGPLv3+, library-first C89, no globals, ROM from memory, one-call frame stepping and save/load state, full state visible in structs. It is self-described as less accuracy-focused. — [README](https://github.com/Clownacy/clownmdemu-core); [clownmdemu.h](https://github.com/Clownacy/clownmdemu-core/blob/master/source/clownmdemu.h)
- BlastEm: GPLv3+, VDP FIFO tests pass (wiki), full CLI debugger plus GDB stub, VDP debug windows, x86 JIT by default with a `NEW_CORE` interpreter option. — [README](https://github.com/libretro/blastem/blob/master/README); [Makefile](https://github.com/libretro/blastem/blob/master/Makefile); [Emulation General Wiki (via search snippet)](https://emulation.gametechwiki.com/index.php/BlastEm)
- ares: ISC (permissive), C++/CMake, v148 (2026-05-30). — [LICENSE](https://github.com/ares-emulator/ares/blob/master/LICENSE); [GitHub API](https://api.github.com/repos/ares-emulator/ares)

### Inferences
- **Decision matrix by license intent:**
  - Free/non-commercial and closed or open source: GPGX (preview) + BlastEm out-of-process (check).
  - Open source under AGPL/GPL: clownmdemu (preview; cleanest API, no globals, easy unit testing) + BlastEm (check). GPGX is likely GPL-incompatible.
  - Commercial/closed: ares (ISC) is the only accurate permissive choice. Otherwise, ship no emulator and launch a user-installed one externally.
- **Ease of the Swift integration:** clownmdemu ≥ GPGX direct > libretro route (any core) > ares > jgenesis. Debug-hook richness: GPGX (`HOOK_CPU`) > BlastEm (out-of-process GDB) > clownmdemu (state readable, no hooks) > libretro-only.
- **Reset after each rebuild:** with GPGX direct, reload the ROM buffer and call `gen_reset(1)`/`system_init`. With clownmdemu, call `SetCartridge` then `HardReset`. Both are microseconds to milliseconds, which suits an edit-assemble-run loop.

### Gaps
- I didn't confirm whether the teaching app is intended to be commercial. That decides between GPGX and clownmdemu.
- I didn't verify BlastEm arm64 buildability first-hand (retrodev.com unreachable; evidence conflicts).
- No hands-on build was attempted (per constraints), so all build commands above are unverified sketches.
