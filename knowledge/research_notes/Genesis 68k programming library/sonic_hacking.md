# Sonic the Hedgehog (Genesis) disassemblies and ROM hacking: structure, engine, tools, workflow, guide quality

> Research note, 2026-11-18. **Source access caveat:** info.sonicretro.org (the Sonic Retro wiki and the SCHG), segaretro.org and web.archive.org could not be read directly. The first two returned an "Anubis" bot-protection "Access Denied" page, and web.archive.org was refused by the fetch tool. Claims attributed to Sonic Retro wiki pages below come from **search-result snippets only**, and are marked "(snippet)". Primary evidence comes from the GitHub repositories themselves (READMEs, source files, build scripts), Clownacy's 2025 tooling guide, the S.C.E. README, the MDDC board, and the s3unlocked blog. Line-level claims about source code were read from the files as of mid-November 2026.

## 1. Repositories, assemblers, build scripts, macOS builds, bit-perfect vs modified, Git vs legacy (Hivebrain/Xenowhirl) disassemblies

### Takeaway
The three main "Git" disassemblies (sonicretro/s1disasm, s2disasm, skdisasm) are actively maintained on GitHub. They build with The Macro Assembler AS through `build.bat` (Windows) or `build.lua` (everywhere else, needs Lua 5.3). They ship prebuilt tool folders for Apple Silicon (`Mac-arm`) and Intel Macs, so a native macOS build is supported. Each defaults to a byte-perfect build of the original ROM, and documented flags turn on bug fixes or optimizations. Sonic 1 also keeps an `asm68k` branch, and the frozen 2005-era "legacy" disassemblies (Hivebrain for S1, Xenowhirl for S2) use different labels and toolchains. Many old guides were written against those legacy versions.

### Cited Findings

**Sonic 1: sonicretro/s1disasm**
- The default branch is `AS`, last updated Nov 12, 2026. Other active branches are `asm68k` (updated Oct 25, 2026), `AS-dev` (Oct 15, 2026) and `ProjectSonic1TwoEight` (Oct 15, 2026). — [s1disasm branches](https://github.com/sonicretro/s1disasm/branches)
- The AS branch contains `build.bat`, `build.lua`, `build_and_run.bat`, a `build_tools` folder, `MacroSetup.asm` and `Macros.asm`. The README mostly links to Sonic Retro's "Disassembly Folder Structure" page and states that content is "for informational and educational purposes only". — [s1disasm](https://github.com/sonicretro/s1disasm)
- Build options at the top of `sonic.asm`:
  - `Revision`: 0 builds the original REV00 ROM.
  - `FixBugs`: "enables various bugfixes across the game and sound driver".
  - `CheatsEnabled`
  - `AllOptimizations`
  - `ZeroOffsetOptimization`
  - `PaddingOptimization`: removes about 3 KB of superfluous padding.
  - `UnusedOptimization`: removes dead code and unused data.
  - `EnableSRAM`, `BackupSRAM`, `AddressSRAM`
  - `ZoneCount`: used by a `zonewarning` macro, with the comment "Do not change, unless more zones get added."
  
  — [s1disasm sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/sonic.asm)

**Sonic 2: sonicretro/s2disasm**
- README: "use build.bat if you're a Windows user, or build.lua otherwise. The built ROM will be called 's2built.bin'." Also: "The Lua script requires Lua version 5.3". Earlier Lua versions fail on `//` integer division and the bit-shift operators. — [s2disasm](https://github.com/sonicretro/s2disasm)
- Top-level files: `s2.asm`, `s2.constants.asm`, `s2.macros.asm`, `s2.macrosetup.asm`, `s2.sounddriver.asm`, `sonic2.flex.json` (a Flex 2 project), "SonLVL INI Files", and folders `art`, `collision`, `level`, `mappings`, `sound`, `misc`, `startpos`. — [s2disasm](https://github.com/sonicretro/s2disasm)
- An older fork's README says "use build.bat … or build.sh otherwise", that non-Windows users had to install AS themselves, and that the other tools were compiled from source on first run. The current upstream has replaced this with `build.lua` plus prebuilt tools. — [DrMelon/s2disasm fork](https://github.com/DrMelon/s2disasm); compare [s2disasm](https://github.com/sonicretro/s2disasm)
- Build options at the top of `s2.asm`:
  - `gameRevision`: 0 = REV00, 1 = REV01, 2 = "a (theoretical) REV02 ROM … which contains even more fixes".
  - `padToPowerOfTwo = 1`: "pads the end of the ROM to the next power of two bytes (for real hardware)".
  - `fixBugs = 0`: "enables all bug-fixes". There is also a separate `FixDriverBugs` flag in `s2.sounddriver.asm`.
  - `allOptimizations`, `skipChecksumCheck`, `zeroOffsetOptimization`
  - `removeJmpTos`: "many unnecessary JmpTos are removed, improving performance".
  - `addsubOptimize`
  - `relativeLea`: "use pc-relative addressing, instead of absolute long".
  - `useFullWaterTables`
  
  — [s2disasm s2.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.asm)
- `build.lua` locates the platform tools through a shared `common.find_tools(...)` module. It compresses music with a Saxman compressor, then calls `common.build_rom_and_handle_failure("s2","s2built",...)`, patches the compressed sound-driver size into the ROM, and runs `common.fix_header` to fix the checksum. The `improved_sound_driver_compression` setting defaults to false, and its comment says the default "will use an inferior compression algorithm that results in an accurate ROM being produced". In other words, the default exists to keep the build byte-identical. — [s2disasm build.lua](https://raw.githubusercontent.com/sonicretro/s2disasm/master/build.lua)
- `build_tools` contains these platform folders: `Android-aarch64`, `BSD-x86_64`, `Linux-aarch64`, `Linux-x86`, `Linux-x86_64`, **`Mac-arm`**, **`Mac-x86_64`**, `Windows-x86`, `Windows-x86_64`. It also has `lua`, `source_code`, `AS.txt` and `chkbitperfect.bat/.lua`. — [s2disasm build_tools](https://github.com/sonicretro/s2disasm/tree/master/build_tools)
- The Git Sonic 2 disassembly descends from a release that targets the AS macro assembler (snippet from the Sonic Retro Disassemblies index). — [Sonic Retro: Disassemblies (snippet)](https://info.sonicretro.org/Disassemblies)

**Sonic 3 & Knuckles: sonicretro/skdisasm**
- Build scripts:
  - `buildS3` builds a byte-perfect Sonic 3 ROM.
  - `buildSK` "Builds a byte-perfect copy of the Sonic & Knuckles ROM."
  - `buildS3Complete` builds a combined S3&K ROM.
  - `chkbitperfect` builds both ROMs and compares them with the originals.
  
  The Lua scripts are "cross platform (Windows, Mac, Linux, FreeBSD) but require Lua to be installed" (Lua 5.3). — [skdisasm](https://github.com/sonicretro/skdisasm)
- The `Sonic3_Complete` flag:
  - At 0, the build produces a byte-perfect S&K ROM that depends on an appended Sonic 3 ROM for the Sonic 3 data, which is how lock-on works.
  - At 1, it includes the Sonic 3 data split from the original ROM and makes small code changes to ease modification. The README recommends 1 for heavy modification.
  
  The folders are General, Levels (one per zone), Sound, "Lockon S3", "SonED Projects", "SonLVL INI Files", Split and build_tools. — [skdisasm](https://github.com/sonicretro/skdisasm)
- skdisasm `build_tools` has the same platform set as S2, including `Mac-arm` and `Mac-x86_64`, plus `AS.txt` and `chkbitperfect`. — [skdisasm build_tools](https://github.com/sonicretro/skdisasm/tree/master/build_tools)

**AS assembler on macOS**
- Flamewing's `asl-releases` (a maintained AS fork) lists Mac OS X x86-64 with Ninja/Xcode among its tested environments. Apple Silicon was not listed in the snippet seen. The build is CMake-based. — [flamewing/asl-releases](https://github.com/flamewing/asl-releases)
- S.C.E. uses "Flamewing's modified version" of AS and warns: "Always specify jump sizes for instructions." Without explicit sizes, AS adds extra passes and builds slow down. The README advises keeping builds to two passes. It also notes that running the Windows batch scripts under Wine slows the build. — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-)

**Git vs legacy disassemblies, and label sets**
- Clownacy's 2025 guide distinguishes two lines:
  - The Git disassemblies on GitHub are "actively updated" and support more platforms, including FreeBSD and Raspberry Pi.
  - The legacy Hivebrain/Xenowhirl disassemblies, hosted on Sonic Retro's wiki, are frozen and mostly Windows-only.
  
  The guide warns that **many guides target the legacy disassemblies and that Git disassembly changes often break guides**. — [Clownacy, "So you want to start hacking Sonic (2025)"](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- The June 2005 Hivebrain split disassembly of Sonic 1 is archived on Sonic Retro and targets SNASM68K/asm68k. Sonic Retro guides also refer to a "Git" Sonic 1 disassembly "in ASM68K format". — [Sonic Retro: Set up a Sonic 1 split disassembly (snippet)](https://info.sonicretro.org/SCHG_How-to:Set_up_a_Sonic_1_split_disassembly)
- Hivebrain maintains a separate "Hivebrain 2022" Sonic 1 disassembly. Compared with the Sonic Retro one, it has:
  - "Different labels" for the object status table, plus constants for render and status flags.
  - Different labels for some RAM addresses and routines.
  - Deprecated labels and labels from other games kept in `Includes/Compatibility.asm`.
  - Custom macros: `dma`, `ptr`/`index`, `objpos`, `plcm`, `spritemap`/`piece`.
  - "Automatic recompression of Kosinski and Nemesis-compressed data."
  - A DAC driver that is "compiled, compressed and inserted seamlessly."
  
  — [cvghivebrain/s1disasm](https://github.com/cvghivebrain/s1disasm)
- Concrete label-style difference between the Git disassemblies:
  - S1 Git uses `ob`-prefixed SST field names such as `obRoutine` and `obStatus`, with status-bit constants such as `status_in_air` and `status_rolling`. — [s1disasm 01 Sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/_incObj/01%20Sonic.asm)
  - S2 Git uses bare names such as `routine`, `status`, `x_pos` and `render_flags`. — [s2disasm s2.constants.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.constants.asm)

**Sonic CD**
- A Sonic Retro forum thread from June 2022 is titled "ASM Sonic CD (1993) Disassembly by Devon". Its repository link was not confirmed in this research (snippet). — search result pointing at [Sonic Retro forums](https://forums.sonicretro.org/goto/post?id=1039758)
- A separate project is a *matching decompilation in C* of Sonic CD's PC port lineage (Windows 95 port and Sonic Gems Collection), not the Mega CD 68k original:
  - It claims "99,99% of the decompiled code compiles back to the same assembly."
  - It credits Devon Artmeier's disassembly work using the original Metrowerks CodeWarrior compiler, which revealed DWARF debug info.
  - It is hosted at git.sr.ht/~benoitren/soniccddecompilation.
  
  — [benoitren.be: Sonic CD decompilation](https://benoitren.be/soniccd.html)
- Megadev, a Mega CD development framework, was inspired by Sonic CD and implements its MMD module format. — [drojaazu/megadev](https://github.com/drojaazu/megadev)

### Inferences
- **macOS (Apple Silicon) build recipe**, inferred from the repo layout and READMEs and not tested here:
  1. Install Lua 5.3 or newer, for example with Homebrew.
  2. `git clone` the repo.
  3. Run `lua build.lua`. The shared `common` Lua module should pick `build_tools/Mac-arm`.
  
  Wine is not needed. Lua 5.4 should work because the README only rules out *earlier* versions, but this is unverified. A `git clone` should not trigger Gatekeeper quarantine on the bundled tools, while a browser-downloaded ZIP might. That is general macOS behavior, unverified for these repos.
- Treat "bit-perfect" as a **verification baseline, not a goal for a hack**. The first thing to do after cloning is build with default flags and confirm the output matches the original (`chkbitperfect`). Once code is changed the ROM will not match, and that is fine. The disassembly uses symbolic labels, so code and data can grow and move as long as nothing depends on hard-coded addresses.
- The `fixBugs`/`FixBugs` flags give the tutor a principled alternative to "bug-fix guides". The fixes are documented inline as `if fixBugs` blocks, so the learner can read the original and fixed code side by side.
- AS is now the common denominator for S1, S2 and S3K Git builds. A learner who masters AS syntax and macros (and `asm68k` only if they use the S1 `asm68k` branch or legacy guides) can move between all three games.
- The active `ProjectSonic1TwoEight` branch on s1disasm (see section 4) suggests that 128x128-chunk support for Sonic 1 is being developed upstream rather than only through third-party guides. This is not confirmed in any README.

### Gaps
- Could not read the s1disasm or s2disasm READMEs in full (only fragments rendered) or the `common` Lua module, so the exact OS/arch detection logic and any macOS-specific messages are unverified.
- Could not confirm whether `Mac-arm` contains universal or arm64-native AS binaries. The folder contents were not rendered.
- The Sonic Retro "Disassemblies" index (which lists Sonic CD, prototypes and the 8-bit games) was blocked. Devon's Sonic CD (Mega CD) disassembly repo URL and its build system (likely asm68k) are unverified.
- No first-hand list of exact label renames between the legacy Hivebrain 2005 disassembly and current Git S1 was found. Only the general fact that they differ, plus the `ob*` naming in Git, is sourced.

## 2. Engine architecture: game loop, objects/SST, levels, collision, compression/PLCs, palette cycling, SMPS, mappings/DPLCs, physics

### Takeaway
All three games use a fixed main loop that jumps through a game-mode table, and a fixed array of fixed-size object slots (the "SST"). Each object's code dispatches on a `routine` byte through an offset table. Levels are tiles → 16x16 blocks → chunks (256x256 in S1/CD, 128x128 in S2/S3K) → layout, with per-block collision height arrays and angles. Art and maps are stored with Sega's compression formats: Nemesis is slow and spread across frames by PLC queues, Kosinski/KosM is fast, and Enigma is used for plane maps. Sound is SMPS, on the 68k in S1 and on the Z80 in S2/S3K.

### Cited Findings

**Main loop and game modes**
- S1:
  - The `EntryPoint` code initializes the VDP, Z80 and RAM, then branches to `GameProgram`. `GameProgram` sets `v_gamemode` to `id_Sega`.
  - `MainGameLoop` masks `v_gamemode` with `$1C` and calls `GameModeArray(pc,d0.w)`, a table of `bra.w` entries: `GM_Sega`, `GM_Title`, `GM_Level` (shared by Demo and Level), `GM_Special`, `GM_Continue`, `GM_Ending`, `GM_Credits`.
  - The V-blank interrupt handler is `VBlank`, which dispatches through `VBlank_Index`. `HBlank` does the Labyrinth Zone water palette swap.
  
  — [s1disasm sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/sonic.asm)
- S2:
  - `MainGameLoop` masks `Game_Mode` with `$3C` and `jsr`s into `GameModesArray`. The source comment says the mask can be raised "to a maximum of $7C to add more game modes". This is a documented limit and the intended way to extend it.
  - Modes are SEGA, title, demo, level, special stage, continue, 2P results, 2P level select, ending, options and level select. Options and level select share `MenuScreen`.
  - V-int dispatch uses `Vint_SwitchTbl`, built with `offsetTable` / `offsetTableEntry.w` macros.
  
  — [s2disasm s2.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.asm)
- The S1 level loop calls `ExecuteObjects` ("execute all objects in object RAM"), `BuildSprites` ("build sprite table"), `PaletteCycle` ("run palette cycles") and `ObjPosLoad` ("initialize object manager", the routine that spawns objects from the level's placement list as the camera moves). Each routine lives in its own include (`_inc/ExecuteObjects.asm`, `_inc/BuildSprites.asm`, `_inc/ObjPosLoad.asm`, `_inc/Object Pointers.asm` "includes Obj_Index"). — [s1disasm sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/sonic.asm)

**Object system (SST = sprite/object status table)**
- S2 object slot layout from `s2.constants.asm`:
  - `object_size_bits = 6` → `object_size` = **$40 bytes**.
  - Fields:

    | Field | Offset |
    |---|---|
    | `id` | 0 |
    | `render_flags` | 1 |
    | `art_tile` | 2–3 |
    | `mappings` | 4–7 |
    | `x_pos` (with `x_sub`) | 8 |
    | `y_pos` | $C |
    | `x_vel` | $10 |
    | `y_vel` | $12 |
    | `inertia` (Sonic/Tails) | $14 |
    | `y_radius` | $16 |
    | `x_radius` | $17 |
    | `priority` | $18 |
    | `width_pixels` | $19 |
    | `mapping_frame` | $1A |
    | `anim_frame` | $1B |
    | `anim` | $1C |
    | `prev_anim` | $1D |
    | `anim_frame_duration` | $1E |
    | `collision_flags` | $20 |
    | `collision_property` | $21 |
    | `status` | $22 |
    | `respawn_index` | $23 |
    | `routine` | $24 |
    | `routine_secondary` | $25 |
    | `angle` | $26 ("360 degrees = 256") |
    | `subtype` | $28 |

  - Several fields are aliases, and the field meanings past $28 depend on the object.
  
  — [s2disasm s2.constants.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.constants.asm)
- S2 object RAM:
  - `Reserved_Object_RAM` holds `MainCharacter` (Sonic), `Sidekick` (Tails), title-card pieces and a few free and shared slots. Some labels share slots, so the count is about 14–16.
  - `Dynamic_Object_RAM` is `ds.b $70*object_size` = **112 slots** for level objects. In 2P mode, "6 'blocks' of 12 RAM slots at the end" are reserved.
  - `LevelOnly_Object_RAM` (16 slots) holds shields, invincibility stars, dust and breathing bubbles.
  - The file includes build-time `fatal` checks such as "Special stage objects go past end of object RAM buffer".
  
  — [s2disasm s2.constants.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.constants.asm)
- S1: object RAM starts at **$FFD000** with **$40 bytes per object**. $28 is the subtype, which comes from level placement, and $29–$3F is the object's scratch RAM. — [Data Crystal: Sonic the Hedgehog RAM map (snippet)](https://datacrystal.tcrf.net/wiki/Sonic_the_Hedgehog/RAM_map)
- The S1 and S2 SST formats are "very similar". — [Sonic Retro: SST (snippet)](https://info.sonicretro.org/SST)
- Routine-counter dispatch, using Sonic in S1 as the example:
  - `Sonic_Normal` jumps through `Sonic_Index` using `obRoutine`. The entries are `Sonic_Main` (0, one-time init that advances the routine), `Sonic_Control` (2), `Sonic_Hurt` (4), `Sonic_Death` (6) and `Sonic_ResetLevel` (8). The values step by 2 because they index a table of word offsets.
  - `Sonic_Control` then indexes `Sonic_Modes` using the `status_in_air` and `status_rolling` bits. The modes are `Sonic_MdNormal` (0), `Sonic_MdJump` (2), `Sonic_MdRoll` (4) and `Sonic_MdJump2` (6).
  
  — [s1disasm 01 Sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/_incObj/01%20Sonic.asm)

**Sonic's physics routines (S1)**
- The constants are `son_maxspeed equ $600`, `son_acceleration equ $C` and `son_deceleration equ $80`. These are 8.8 fixed point, so $600 = 6 px/frame. `Sonic_Main` copies them into the RAM variables `v_sonspeedmax`, `v_sonspeedacc` and `v_sonspeeddec`, and water and speed shoes modify those RAM copies. — [s1disasm 01 Sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/_incObj/01%20Sonic.asm)
- Per-frame calls:
  - Ground mode (`Sonic_MdNormal`) calls `Sonic_Jump`, `Sonic_SlopeResistWalk`, `Sonic_Move`, `Sonic_Roll`, `Sonic_LevelBound`, `SpeedToPos`, `Sonic_AnglePos` and `Sonic_SlopeRepel`.
  - Air modes call `Sonic_JumpHeight`, `Sonic_JumpDirection`, `Sonic_LevelBound`, `ObjectFall`, `Sonic_JumpAngle` and `Sonic_Floor`.
  - `Sonic_Control` also calls `Sonic_Display`, `Sonic_RecordPosition`, `Sonic_Water`, `Sonic_Animate`, `ReactToItem` (object touch responses), `Sonic_Loops` and `Sonic_LoadGfx` (the DPLC handler).
  
  — [s1disasm 01 Sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/_incObj/01%20Sonic.asm)
- The fixed-point interpretation and "pixels per frame" framing come from my general knowledge and the Sonic Physics Guide tradition. The guide itself could not be read (see Gaps).

**Level format**
- Chunks:
  - Sonic 1 and Sonic CD use 256x256-pixel chunks (16x16 blocks).
  - Sonic 2 and S3K use 128x128 chunks (8x8 blocks).
  
  — [The Sonic Center: basic breakdown of level design and collision](https://www.soniccenter.org/forum/index.php?topic=4717.0)
- Chunk memory in S1:
  - A chunk is 16x16 blocks × 2 bytes = 512 bytes. With a 1-byte chunk ID the theoretical maximum is $20000 bytes, but the **practical RAM limit for chunks is $A400 bytes**.
  - 128x128 chunks are 128 bytes each, for a hard cap of $8000. That is $2400 bytes less RAM than S1's practical limit.
  - Converting S1 to 128x128 makes layouts 4x larger. Project Two Eight stores them in ROM.
  - Even stock S1's **ending reuses part of this chunk RAM to decompress flower graphics**.
  
  — [MDDC: "A really cool advantage to using Sonic 1: Project Two Eight"](https://board.mddc.dev/threads/a-really-cool-advantage-to-using-sonic-1-project-two-eight.53/)
- This is confirmed in the source: the ending does `KosDec` of `Kos_EndFlowers` into `v_256x256_def+$4A*chunk_size`, with the comment "this overwrites unused chunk RAM". — [s1disasm sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/sonic.asm)
- Level loading in S1: `LevelSizeLoad`, then `LevelDataLoad` ("load block mappings and palettes"), `LevelLayoutLoad` / `LevelLayoutLoad2`, and `LoadTilesFromStart`. — [s1disasm sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/sonic.asm)
- S.C.E. Extended (an S3K-based engine) makes chunk IDs two bytes, so there is "no one-byte limit". It moves each level's chunks, layout, palette and music into a per-level `Pointer.asm`. This shows that the stock games' 1-byte IDs and scattered per-zone tables are real constraints. — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-)

**Collision**
- Collision is defined per 16x16 block. Each block has a "height mask" of 16 height values (0–16) and an angle byte (0–255, looked up in a trig table). Ceilings use the same arrays inverted. Solidity types are top-solid, left/right/bottom-solid and all-solid. — [The Sonic Center](https://www.soniccenter.org/forum/index.php?topic=4717.0); [Sudo Null: overview of Sonic physics, solid tiles](https://sudonull.com/post/91120-An-overview-of-physics-in-Sonic-games-Part-1-solid-tiles)
- In S1, `ColIndexLoad` picks a per-zone collision index (`Col_GHZ`, `Col_LZ`, `Col_MZ`, `Col_SLZ`, `Col_SYZ`, `Col_SBZ`) through `ColPointers`. The ending hard-codes `Col_GHZ`. Floor and wall probes are in an include named "FindNearestTile & FindFloor & FindWall". — [s1disasm sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/sonic.asm)
- The S2 repository has a top-level `collision` folder. — [s2disasm](https://github.com/sonicretro/s2disasm)

**Compression and PLCs**
- Kosinski: LZSS-based, with a modest compression ratio, but "blazingly fast" and usable on any data.
- Nemesis:
  - Made specifically for VDP tile art. It combines entropy coding with nybble run-length encoding.
  - It compresses well and can decompress straight to VRAM, but "the slow speed limits it to just a few tiles per frame".
  - Earlier Sonic games used it for all main level art.
- Enigma: used for plane maps, mainly "background plane mappings for large, static screens" such as menus and the Special Stage.
- Moduled Kosinski (KosM): data split into $1000-byte pieces, each Kosinski-compressed. Each piece can be decompressed to a RAM buffer and DMA'd to VRAM. The article argues that Nemesis's slow decompression "would have made Sonic 3's seamless act transitions impossible".

— [s3unlocked: Mega Drive compression formats](https://s3unlocked.blogspot.com/2017/06/mega-drive-compression-formats.html)
- Nemesis input length must be a multiple of $20 bytes (one 8x8 tile). S1 used Nemesis for all compressed art, and S2 moved level art to Kosinski. In S2, Kosinski covers level graphics, block mappings and layouts. Enigma is also used for S1's 16x16 block mappings. — [Sonic Retro: Nemesis](https://info.sonicretro.org/Nemesis_Format), [Kosinski](https://info.sonicretro.org/Kosinski_Format), [Enigma](https://info.sonicretro.org/Enigma) (all snippets)
- Pattern load cues in S1:
  - `AddPLC` queues art lists. `NewPLC` replaces the queue. `ClearPLC` clears remaining entries.
  - `RunPLC` runs each frame "if any". The title-card loop calls it every V-blank until `v_plc_buffer` is empty, which is how Nemesis decompression is spread over frames.
  - `QuickPLC` runs "immediately (no queue)". `NemDec` is called directly to VRAM for some screens.
  
  — [s1disasm sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/sonic.asm)
- Modern alternatives: S.C.E. uses "Kosinski Plus" and "Kosinski Plus Module" plus an "Ultra DMA Queue" for performance. Clownacy's guide mentions Kosinski+ and Comper support in modern compressors. — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-); [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- `flamewing/mdcomp` ("Assorted compression formats for the Sega Mega Drive") is the reference library behind modern tools. Its README is unfinished ("Detail compression formats" is still a TODO). — [flamewing/mdcomp](https://github.com/flamewing/mdcomp)

**Sprites: tiles, mappings, DPLCs, palettes**
- Sprites are made from tiles, mappings (how tiles form a frame), optional DPLCs (dynamic pattern load cues, which stream only the current frame's tiles into VRAM) and palettes. "Most sprites don't need DPLCs." — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- S1 Sonic calls `Sonic_LoadGfx` every frame, which is the DPLC path for the player sprite. — [s1disasm 01 Sonic.asm](https://raw.githubusercontent.com/sonicretro/s1disasm/AS/_incObj/01%20Sonic.asm)

**SMPS sound**
- SMPS ran in two variants, SMPS 68000 and SMPS Z80. Hidden Palace released the source code for both in 2020. — [Sonic Retro: SMPS (snippet)](https://info.sonicretro.org/SMPS) / [Sega Retro: SMPS (snippet)](https://segaretro.org/SMPS)
- Driver per game:
  - S1 uses a modified **SMPS 68k Type 1**.
  - S2 uses a heavily modified **SMPS Z80**. One forum view describes it as a port of S1's 68k driver to the Z80.
  - S3K uses **SMPS Z80 Type 2**.
  
  — [sonicretro/smps-rips list (snippet, mirror)](https://gh.r-mj.com/sonicretro/smps-rips)
- The Z80 has 8 KB of RAM, which the sound engine and the DAC (sample) driver share. Clownacy's Clone Driver v2 is an "enhanced SMPS 68k Type 1b" driver with a two-channel DAC using Mega PCM. Its author argues that 68k drivers are only ideal for advanced DAC use and suggests a Z80 driver (Flamedriver) if DAC is only drums. — [Sonic 2 Clone Driver v2 wiki, About](https://github.com/Clownacy/Sonic-2-Clone-Driver-v2/wiki/About) (read via a mirror snippet)
- MIDI and MP3 don't work directly. The converters (mid2smps, xm4smps, vgm2smps) need manual cleanup. SMPS2ASM turns songs into `.asm` for porting between drivers and requires AS. Z80-based SMPS limits songs to 0x8000 bytes. Clownacy's advice to beginners: "music editing is far more complicated than it has any right to be." — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- S2's build compresses music with Saxman and errors out if a compressed song would "overflow the decompression buffer". — [s2disasm build.lua](https://raw.githubusercontent.com/sonicretro/s2disasm/master/build.lua)

### Inferences
- **Teaching order.** The SST plus routine-counter pattern is the single most important idea to teach first. Once the learner can read an object's `Index` table and follow `routine` = 0 → init, 2 → main, the rest of the engine reads as "objects plus a few managers" (PLC queue, ObjPosLoad, BuildSprites, PaletteCycle, sound queue). The step of 2 exists because the table holds word offsets; a 4-step table would hold longword pointers.
- **The S1 ending is a good worked example of hidden coupling.** If a hack adds level chunks beyond what the stock game uses, the ending's flower decompression may silently overwrite them, because it writes into "unused" chunk RAM at a fixed offset (`$4A*chunk_size`). This is the kind of non-local dependency that recipe guides tend to miss.
- **SST layout differs by game in places.** Don't assume an S2 or S3K object can be dropped into S1 just because the field names match. Check `routine`/`status`/`subtype` offsets and the mappings format in each disassembly's constants file. S3K uses a larger slot. I believe it is $4A bytes, but this is unverified here. S.C.E. moved to $50 and explicitly removed the slot-size multiplications.
- Nemesis vs KosM is a performance trade-off, not a matter of style. A learner porting S3K-style seamless transitions into S1 needs to change the compression of the relevant art, not just copy the transition code.

### Gaps
- The Sonic Retro SCHG pages, the Sonic Physics Guide and Sega Retro were blocked, so the following were not verified from primary text:
  - Detailed physics values beyond S1's three constants, such as jump force, gravity and air drag.
  - Solidity path (path-swapper) mechanics in S2/S3K.
  - The exact S1 object slot count (I believe $80 slots between $FFD000 and $FFF000, with roughly the first $20 reserved, but this is unconfirmed).
  - S3K's SST size and layout.
  - Exact palette-cycling mechanisms. Only the `PaletteCycle` call site was confirmed.
- KosM queue and PLC mechanics in S3K, and the S2/S3K DPLC and mapping formats (6-byte S2 vs 5-byte S1 mapping pieces is my unverified recollection), were not sourced.
- Sound-driver internals (track headers, coordination flags, 68k↔Z80 bus handling) were not researched beyond the driver type per game.

## 3. Tools: level/sprite editors, compression, emulators/debuggers, documentation

### Takeaway
The modern cross-platform toolset is:
- **Levels:** SonLVL.
- **Sprites:** Flex 2 or ClownMapEd.
- **Plane maps:** SonPLN or Captain PlaneEd.
- **Compression:** mdcomp / FW-KENSC / ClownCompTool.
- **Emulators:** BlastEm (accurate, with a debugger) and ClownMDEmu (strong RAM/VRAM viewers), with Exodus for hardware-accuracy checks.
- **Crash handlers:** Vladikcomper's or Flamewing's in-ROM error handler.

Older Windows-only tools (SonED2, SonMapEd, The Sega Data Compressor) may not work with the Git disassemblies.

### Cited Findings
- Editors and compression tools:
  - SonLVL is cross-platform and "source-available" (not quite open source). SonED2 is older, Windows-only, and "may not work with Git disassemblies".
  - SonMapEd is Windows-only, closed source and incompatible with the Git disassemblies.
  - Flex 2 and ClownMapEd are cross-platform and open source. Flex 2 is often easier for newcomers.
  - For plane maps, Captain PlaneEd is simple but clunky, and SonPLN pairs naturally with SonLVL.
  - Avoid The Sega Data Compressor, which lacks Kosinski+ and Comper. Use FW-KENSC or ClownCompTool (GUI, cross-platform) or the upstream mdcomp command-line tools. The editors handle compression internally.
  
  — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- Emulators:
  - Regen: old and light, with CPU breakpoints.
  - Exodus: highly accurate but heavy, useful for hardware quirks.
  - ClownMDEmu: strong visual debugging of RAM and VRAM and partial Mega CD support, but no CPU breakpoints. Timing is its weakest area.
  - BlastEm: accurate, lighter than Exodus, with a basic interface.
  
  — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- BlastEm has an integrated command-line debugger loosely based on GDB's and can act as a GDB remote target. — [libretro/blastem](https://github.com/libretro/blastem)
- ClownMDEmu "features a suite of debugging tools aimed at homebrew and ROM-hack development". — [Clownacy: Projects](https://clownacy.wordpress.com/projects/)
- In-ROM debuggers and error handlers: Flamewing's is simpler and shows only raw addresses. Vladikcomper's shows label names and supports logging in Gens KMod, BlastEm and ClownMDEmu, but is harder to install. — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- S.C.E. Extended recommends:
  - Sprites: Flex 2, ClownMapEd or SonMapEd.
  - Levels: official SonLVL or SonLVL-64x64-Compatible ("SonED2 is no longer supported").
  - Music: smps2asm.
  - Debugging emulators: BizHawk, BlastEm, ClownMDEmu, Exodus, Gens KMod, Gens r57shell Mod and Regen.
  
  — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-)
- The S2 Git repo ships a Flex 2 project (`sonic2.flex.json`) and SonLVL INI files. skdisasm ships "SonLVL INI Files" and "SonED Projects". — [s2disasm](https://github.com/sonicretro/s2disasm); [skdisasm](https://github.com/sonicretro/skdisasm)
- Hardware documentation:
  - Official Sega docs are thorough but poorly translated.
  - **Plutiedev** is detailed, with examples and VDP debug-register information.
  - The Mega Drive wiki is "abandoned" and may contain errors.
  - The SpritesMind forum is deep but scattered and sometimes outdated.
  
  — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- The SCHG (Sonic Community Hacking Guide) is the Sonic Retro wiki section of per-game data docs ("SCHG:Sonic the Hedgehog (16-bit)/Object Editing", "…/Level Editing", "RAM Editing") plus "SCHG How-to" guides. Their content could not be read. — search listings, e.g. [SCHG: Sonic 1 Object Editing](https://info.sonicretro.org/SCHG:Sonic_the_Hedgehog_(16-bit)/Object_Editing)

### Inferences
- For a macOS learner the practical stack is:
  - **Build:** `lua build.lua` (no Wine).
  - **Sprites:** Flex 2 or ClownMapEd (cross-platform).
  - **Levels:** SonLVL. It is .NET-based, so on macOS check how it is currently run. Cross-platform support is claimed, but I didn't verify how it runs on macOS.
  - **Test and debug:** BlastEm or ClownMDEmu, with Vladikcomper's error handler installed early so crashes show label names instead of a frozen screen.
- Because SonED2 and SonMapEd may not work with the Git disassemblies, any guide that tells the learner to "open X in SonED2" is a red flag that it targets the legacy disassemblies.

### Gaps
- Not verified: SonLVL's current macOS runtime story, Flex 2's current hosting and version, ClownMDEmu's newest debugger features as of Nov 2026, and whether BlastEm has a current native Apple Silicon build.
- No primary source found for Kosinski tool versions beyond mdcomp, FW-KENSC and ClownCompTool.

## 4. Workflow, common first projects, and why naive guides break things

### Takeaway
A principled workflow:
1. Clone the Git disassembly.
2. Confirm a byte-perfect build.
3. Commit.
4. Make small changes using labels, build flags and the provided editors.
5. Test on accurate emulators with an error handler.

Recipe guides break because they assume a particular disassembly version or label set, and because they lean on hidden hard-coded limits that a copy-paste fix can quietly violate: fixed object slots, 1-byte IDs, fixed RAM regions reused elsewhere, VRAM tile ranges, Z80 memory, branch and displacement ranges, and table sizes.

### Cited Findings
- The modern workflow edits a disassembly, not the ROM: "we do not directly modify ROMs any more." Run the build script (`build.bat`, or `build.lua` elsewhere) to produce e.g. `s1built.bin`. Saved edits in editors don't show up until the build script is rerun. Use a code editor with 68k syntax highlighting. — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- Byte-perfect verification is built in: skdisasm's `chkbitperfect` builds both ROMs and compares them with the originals, and s2disasm ships `chkbitperfect.bat/.lua`. — [skdisasm](https://github.com/sonicretro/skdisasm); [s2disasm build_tools](https://github.com/sonicretro/s2disasm/tree/master/build_tools)
- Guide incompatibility: many guides target the legacy disassemblies and Git changes often break them. Guides range from "very dry and technical, with a heavy emphasis on learning" to "brief and light on explanations, with an emphasis on copying code". Useful threads get "buried". Clownacy's guide links a quirks list, Sonic 1 and Sonic 2 fix guides, and a common-assembler-errors guide. — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- A 2022 Sonic Hacking Contest commenter told an entrant: "that Sonic Retro thread you used to get started on ROM hacking is way way way out of date." — [SHC 2022 Expo: Sonic Learns the SpinSwim](https://shc.zone/entries/expo2022/673)
- The Spin Dash in S1 guide (SCHG How-to, Part 2) says a ROM built from the original guide is "not a perfect port":
  - Spin Dashing next to a monitor doesn't break it.
  - The sound effect is imperfect.
  - There's no dust.
  - Spin dashing on SLZ seesaws behaves oddly.
  
  Fixing the dust and sound needs a free object slot and a ported sound routine (snippet). — [SCHG How-to: Add Spin Dash to Sonic 1/Part 2](https://info.sonicretro.org/SCHG_How-to:Add_Spindash_to_Sonic_1/Part_2)
- Hard-coded slot-size math: S.C.E. advertises that its 0x50-byte slots can be resized "without breaking anything" because there is "no slot-size multiplication like in Sonic 1 and 2". The stock S1/S2 code assumes $40-byte slots in arithmetic, so enlarging the SST is non-trivial. — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-)
- S.C.E. also says: "There are no hardcoded things as there were in the original Sonic 3 & Knuckles". Per-level data moved into one `Pointer.asm`, and 2-byte chunk IDs remove the 1-byte limit. — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-)
- S2 game-mode table limit: the mask is `$3C`, and the comment documents raising it "to a maximum of $7C to add more game modes". — [s2disasm s2.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.asm)
- Object RAM limits are enforced with build-time `fatal` assertions in S2 (e.g. "Special stage objects go past end of object RAM buffer"). 2P mode reserves 72 dynamic slots. — [s2disasm s2.constants.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.constants.asm)
- Displacement range: a Sonic Retro forum poster working on the S2 Git disassembly notes that if a table such as `Obj12_Index` "is too far away, that distance won't fit in a word and the assembler will cough up blood". The 68k has no absolute addressing mode with displacement. — [Sonic Retro forums, "Some changes and fixes for Sonic 2" thread (snippet; exact page uncertain)](https://forums.sonicretro.org/threads/some-changes-and-fixes-for-sonic-2.29029/page-8)
- S2 includes `JmpTo` stubs and a `removeJmpTos` option ("many unnecessary JmpTos are removed, improving performance"), plus `relativeLea` (PC-relative instead of absolute long). Source comments describe the effect, not the reason the stubs exist. — [s2disasm s2.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.asm)
- AS pass count: "Always specify jump sizes for instructions" to avoid extra assembler passes. — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-)
- Chunk RAM and the 128x128 conversion in S1 (Project Two Eight):
  - The practical chunk-RAM limit is $A400.
  - 128x128 saves $2400 bytes, but layouts grow 4x.
  - The ending reuses chunk RAM.
  
  An upstream `ProjectSonic1TwoEight` branch exists on s1disasm. — [MDDC Project Two Eight thread](https://board.mddc.dev/threads/a-really-cool-advantage-to-using-sonic-1-project-two-eight.53/); [s1disasm branches](https://github.com/sonicretro/s1disasm/branches)
- Sound limits: Z80 drivers share 8 KB between the engine and DAC data, and Z80 SMPS songs are limited to 0x8000 bytes. — [Clone Driver v2 About](https://github.com/Clownacy/Sonic-2-Clone-Driver-v2/wiki/About); [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- Custom sound drivers (Clone Driver v2, Flamedriver, AMPS) are "generally incompatible with legacy disassemblies". The Clone Driver v2 install guides target Git disassemblies only. — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- `padToPowerOfTwo` exists "for real hardware". `fix_header` recalculates the checksum after the build. — [s2disasm s2.asm](https://raw.githubusercontent.com/sonicretro/s2disasm/master/s2.asm); [s2disasm build.lua](https://raw.githubusercontent.com/sonicretro/s2disasm/master/build.lua)

### Inferences
- **Recommended learner workflow** (synthesis):
  1. Fork or clone the Git disassembly and build it unchanged. Run `chkbitperfect` or compare the ROM hash, then make the first git commit. This proves the toolchain works on the Mac.
  2. Make one change per commit. Git diffs on `.asm` files are the learning record and make it easy to bisect when a build crashes.
  3. Prefer the disassembly's own switches (`fixBugs`, `allOptimizations`, `Revision`/`gameRevision`) over guide patches, and read the `if fixBugs` blocks to learn *why* each fix works.
  4. Install an error handler (Vladikcomper's) early. Test in BlastEm or ClownMDEmu, check hardware quirks in Exodus, and test on real hardware via a flash cart when possible, keeping power-of-two padding on.
- **Suggested first-project ladder**, from least to most coupling:
  1. **Palette change.** Edit a palette file and rebuild. This teaches the build loop and the CRAM color format.
  2. **Level layout edit in SonLVL.** This teaches tiles → blocks → chunks → layout, and the per-block collision index.
  3. **Small object.** Copy an existing simple object's structure, register a new ID in `Obj_Index`, and place it with `ObjPosLoad` data. This teaches the SST, routines, mappings and art_tile/VRAM.
  4. **Spin Dash in S1.** This is the first project that crosses many subsystems: player mode logic, animation, sound, a new dust object needing an object slot plus VRAM tiles and a DPLC, and interactions with other objects such as monitors and SLZ seesaws. It is a good capstone, not a starter.
- **Why "port X" guides break**, in teachable categories:
  - **(a) Label and version drift.** The guide was written for the legacy or 2005 labels, or for an older Git revision.
  - **(b) Hidden resource budgets.** These include object slots (dynamic slots, 2P reservations, the reserved slot map), VRAM tile ranges (the new art's `art_tile` overlapping another object's tiles), and RAM reused by other modes (the S1 ending's chunk RAM).
  - **(c) Hard-coded arithmetic and addresses.** Examples are slot-size multiplication, absolute addresses copied from a RAM map instead of symbols, and 1-byte IDs.
  - **(d) Range limits that appear only after code grows.** `bra.s` and `bsr.s` reach about ±128 bytes. Word displacements and `(d16,PC)` reach about ±32 KB. Code that used to fit fails once a guide inserts code between a branch and its target, and the usual "fix" of converting to `jmp`/`jsr` or adding `JmpTo` stubs hides the structural cause. (The 68k ranges are standard ISA facts from general knowledge, not fetched here.)
  - **(e) Mismatched data formats between games.** Mappings, DPLC, SST offsets and sound formats differ.
  
  A tutor should teach the learner to ask, for every pasted block: which RAM, VRAM, slot or table entry does this consume, and who else uses it?
- Build-time assertions (`fatal`, the `zonewarning` macro, the song-size `error` in `build.lua`) are the community's own model of good practice. Encourage the learner to add similar `if … fatal` checks when they add objects or data.

### Gaps
- Could not read the full Spin Dash guide pages (Parts 1–4), the "Basic Questions & Answers" forum thread, or Clownacy's linked "common assembler errors" guide, so exact AS error messages and their documented fixes are not quoted.
- No source directly documents VRAM layout conflicts for the S1 Spin Dash dust. The claim that dust needs VRAM tiles is my inference.
- A search snippet included a forum complaint that "every guide points you at a different disassembly, which are incompatible with eachother", but the exact post URL could not be verified, so it is not cited above.

## 5. Notable well-engineered hacks and bases, reliable resources, critiques of "how to port X" guides

### Takeaway
The community's own experts now steer beginners toward the Git disassemblies, the in-source `fixBugs` flags, curated fix and quirk threads, and cleaned-up bases built with explicit engineering goals. Examples of such bases are S.C.E. Extended for S3K, Hivebrain's 2022 S1 disassembly, and Project Two Eight for 128x128 S1. Single-purpose "port X" wiki recipes are weaker: they are frequently outdated, tied to a particular disassembly, and admitted by their own authors to be imperfect.

### Cited Findings
- Where to find guides: the Sonic Retro wiki and the Sonic Retro, SSRG and MDDC forums, plus YouTube. Quality varies from learning-focused to copy-focused, and many target legacy disassemblies. — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- S.C.E. Extended is a "heavily modified and improved Sonic 3 & Knuckles engine". Its stated goals:
  - Remove hard-coding.
  - Centralize per-level data.
  - Use 2-byte chunk IDs.
  - Use resizable 0x50-byte slots.
  - Replace routines with faster but compatible ones.
  - Use KosPlus/KosPM and an Ultra DMA Queue.
  - Offer a choice of a Z80 Flamedriver or a 68k Clone Driver v2 (Mega PCM 2.1).
  
  Lead programmer: TheBlad768 (Red Miso Studios). — [S.C.E. Extended](https://github.com/TheBlad768/Sonic-Clean-Engine-S.C.E.-Extended-)
- Hivebrain's 2022 S1 disassembly:
  - Renamed SST labels and added flag constants.
  - A compatibility file for old labels.
  - Automatic Kosinski and Nemesis recompression at build time.
  - Automatic DAC driver build.
  - Macros such as `objpos`, `plcm` and `spritemap`/`piece`.
  
  — [cvghivebrain/s1disasm](https://github.com/cvghivebrain/s1disasm)
- Project Two Eight brings 128x128 chunks and path swappers to Sonic 1, and a matching upstream branch exists. — [MDDC](https://board.mddc.dev/threads/a-really-cool-advantage-to-using-sonic-1-project-two-eight.53/); [s1disasm branches](https://github.com/sonicretro/s1disasm/branches)
- Clone Driver v2 is a 68k SMPS replacement with a two-channel DAC and SMPS2ASM integration. Flamedriver is a Z80 option with no modern install guide, but there is an S&K disassembly with it preinstalled. AMPS is no longer supported. — [Clownacy 2025](https://clownacy.wordpress.com/2025/05/10/so-you-want-to-start-hacking-sonic-2025/)
- The Sonic Hacking Contest (shc.zone) is the community's annual showcase. Its rules require crediting all external work, for example "sprites, VGM conversions". — [SHC Rules](https://shc.zone/pages/rules)
- The SCHG How-to Spin Dash port guide openly lists its residual bugs and needs follow-up parts to fix them (snippet). — [SCHG How-to: Add Spin Dash to Sonic 1/Part 2](https://info.sonicretro.org/SCHG_How-to:Add_Spindash_to_Sonic_1/Part_2)
- Other SCHG How-to fix guides exist, such as "Fix the Walk-Jump Bug in Sonic 1" and "Fix a remember sprite related bug". Their quality could not be evaluated because the wiki was blocked. — search listings: [Fix the Walk-Jump Bug](https://info.sonicretro.org/SCHG_How-to:Fix_the_Walk-Jump_Bug_in_Sonic_1); [Fix a remember sprite related bug](https://info.sonicretro.org/SCHG_How-to:Fix_a_remember_sprite_related_bug)

### Inferences
- The partner's criticism ("hacky copy-paste fixes that introduce limitations and don't teach how the code works") matches the experts' own framing: Clownacy's copy-focused vs learning-focused distinction and the warning that guides break against Git. The tutor can present this as a known community issue, not a contrarian opinion.
- A good heuristic for judging a guide:
  - Does it name the disassembly and revision it targets?
  - Does it use symbolic labels rather than raw addresses?
  - Does it explain which slots, RAM, VRAM or table entries it consumes?
  - Does it mention side effects or follow-up fixes?
  - Is it reflected in the upstream `fixBugs` code or a maintained base?
- Studying well-engineered bases is a better way to learn "how to do it right" than following recipes. For S3K, read how S.C.E. replaced hard-coded tables. For S1, read Hivebrain 2022's macros and the upstream `fixBugs` blocks. The learner can diff these against stock code.

### Gaps
- Could not access SSRG (sonicresearch.org) or Sonic Retro forum threads to collect named, community-endorsed "reliable guides" lists, or explicit published critiques of specific "port X" guides.
- Could not verify other well-regarded engineering bases and hacks (e.g. RetroKoH's S1Fixed; a wiki page "Editing Art" was seen only as a search title), or recent SHC award winners.
- Sonic 1-squared (cvghivebrain/Sonic1sq) surfaced only through an aggregator snippet, and its description could not be confirmed.

## 6. Legal and distribution: disassembly content, patches

### Takeaway
The disassembly repos contain (split) original game data and code, and they publish disclaimers limiting use to "informational and educational purposes". Hacks share only modifications, traditionally as patches against the original ROM. Note a possible discrepancy: a Sonic Retro wiki snippet says Sonic hacks today are usually distributed as full ROMs, with IPS patches as the older approach. The tutor should present patching (BPS/xdelta) as the cleaner practice without claiming it is universal.

### Cited Findings
- The s1disasm and s2disasm READMEs say that content is "presented for informational and educational purposes only". s2disasm adds: "Commercial usage is expressly prohibited." Sonic Retro claims no ownership of the code. — [s1disasm](https://github.com/sonicretro/s1disasm); [s2disasm](https://github.com/sonicretro/s2disasm)
- skdisasm by default builds S&K "relying on an appended Sonic 3 ROM", and splits the S3 data out only with `Sonic3_Complete = 1`. — [skdisasm](https://github.com/sonicretro/skdisasm)
- On distribution, the Sonic Retro wiki says hacks in the Sonic community are now usually distributed as full ROMs, with IPS patches being the older approach. xdelta 1.x used its own format, while xdelta 3.x uses standard VCDIFF (snippet). — [Sonic Retro: ROM hack (snippet)](https://info.sonicretro.org/ROM_hack)
- The SHC rules cite a past entry shipped as an IPS patch, where players had to obtain the original ROM themselves. — [SHC Rules](https://shc.zone/pages/rules)
- General ROM-hacking practice in another community: IPS is called obsolete, and BPS or UPS are recommended because they include hashes of the base game. — [PokéCommunity completed ROM hacks guidelines](https://www.pokecommunity.com/threads/completed-rom-hacks-guidelines-updated-october-2026.467328/)

### Inferences
- The learner should keep their hack's git history and ROM private or limited to their own changes, and release a BPS or xdelta patch against the specific original revision (REV00/REV01) that their disassembly builds. BPS's base-ROM hash catches the wrong revision. This is general good practice, not a Sonic-community rule.

### Gaps
- No legal analysis was researched. The SHC rules' copyright section was truncated in search results, and current SHC requirements on patch vs ROM distribution are unverified.
