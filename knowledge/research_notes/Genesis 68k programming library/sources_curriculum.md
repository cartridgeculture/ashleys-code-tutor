# Sega Genesis / Mega Drive programming: learning resources and teaching sequence (C, C++, SGDK, 68000 asm, Sonic hacking)

Research notes, current as of 18 November 2026. Written for the report writer of an AI tutor app aimed at total programming beginners. Statuses were checked live in this session unless noted. Material that comes from general background knowledge and could not be sourced here is labeled "(background, verify)".

---

## Q1. Evaluated catalog: what each resource covers, how good it is, known errors or dated parts, understanding vs. recipes, URL, author, status

### Takeaway
There is no single beginner-to-expert path. The best resources each cover one slice. **Ohsat** (SGDK projects, recipe style, 2019–2022, partly outdated) and **Pigsy** (SGDK videos) cover C games. **MarkeyJester** (68k CPU fundamentals, beginner-paced, stops before hardware), **ChibiAkumas** (68k, multi-platform, VASM, videos for every lesson) and the **Big Evil Corporation 2012 series plus `megadrive_samples`** (68k on Genesis hardware) cover assembly. **Plutiedev** (active in 2026, accurate, deliberately not for beginners) and the official **Sega manuals** are the hardware reference. **Clownacy's 2025 Sonic Retro guide, the Git disassemblies and the Sonic Physics Guide** cover Sonic hacking. Several older pillars are abandoned or dated: the Mega Drive wiki (unedited since about 2017), Charles MacDonald's genvdp.txt (v1.5f, 2000), EASy68K (last release found is 2013), most of the old SCHG wiki and Hacking CulT. No new Mega Drive-specific programming book from 2024–2026 was found.

### Cited Findings

#### A. Hardware references and documentation

**Plutiedev**: https://plutiedev.com/
- Coverage: a "Game programming" section (fixed point, angle math, speed and gravity, basic collision, sprite sorting, decimal/binary/hex). Mega Drive programming: 68000 (mul/div, BCD, 64-bit math, MOVEP), graphics (VDP setup, writing to video memory, tiles and palettes, sprites, tile flags, layer priority, resolution, DMA, shadow/highlight), peripherals (I/O ports, controllers, mouse, multitap, keyboard), sound (YM2612, PSG), Z80, misc (hardware issues, ROM padding, SRAM saving, beyond 4MB, multitasking), Mega CD. Also special effects, reference tables (VDP registers, sprite table, YM2612 registers, ROM header) and compression formats (SLZ, UFTC). — [Plutiedev home](https://plutiedev.com/)
- The site warns that it is "clearly focused on obscure stuff for now (sorry newbies!)". It has no scrolling article and no toolchain or setup guide. — [Plutiedev](https://plutiedev.com/)
- Status: active. The newest blog post is dated 16 Oct 2026, and other posts include a "Mega Drive virtual lab". Third-party mirrors on the site are marked blue and "may or may not be outdated". — [Plutiedev](https://plutiedev.com/)
- Author: the page doesn't name one; it shows the handle "iwis"/@plutiedev. SGDK's credits thank Sik for "Plutidev" as a technical source, but a search could not confirm authorship from the site itself. — [Plutiedev](https://plutiedev.com/); [Sik/SGDK search results summarized via SGDK repo](https://github.com/Stephane-D/SGDK)
- A 2019 forum post describes it as "lots of well written, and concise documentation". — [ChibiAkumas forum thread on Plutiedev](https://chibiakumas.com/forum/viewtopic.php?p=128)
- The SGDK README lists Plutiedev among its technical references. — [SGDK README](https://github.com/Stephane-D/SGDK)

**Mega Drive Wiki (md.railgun.works)**: http://md.railgun.works/index.php?title=Main_Page
- It describes itself as a community wiki aiming to hold "complete and correct information" on the Mega Drive, Mega CD and 32X. It has how-tos such as "Read Control Pads" and "Initialise a Mega Drive", plus a 68k instruction reference and VDP pages. The license is CC BY-NC-SA 3.0. — [MD Wiki main page](http://md.railgun.works/index.php?title=Main_Page)
- Status: effectively dead. "Latest pages" all date from 16 Mar 2015, the main page was last modified on 15 Jul 2017, and a notice reports broken image links. The HTTPS URL redirects to plain HTTP. — [MD Wiki](http://md.railgun.works/index.php?title=Main_Page)
- Clownacy's 2025 Sonic Retro guide lists it as "abandoned, may contain errors". — [Sonic Retro, Clownacy 2025](https://forums.sonicretro.org/goto/post?id=1097465)

**Charles MacDonald, "Sega Genesis VDP documentation" (genvdp.txt)**
- The newest copy found is v1.5f, dated 08/10/00. It calls itself an "unpublished, very preliminary work". It was written because the VDP information available then was inadequate and left many quirks unexplained. — [genvdp.txt mirror (RHDN archive 2024-08-01)](https://otakon273.duckdns.org/Consoles/RomHacking.net/rhdn_20240801/documents/[231]genvdp.txt)
- Status: the original site was not found in search. Copies survive on third-party mirrors such as the RHDN archive mirror above. Sega Retro hosts his related Master System VDP document, which includes a Genesis VDP chapter. — [Sega Retro: SMS VDP documentation](https://segaretro.org/Sega_Master_System_VDP_documentation_(2002-11-12))
- Older beginner tutorials still point readers to genvdp.txt as their VDP reference. — [darkdust.net: First steps with the Mega Drive VDP](https://darkdust.net/node/7)

**Sega official documentation (Genesis Software Manual, Technical Bulletins, etc.)**
- Sega Retro's "Mega Drive official documentation" page lists:
  - the Genesis Software Manual (1990-02-06; the PDF is 183 pages, 30.62 MB)
  - the Genesis Technical Bulletins
  - Software Development Manual 2.0 (26 pages)
  - the Sound Software Manual
  - service manuals
  — [Sega Retro (search snippet)](https://segaretro.org/Mega_Drive_official_documentation)
- Automated fetching of Sega Retro was blocked by Anubis bot protection in this session ("Access Denied"). — [Sega Retro](https://segaretro.org/Mega_Drive_official_documentation)
- The bulletins are scanned emails that Sega of America sent to registered developers. Technical Bulletin 32 covers XBAND. — [RetroReversing: Mega Drive SDK](https://www.retroreversing.com/sega-mega-drive-genesis-sdk)
- A SpritesMind contributor says the bulletins were OCR'd and split into separate files, and that the later Software Development Manual clarifies some earlier bulletins. — [SpritesMind: Sega Tech Docs archive](https://gendev.spritesmind.net/forum/viewtopic.php?p=35840)
- The SGDK README links the Genesis Software Manual PDF as a technical reference. — [SGDK README](https://github.com/Stephane-D/SGDK)

**Other hardware guides that the SGDK README recommends**
- Raster Scroll, "A Guide to the Graphics of the Sega Mega Drive / Genesis". — [rasterscroll.com](https://rasterscroll.com/mdgraphics/vdp-overview/)
- Mega Cat Studios, "Sega Genesis/Mega Drive VDP Graphics Guide v1.2a (03/14/17)". — [Mega Cat Studios](https://megacatstudios.com/blogs/press/sega-genesis-mega-drive-vdp-graphics-guide-v1-2a-03-14-17)
- Also listed: the "Awesome Mega Drive" list (And-0) and Rodrigo Copetti's architecture article. — [SGDK README](https://github.com/Stephane-D/SGDK); [awesome-megadrive](https://awesome.ecosyste.ms/projects/github.com%2FAnd-0%2Fawesome-megadrive)
- Sonic Retro also hosts VDP register documentation in the SCHG. — [SCHG: VDP Registers](https://info.sonicretro.org/SCHG:VDP_Documentation/General/Registers)

#### B. 68000 assembly tutorials

**MarkeyJester's Motorola 68000 Beginner's Tutorial**: https://mrjester.hapisan.com/04_MC68/
- Author: MarkeyJester. He says he has written 68k for Sonic ROM hacks, prototype games and a full Mega Drive game, and he pitches the tutorial at an "extreme beginner's level". — [MarkeyJester tutorial](https://mrjester.hapisan.com/04_MC68/)
- Table of contents:
  1. Getting started: memory, storage, registers, MOVE, addressing and program flow
  2. Basic instructions: ADD, SUB, SWAP, EXG, CLR
  3. Binary instructions: NOT, AND, OR, EOR, BSET/BCLR/BCHG
  4. Positive and negative: signed/unsigned, NEG, EXT, shifts and rotates, MULU/MULS/DIVU/DIVS
  5. Program flow: PC, JMP, BRA, SP, JSR/RTS, BSR
  6. Conditional branches: CCR, CMP/TST/BTST, Bcc, signed vs unsigned branches
  7. Conditional set instructions (Scc)

  There are "Homework" pages after most sections, plus a cycle-times section. — [MarkeyJester tutorial](https://mrjester.hapisan.com/04_MC68/)
- Scope: CPU only. There is no VDP, sprite, input or sound coverage. — [MarkeyJester tutorial TOC](https://mrjester.hapisan.com/04_MC68/)
- Dated parts: the last dated update is 16 Sep 2017 (cycle-time tables measured on a Model 1 Mega Drive). The author warns that the shift-instruction timings might be inaccurate. He also declines to support EASy68K or BSVC problems. — [MarkeyJester tutorial](https://mrjester.hapisan.com/04_MC68/)
- Teaching style (Section 1 Part 1): it builds up from bits to nybbles, bytes, words and long-words. Hex is presented as a shorthand where one nybble is one hex digit, with a binary/decimal/hex table and a worked carry example (9F + 1 = A0). The tone is casual. That page has no exercises. — [MarkeyJester S1P1](https://mrjester.hapisan.com/04_MC68/Sect01Part01/Index.html)
- In 2025 it is still the community's recommended 68k starting point for Sonic hackers. — [Sonic Retro, Clownacy 2025 guide](https://forums.sonicretro.org/goto/post?id=1097465)

**ChibiAkumas (Keith Sear) 68000 tutorials**: https://www.chibiakumas.com/68000/
- Structure:
  - "Absolute Beginner" lessons 1–11 (shared with the Z80 pages)
  - six core 68000 lessons: getting started; addressing modes; loops and conditions; stack, traps and maths; bits and swaps; extends and macros
  - Hello World per platform (H1–H6, with H5 for the Genesis)
  - Platform-specific lessons P1–P38 (Genesis: P5, P11, P16, P20 FM sound via Z80, P21 FM via 68000, P27, P29, P35 Mega CD, P38)
  - Simple Samples S1–S12
  - game series: YQuest (11 lessons) and Photon (6 lessons)

  — [ChibiAkumas 68000](https://www.chibiakumas.com/68000/)
- Toolchain: VASM with Motorola (MOT) syntax. Platforms covered: Amiga, Atari ST, Neo Geo, Genesis, Sinclair QL and X68000. The page links the Motorola 68000 manual (hosted by NXP) and a pocket reference. — [ChibiAkumas 68000](https://www.chibiakumas.com/68000/)
- Every lesson has a matching YouTube video. There is a Genesis-specific page. — [ChibiAkumas Genesis page](https://www.chibiakumas.com/68000/genesis.php)
- There is also a companion book, *Learn Multiplatform Assembly Programming with ChibiAkumas, Vol. 1* (2022), covering Z80, 6502, 68000, 8086 and ARM. — [Video Game Library listing](https://www.thevideogamelibrary.org/book/learn-multiplatform-assembly-programming-with-chibiakumas-volume-1)
- The page shows no dates for the 68000 lessons. — [ChibiAkumas 68000](https://www.chibiakumas.com/68000/)

**Big Evil Corporation (Matt Phillips): blog, samples, Tanglewood**
- The blog's numbered "Sega Megadrive" assembly series (2012):
  1. Getting Started (28 Feb)
  2. So, assembly language, then… (1 Mar)
  3. Awaking the Beast (9 Mar)
  4. Hello, world! (23 Mar)
  5. Fonts and Text (9 Apr)
  6. Scary Monsters and Nice Sprites (24 Apr)
  7. Gamepad Input and the Game Loop (30 Apr)
  8. Animated Sprites (5 May)
  9. Maps and scrolling planes (30 May)
  10. Sound Part I – The PSG Chip (3 Sep)

  — [blog.bigevilcorporation.co.uk](https://blog.bigevilcorporation.co.uk/)
- Status: the blog is reachable. Its newest post is from 5 Aug 2018. A March 2018 post ("Mega Drive Assembly Workshop and Hello World Sample") links a newer sample and says the author intends to return "with a full new set of tutorials". No such set was found. — [BEC blog](https://blog.bigevilcorporation.co.uk/)
- The `megadrive_samples` GitHub repo offers small, complete 68000 samples and says they replace the older examples on the website. — [awesome.ecosyste.ms: BigEvilCorporation/megadrive_samples](https://awesome.ecosyste.ms/projects/github.com%2FBigEvilCorporation%2Fmegadrive_samples)
- Tanglewood source: https://github.com/BigEvilCorporation/TANGLEWOOD
  - It is a full commercial puzzle-platformer in 68000 assembly, released 14 Aug 2018.
  - It needs the proprietary SNASM68K or PSY-Q ASM68K assemblers, which the repo does not link.
  - It uses Sik's Echo sound engine.
  - The README grants personal build-and-play rights but is not an open-source license. A Trisquel forum post questions whether it is "free software".

  — [GitHub TANGLEWOOD](https://github.com/BigEvilCorporation/TANGLEWOOD); [Trisquel forum](https://trisquel.info/es/forum/tanglewood-free-software-err-i-think)
- Matt Phillips appears in the Computerphile videos "Hello World on Sega Megadrive" and "Sega Game Coding in Assembly". These explain that the console has no OS or drivers, so game code must set up the VDP itself. — [Computerphile via rosetta.to](https://rosetta.to/u/computerphile/hello-world-on-sega-megadrive-computerphile); [Sega Game Coding in Assembly](https://rosetta.to/u/computerphile/sega-game-coding-in-assembly-computerphile?t=0)

**Hugues Johnson, "Sega Genesis Programming" (68k)**: https://huguesjohnson.com/topics/68k-programming/
- A 26-part series:
  - Parts 1–6: palettes; tiles and sprites; sprite animation; the Echo sound engine; collision detection; vertical scrolling
  - Parts 7–12: NPC sprites; game state and pausing; object list; sprite link list; scenes and dialogs; scenes and NPCs
  - Parts 13–18: action table; selections; inventory; scripted events; fade in/out; saving and loading
  - Parts 19–26: 6-button controllers; palette and tile generation; VDP sprite collision; 4-way play; project template; pseudorandomness; on-screen keyboard; gradient fill

  There is also a side article, "A better understanding of planes". — [huguesjohnson.com 68k topics](https://huguesjohnson.com/topics/68k-programming/)
- The copyright footer reads 2000–2026. The site also hosts the author's Genesis games (Retail Clerk '89/'90, Speedrun Tower). — [huguesjohnson.com](https://huguesjohnson.com/programming/genesis/)

**GameHut "Learn To Code!"** (YouTube, 68k on Mega Drive)
- The files are collected on GitHub. A community project notes that the series uses vasm (Motorola syntax) and a "Mega Drive startup kit" from the channel. — [GameHut-Files](https://www.github.com/TheStormkeeper/GameHut-Files); [learning-megadrive](https://github.com/sroccaserra/learning-megadrive)

**EASy68K (68000 simulator/IDE)**: https://github.com/ProfKelly/EASy68K
- It edits, assembles and runs 68000 programs on Windows (or under Wine). It is GPL. The newest version found is v5.12.28 (March 2013). — [EASy68K help mirror](https://acorn.huininga.nl/pub/projects/CiscOS/_emulators/EASy68Ksource/EASy68K_Help/quickStart.htm); [GitHub ProfKelly/EASy68K](https://github.com/ProfKelly/EASy68K)
- Easier68k is a Python reimplementation aimed at cross-platform use. ESIEE's Sim68K is another teaching simulator. — [Easier68k docs](https://easier68k.readthedocs.io/); [ESIEE Sim68K](https://perso.esiee.fr/~perrotol/sim68k/main.html)

**Other**
- db-electronics `68kTutorials`. — [GitHub](https://github.com/db-electronics/68kTutorials)
- The CodeMash 2020 talk "Assembly Language: The (Sega) Genesis of Programming" (Joe Sewell). — [opencourser listing](https://opencourser.com/course/vgrr5o/assembly-language-the-sega-genesis-of-programming-codemash)
- Syntax.fm episode 935 (8 Sep 2025), "CJ made a Sega game in 2025": a podcast, not a tutorial. — [syntax.fm/935](https://syntax.fm/935)

#### C. SGDK (C on Genesis)

**SGDK itself (Stéphane Dallongeville)**: https://github.com/Stephane-D/SGDK
- The current README is headed "SGDK 2.11 (April 2025)". It provides:
  - a wiki
  - Doxygen API docs at stephane-d.github.io/SGDK
  - `rescomp.txt` (the resource declarations)
  - a sample folder, where the Sonic sample is called "a good showcase of SGDK usage in general"

  — [SGDK README](https://github.com/Stephane-D/SGDK)
- Toolchain:
  - Windows ships prebuilt (GCC 13.2), and Java is required for the tools.
  - Linux/macOS users set things up themselves via a Wine script, SGDK Helper or MarsDev. The macOS guide is called "probably a bit outdated".
  - Docker: the README points to doragasu's docker-sgdk.

  — [SGDK README](https://github.com/Stephane-D/SGDK)
- License: MIT for the library and tools; GCC is GPL3 with the runtime exception. — [SGDK README](https://github.com/Stephane-D/SGDK)
- Tutorials the README recommends: Ohsat, Danibus (Spanish only) and Pigsy's YouTube series. It warns that some online tutorials are outdated or contain errors. — [SGDK README](https://github.com/Stephane-D/SGDK)
- The official wiki's tutorials, in order: Introduction, Hello World, Background, Sprites, Input, Maths. There are also setup pages for Eclipse, Code::Blocks and Qt Creator, one marked "(old)". The wiki home was last edited 13 May 2022, so it predates SGDK 2.x. — [SGDK wiki](https://github.com/Stephane-D/SGDK/wiki)
- Breaking changes that affect old tutorials:
  - SGDK 2.00 (January 2024) renamed `SND_xxx_` methods and removed `SND_xxx_XGM` in favour of `XGM_xxx`. The palette getters now return forced RGB333 values.
  - 1.90 changed `SPR_addSpriteEx` parameters and renamed `GFX_xxx` constants to `VDP_xxx`.

  — [SGDK v2.00 release notes](https://www.github.com/Stephane-D/SGDK/releases/tag/v2.00)
- Versions before 1.6 used `VDP_waitVSync()` where newer ones use `SYS_doVBlankProcess()`. Ohsat's lesson 1 flags this. — [Ohsat Megapong 1](https://www.ohsat.com/tutorial/megapong/megapong-1/)

**Ohsat Games SGDK tutorials**: https://www.ohsat.com/tutorial/
- Project series, each listed with its latest post date:
  - **Megapong** (10 lessons, Oct 2019): hello world, setup, resources, palettes, sprites, input/paddles, collisions, score/HUD, game over, flashing.
  - **Megarunner** (7, Dec 2019): framework, tiles, scrolling, player/obstacles, "jumping math", collision/score, tile scrolling.
  - **Megalaga** (10, Apr 2020): space background, entities, enemies, movement/input, bullets, collision/HUD, enemy bullets, spam protection, sound, power-up.
  - **Megatiler** (7, Jul 2021): tiles, player spawn, tile movement, coins, HUD/sound/exit, loading levels.
  - **MD00 Misc** (19 standalone, to Jul 2022): graphics creation, ROM header, game states, menus, music, resets, drawing tiles from code, text crawl, scrolling maps, animated tiles, password system, region check.

  — [Ohsat tutorial index](https://www.ohsat.com/tutorial/)
- Status: on hiatus. The author says they won't be updated "for a long while" and that "some of these tutorials are out of date", without saying which. No SGDK version is named. — [Ohsat tutorial index](https://www.ohsat.com/tutorial/)
- Lesson 1 (31 Aug 2019) assumes Windows ("only works on Windows" out of the box), the command line and PATH editing. It does not teach C syntax. It is mostly step-by-step copying, and it explains only `VDP_drawText` and `SYS_doVBlankProcess`, deferring VBlank details. — [Ohsat Megapong 1](https://www.ohsat.com/tutorial/megapong/megapong-1/)

**Pigsy's Retro Game Dev Tutorials** (YouTube and Patreon)
- Beginner SGDK videos: backgrounds, sprite creation and animation (Aseprite), D-pad/button controls, parallax scrolling, palette-cycle animation. — [letsplayindex: button controls](https://www.letsplayindex.com/video/how-to-code-button-controls-for-the-sega-genesis-and-mega-IC5Kxe-FT-U); [Aseprite graphics video](https://www.letsplayindex.com/video/how-to-create-graphics-for-the-sega-genesis-and-mega-drive-lO2EZ2LZAMA); [palette cycle video](https://clip.africa.com/how-to-create-palette-cycle-animations-for-sega-genesis-mega-drive-beginner-game-dev-tutorials-pigsy-s-retro-game-dev-tutorials)
- Patreon lessons include the 256 low-res mode, 8/16/32-bit numbers, and a camera for 2D games. — [Patreon sitemap](https://www.patreon.com/PigsysRetroGameDevTutorials/sitemap)
- Pigsy is an active SGDK developer: in Dec 2024 he was working on an unofficial Game Gear Shinobi port to the Mega Drive. — [Time Extension, Dec 2024](https://www.timeextension.com/news/2024/12/gg-shinobi-is-being-unofficially-ported-to-genesis-mega-drive)
- A community-compiled list of SGDK tutorials one learner followed. — [williamdsw/sgdk-tutorials](https://awesome.ecosyste.ms/projects/github.com%2Fwilliamdsw%2Fsgdk-tutorials)

**"Danthrax4"**: searching found no SGDK tutorial creator by this name. — [search returned no matches; see Gaps]

**Other C/C++ toolchains**
- MarsDev: a cross-platform Mega Drive/32X toolchain. — [GitHub andwn/marsdev](https://www.github.com/andwn/marsdev)
- ClownMDSDK: a from-scratch toolchain for modern C/C++ on the Mega Drive and Mega CD, with a small embedded-friendly C++ standard library subset, reportedly updated May 2026 (secondary listing). — [relatedrepos: Clownacy/clownmdsdk](https://relatedrepos.com/gh/Clownacy/clownmdsdk)
- SGDKplusplus is a C++ fork of SGDK, last updated in 2022. — [relatedrepos: SGDKplusplus](https://relatedrepos.com/gh/paspallas/SGDKplusplus)
- "Megadev" (drojaazu) is a C and 68k asm framework focused on the Mega CD, not a book. The README says it is for people with C or 68k experience and is "less 'friendly'" than SGDK. MIT license. — [GitHub drojaazu/megadev](https://github.com/drojaazu/megadev)

#### D. Community forums

**SpritesMind / gendev forum**: https://gendev.spritesmind.net/forum/
- Active in November 2026. The latest posts were Announcement (11 Nov 2026), Demos (13 Nov 2026), Tools (14 Nov 2026), SGDK (27 Aug 2026; 562 topics, 5,705 posts), Super 32X (Oct 2026) and Mega/SegaCD (Sep 2026). Some subforums are quieter: Megadrive/Genesis (last post Dec 2025), VDP (Feb 2025), Sound (Jun 2023), Controls (2020). — [SpritesMind forum index](https://gendev.spritesmind.net/forum/)
- One forum post notes that SGDK lacks a unified tutorial but lets you write C and drop into assembly when needed. — [SpritesMind thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=25687)
- Matt Phillips moderates the forum (per search summary). Beginner "Hello World" asm threads exist, e.g. "The perfect 'Hello World' example for new starters". — [SpritesMind thread](https://gendev.spritesmind.net/forum/viewtopic.php?p=31148)

**Reddit r/retrogamedev (2024)**
- In a June 2024 "Getting into retro development" thread, a commenter recommends SGDK for its active community and library. The thread was read via a mirror; the original Reddit fetch failed. — [r/retrogamedev mirror](https://lr.in.psf.lt/r/retrogamedev/comments/1dj9ae0/getting_into_retro_development)

**Emulator advice from a 2024 port devlog**: BlastEm is described as the best development emulator, with GDB remote debugging. — [Honey Guardian devlog](https://ioribranford.itch.io/honey-guardian/devlog/779551/developing-the-genesismegadrive-port)

#### E. Sonic hacking

**Clownacy, "Recommended tools and documentation for newbie Sonic ROM hackers"** (Sonic Retro, 10 May 2025): https://forums.sonicretro.org/goto/post?id=1097465
- Recommends editing a disassembly rather than a ROM. It prefers the GitHub disassemblies (s1disasm, s2disasm, skdisasm) over the legacy Hivebrain/Xenowhirl ones. The tradeoff: legacy versions match more old guides, while the Git versions change and can break guide compatibility. Builds use build.bat or build.lua. — [Sonic Retro thread](https://forums.sonicretro.org/goto/post?id=1097465)
- Current tools:
  - Editors: Notepad++ with 68k highlighting; Kate or Geany on Linux.
  - Sprite and level editing: Flex 2 or ClownMapEd for sprites; SonLVL for levels; SonPLN or Captain PlaneEd for planes.
  - Debuggers: Flamewing's (simpler) or Vladikcomper's (shows labels).
  - Compressors: mdcomp, ClownCompTool, FW-KENSC.
  - Sound drivers: S2 Clone Driver v2, Flamedriver.
  - Emulators: ClownMDEmu, BlastEm, Exodus; replies add BizHawk.

  — [Sonic Retro thread](https://forums.sonicretro.org/goto/post?id=1097465)
- Outdated: Esrael's ROM editors, SonMapEd, the Sega Data Compressor, AMPS and Fractal, SoniPlane, Regen, and the MD wiki. Selbi notes that most old SCHG material is now "mostly irrelevant", except the RAM tables. Music conversion is flagged as hard and best left for later. Use Git for backups and bug hunting. — [Sonic Retro thread](https://forums.sonicretro.org/goto/post?id=1097465)
- Communities: SSRG (sonicresearch.org), MDDC (board.mddc.dev plus a Discord) and the Sonic Hacking Contest Discord, which suits newcomers because forum activity has dropped. — [Sonic Retro thread](https://forums.sonicretro.org/goto/post?id=1097465)

**Sonic Community Hacking Guide (SCHG) and How-tos**: https://info.sonicretro.org/SCHG:Sonic_Community_Hacking_Guide
- "Work with Motorola 68000 assembly" uses Sonic 2 with Xenowhirl's legacy disassembly and stresses backing up. — [SCHG How-to: Work with ASM](https://info.sonicretro.org/SCHG_How-to:Work_with_ASM)
- The "Add Spin Dash to Sonic 1" guide targets the GitHub disassembly and needs a text editor, Flex 2 and an emulator. — [SCHG How-to: Spin Dash](https://info.sonicretro.org/SCHG_How-to:Add_Spindash_to_Sonic_1)
- There is a guide to setting up a Sonic 1 split disassembly, a "Beginner Mistakes" page and a "Disassemblies" index. — [Set up S1 split disasm](https://info.sonicretro.org/SCHG_How-to:Set_up_a_Sonic_1_split_disassembly); [Beginner Mistakes](https://info.sonicretro.org/SCHG:Beginner_Mistakes); [Disassemblies](https://info.sonicretro.org/Disassemblies)

**Sonic Physics Guide (SPG)**: https://info.sonicretro.org/Sonic_Physics_Guide
- Covers the Genesis and Sega CD Sonic games plus Mania: running (ground speed `gsp`, acceleration `acc` = 0.046875), jumping, slopes and angles, sensors (ground, ceiling, push), special stages, shields, game objects. — [SPG](https://info.sonicretro.org/Sonic_Physics_Guide); [SPG:Running](https://info.sonicretro.org/SPG:Running)

**Hacking CulT** (the user's "Hacking Cough")
- Sonic Retro describes it as drx's site devoted to Genesis hacking, mostly Sonic, with "some good guides (including one on Motorola 68000 assembly)", but "notoriously unstable". It shares a server with Sonic CulT, which has suffered attacks. — [Sonic Retro: Hacking CulT](https://info.sonicretro.org/Hacking_CulT)
- Historically it distributed a Sonic 1 split disassembly and SonED2. — [Data Crystal: Sonic 1](https://datacrystal.tcrf.net/wiki/Sonic_the_Hedgehog_(Genesis))

#### F. Books (2024–2026)
- No new Mega Drive- or 68k-specific programming book from 2024–2026 was found. Recent Mega Drive books are history or art books:
  - *Sega Mega Drive/Genesis: Ultimate Works* (Keith Stuart, Thames & Hudson, 2025): a reissue of the 2014 *Collected Works*.
  - *The Unofficial Mega Drive Pixel Book* (2025).

  — [Thames & Hudson](https://www.thamesandhudson.com/products/sega-mega-drive-genesis-ultimate-works); [Video Game Library: Pixel Book](https://www.thevideogamelibrary.org/book/the-unofficial-mega-drive-pixel-book)
- Adjacent titles:
  - *Learn Multiplatform Assembly Programming with ChibiAkumas Vol. 1* (2022; includes 68000).
  - *Game Boy Coding Adventure* (No Starch, 2025), a beginner assembly book for another console that could serve as a pedagogy model.

  — [VGL: ChibiAkumas book](https://www.thevideogamelibrary.org/book/learn-multiplatform-assembly-programming-with-chibiakumas-volume-1); [Penguin: Game Boy Coding Adventure](https://www.penguin.com.au/books/game-boy-coding-adventure-9781718503908)

#### G. General C/C++ beginner resources used for the language tracks
- **CS50x 2026** sequence: Week 0 Scratch, 1 C, 2 Arrays, 3 Algorithms, 4 Memory, 5 Data Structures, then Python, SQL, AI, web, Flask. About two-thirds of students have never taken CS. The workflow for each week is lecture, then optional section and shorts, then a problem set. — [cs50.harvard.edu/x](https://cs50.harvard.edu/x/)
- **learncpp.com**: still maintained. In Feb 2025 it added "unintentional infinite loops" to lesson 8.8, revised 4.1 on integer vs integral types, and revised O.2 on bitwise operators. — [learncpp latest changes](https://learncpp.com/latest-changes)
- A third-party review counts 28 chapters, "starts from the very basics". — [hackr.io review](https://hackr.io/blog/cpp-tutorial-review)

### Inferences

**Summary ratings.** This is my judgment from the evidence above. "Understanding" means the resource explains why, not just how.

| Resource | Status (Nov 2026) | Best role in the app | Beginner fit | Understanding vs. recipe |
|---|---|---|---|---|
| Plutiedev | Active (posts Oct 2026) | Tutor's hardware reference: VDP, I/O, YM2612, fixed point, homebrew guidelines | Low (says so itself) | Understanding; concise and precise |
| SpritesMind forum | Active, but many subforums are quiet | Escalation and Q&A source; historical answers | Low to medium | Mixed |
| MD wiki (railgun) | Abandoned since about 2017; HTTP only | Avoid, or cross-check only | Medium | Mixed; may contain errors |
| C. MacDonald genvdp.txt | Frozen at v2000; mirrors only | Historical/precise VDP detail for the tutor; not for learners | Low | Understanding (emulator-author depth) |
| Sega Software Manual / Bulletins | Archived scans on Sega Retro (bot-blocked) | Authoritative primary source for the tutor; send advanced learners to it | Low | Reference |
| MarkeyJester 68k | Static since 2017; online | Core CPU lessons for the 68k track and Sonic hacking | High | Understanding (builds from bits up; homework) |
| ChibiAkumas 68k | Online; videos | Alternative explanations, videos, Genesis hello world, multi-platform context, VASM | Medium to high | Understanding plus working examples |
| BEC 2012 blog + megadrive_samples | Blog frozen 2012/2018; samples repo newer | Genesis hardware-in-asm sequence (boot → text → sprites → input → scroll → PSG) | Medium | Understanding (narrative) |
| Tanglewood source | On GitHub; proprietary assembler; restrictive terms | Reading a complete real game; capstone study | Low | n/a (source) |
| Hugues Johnson 68k series | Online | Mid/late asm topics: object lists, game state, saving, randomness | Medium | Understanding plus code |
| GameHut Learn To Code | YouTube, date unverified | Optional video supplement with a startup kit | Medium | Unverified |
| EASy68K | Last release 2013; Windows/Wine | Optional sandbox for pure-CPU lessons; not Genesis-accurate I/O | High for the CPU basics | Tool |
| SGDK README/wiki/samples/Doxygen | Library active (2.11, Apr 2025); wiki stale (2022) | Canonical API; samples to read later | Medium (wiki short) | Reference/recipe |
| Ohsat | On hiatus; partly out of date | Best project-based SGDK sequence (Pong → runner → shmup → tile game) | Medium (assumes C and the command line) | Mostly recipe |
| Pigsy | YouTube/Patreon; author active | Visual/art pipeline, parallax, palette cycling, camera | High for SGDK | Mixed; practical |
| Clownacy 2025 Sonic Retro guide | Current (2025) | Defines the modern Sonic-hacking toolchain and what's obsolete | High | Orientation |
| SCHG wiki | Mostly legacy; RAM tables still useful | Specific how-tos (Spin Dash); check disassembly version | Medium | Recipe |
| Sonic Physics Guide | Maintained wiki | Explains why Sonic moves as he does; bridges to code | Medium | Understanding |
| Hacking CulT | Unstable, historical | Avoid; superseded | n/a | n/a |

- **Plutiedev** is likely the best reference for the AI tutor to ground its hardware explanations. Its self-declared non-beginner focus means learners should meet it as "reference reading" late in the SGDK and 68k tracks, not as lessons.
- **Ohsat's tutorials teach recipes in a strong order.** Because lesson 1 assumes C, Windows and the command line, the app should (a) put a C track first, and (b) have the tutor fill in the "why" (VBlank, VRAM, tile indexes) that Ohsat defers. API names from 2019–2021 should be checked against SGDK 2.11 before being used. The tutor should prefer SGDK's own samples and Doxygen when they disagree.
- **MarkeyJester is the best CPU-only 68k primer for beginners**, and it is what the Sonic community still points to. It stops before any hardware, so pair it with the BEC/ChibiAkumas Genesis-specific material for the hardware half.
- **Assembler syntax fragmentation is a real hazard for an AI tutor.** Tanglewood uses ASM68K/SNASM68K, ChibiAkumas and GameHut use VASM, and the Sonic Git disassemblies use the build scripts' assembler (AS/asm68k varies by repo; verify). The tutor should fix one assembler per track and flag directive differences.
- **On Mac**, SGDK needs MarsDev, Wine or Docker, and EASy68K needs Wine. The app may need to provide its own sandbox (for example, an in-app 68k simulator or emulator) for early asm lessons.
- **Sega Retro's bot protection** means an app that fetches docs live cannot rely on Sega Retro. Plutiedev, GitHub and Sonic Retro were fetchable.

### Gaps
- **"Danthrax4"**: no SGDK videos or tutorials under this name were found. It may be a misremembered name; possibly Danibus, the Spanish SGDK tutorials linked from the SGDK README. Not confirmed.
- **Sega Retro** blocked automated access (Anubis), so the full list and dates of individual Technical Bulletins couldn't be verified. No published errata list for the Genesis Software Manual was found.
- **Charles MacDonald's original site** (and any genvdp revision newer than v1.5f) wasn't found. Only mirrors were confirmed.
- **Accuracy of ChibiAkumas and Hugues Johnson** wasn't independently reviewed by a third party. Their publication dates and Hugues Johnson's assembler weren't visible.
- **Ohsat vs. SGDK 2.11**: which specific Ohsat lessons break was not determined. Only the VSync rename and the SND/XGM renames are confirmed as relevant changes.
- **Pigsy**: the current YouTube episode list and the newest upload date weren't checked.
- **GameHut "Learn To Code!"**: dates and episode list weren't confirmed.
- **Hacking CulT**: whether hacking-cult.org is online in Nov 2026 wasn't checked.
- **Mega Drive wiki**: coverage beyond the main page (YM2612/PSG/Z80 pages) wasn't verified.
- **r/SEGAGENESIS** resource threads and SpritesMind "where to start" sticky threads weren't retrieved. Stickies aren't visible on the forum index.
- **"Mega Drive Megadev" as a book**: no such book was found. "Megadev" is drojaazu's Mega CD framework.
- **EASy68K after 2013**: no newer release was confirmed.

---

## Q2. Teaching sequence: how the best tutorials order topics, and a recommended lesson roadmap per track (C, C++, SGDK, 68k on Genesis, Sonic hacking)

### Takeaway
The community's consensus order is: learn C (SGDK) first and assembly later. Within SGDK, use project-based units in Ohsat's order: Pong → endless runner → shooter → tile game. Within 68k, learn the CPU first (MarkeyJester's order: memory/registers → MOVE → arithmetic → bit ops → signed values → flow/subroutines → flags and branches). Then do hardware in Big Evil Corp's order: boot → VDP/text → sprites → input and game loop → animation → planes/scrolling → sound. Sonic hacking comes last and is disassembly-based (Git disasm + Git + SonLVL/Flex 2 + debugger). The C track can follow CS50's Week 1–5 progression (C → arrays → algorithms → memory → data structures) with game-flavored problems. C++ is an optional side track, since SGDK is C-first and C++ on the Mega Drive is niche.

### Cited Findings
- **Order across tracks:** a r/retrogamedev commenter recommends SGDK for its community and library. A SpritesMind post notes that SGDK lets you write C and drop to asm when needed, but lacks a unified tutorial. — [r/retrogamedev mirror](https://lr.in.psf.lt/r/retrogamedev/comments/1dj9ae0/getting_into_retro_development); [SpritesMind](https://gendev.spritesmind.net/forum/viewtopic.php?p=25687)
- **Sonic hacking prerequisites:** pick a disassembly, set up an editor, "learn basic 68k" (MarkeyJester), then learn the tools. Leave music for later and use Git throughout. — [Clownacy 2025](https://forums.sonicretro.org/goto/post?id=1097465)
- **CS50's novice order:** Scratch → C → Arrays → Algorithms → Memory → Data Structures. Most learners have no prior CS. — [CS50x 2026](https://cs50.harvard.edu/x/)
- **SGDK official tutorial order:** Introduction → Hello World → Background → Sprites → Input → Maths. — [SGDK wiki](https://github.com/Stephane-D/SGDK/wiki)
- **Ohsat project order:**
  - Megapong: hello world → setup → resources → palettes → sprites → input → collisions → score/HUD → game over.
  - Megarunner: framework → tiles → scrolling → player/obstacles → jumping math → collision/score.
  - Megalaga: background → entities → enemies → movement → bullets → collision/HUD → enemy bullets → spam protection → sound.
  - Megatiler: tiles → player → tile movement → coins → HUD/sound/exit → loading levels.

  — [Ohsat](https://www.ohsat.com/tutorial/)
- **BEC 68k-on-Genesis order:** getting started → what assembly is → boot ("Awaking the Beast") → Hello world → fonts/text → sprites → gamepad and game loop → animated sprites → maps and scrolling planes → PSG sound. — [BEC blog](https://blog.bigevilcorporation.co.uk/)
- **MarkeyJester CPU order:** memory/registers/MOVE/addressing → ADD/SUB/SWAP/EXG/CLR → NOT/AND/OR/EOR/BSET → signed/unsigned, NEG/EXT, shifts, MUL/DIV → PC/JMP/BRA/stack/JSR/RTS/BSR → CCR/CMP/TST/Bcc, signed vs unsigned branches → Scc. — [MarkeyJester](https://mrjester.hapisan.com/04_MC68/)
- **ChibiAkumas order:** beginner concepts → getting started → addressing modes → loops and conditions → stack/traps/maths → bits → extends/macros. Then per-platform hello world, then platform lessons (bitmaps, joystick, palettes, sound, sprites, tilemaps), then complete games (YQuest, Photon). — [ChibiAkumas](https://www.chibiakumas.com/68000/)
- **Hugues Johnson order (intermediate 68k game structure):** palettes → tiles/sprites → animation → sound (Echo) → collision → scrolling → NPCs → game state/pausing → object list → sprite link list → scenes/dialog → … → saving/loading → 6-button → randomness. — [Hugues Johnson](https://huguesjohnson.com/topics/68k-programming/)
- **Pigsy's SGDK topics** include number sizes (8/16/32-bit), 256 low-res mode, camera, parallax and palette cycling. — [Patreon sitemap](https://www.patreon.com/PigsysRetroGameDevTutorials/sitemap)
- **Plutiedev's "Game programming" section** puts fixed point, angles, speed/gravity, collision and sprite sorting before hardware specifics. — [Plutiedev](https://plutiedev.com/)
- **Sonic guides** (e.g. Spin Dash for Sonic 1) are written against specific disassemblies. — [SCHG Spin Dash](https://info.sonicretro.org/SCHG_How-to:Add_Spindash_to_Sonic_1)
- The **SPG** documents the physics constants and sensors that hacks modify. — [SPG](https://info.sonicretro.org/Sonic_Physics_Guide)
- **C++ on the Mega Drive:** SGDK is a C kit. C++ options are ClownMDSDK (C/C++ with an embedded C++ standard library subset) and the 2022 SGDKplusplus fork. — [SGDK README](https://github.com/Stephane-D/SGDK); [ClownMDSDK listing](https://relatedrepos.com/gh/Clownacy/clownmdsdk); [SGDKplusplus listing](https://relatedrepos.com/gh/paspallas/SGDKplusplus)
- **learncpp.com** is still maintained (2025 revisions) and starts from the very basics. — [learncpp changes](https://learncpp.com/latest-changes); [hackr.io](https://hackr.io/blog/cpp-tutorial-review)

### Inferences
These roadmaps are synthesized recommendations: the ordering comes from the cited tutorials, and the lesson design is my own. Items marked "(verify)" depend on background knowledge to check against Plutiedev, the Sega manual or the Motorola 68000 Programmer's Reference Manual (linked from ChibiAkumas).

**Overall track order:**
1. C fundamentals
2. SGDK games
3. 68k asm (CPU, then Genesis hardware)
4. Sonic hacking

C++ is an optional branch after C, useful for writing PC-side tools or for ClownMDSDK. Each track reuses one running project idea (move a sprite, then Pong) so the learner sees the same game in C on a PC, in SGDK and in 68k assembly. That makes the abstraction layers visible.

#### Track 1: C fundamentals (20 lessons; PC first, modeled on CS50 Weeks 1–5 but game-flavored)
Rationale: fast feedback with printf on a PC before the opacity of a console. Integer and fixed-point emphasis prepares for the 68000, which has no FPU (verify).

1. **How a computer runs a program**: describe the CPU, memory and a program as a list of steps; compile vs. run; build and run "hello".
2. **Your first C program**: main, printf, statements and semicolons; read a compiler error message and fix it.
3. **Variables and types**: int, char, unsigned; sizeof; show integer overflow with an 8-bit counter.
4. **Fixed-width integers**: uint8_t/int16_t/uint32_t; why a game console cares about sizes (bridge to SGDK's u8/s16/u32).
5. **Arithmetic**: integer division and modulo, operator precedence, casts; compute the screen center or wrap a position.
6. **Decisions**: if/else, comparisons, && and ||; the = vs == trap; keep a paddle inside the screen bounds.
7. **Loops**: while and for, off-by-one errors, trace tables; draw an ASCII box; spot an accidental infinite loop.
8. **Functions**: parameters, return values, scope; split a game loop into update() and draw().
9. **Binary, hex and bitwise operators**: &, |, ^, ~, << and >>; pack 8 buttons into one byte and test bits (the joypad idea).
10. **Arrays**: indexing, bounds, iterating; a row of enemies; out-of-bounds bugs.
11. **2D arrays as tile maps**: a grid map, drawing it, and a collision lookup in the grid.
12. **Strings**: char arrays, the null terminator, printing a score with sprintf.
13. **Memory and addresses**: draw memory as numbered boxes; the & operator; print addresses.
14. **Pointers I**: declare, dereference, pass by pointer; write swap(); draw box-and-arrow diagrams.
15. **Pointers II**: pointer arithmetic, arrays decaying to pointers, const data and read-only "ROM" tables.
16. **Structs and typedef**: an Entity {x, y, vx, vy, active}; arrays of structs; pass a struct by pointer.
17. **Enums and state machines**: title, play, pause and game-over states; switch statements.
18. **Fixed-point math**: why consoles avoid floats; 8.8 and 16.16 numbers; velocity, gravity and a jump arc (Plutiedev fixed point; Ohsat "jumping math").
19. **Multi-file programs and make**: headers, extern/static, a simple Makefile; read linker errors.
20. **Algorithms for games, plus a debugger**: AABB collision, linear search, simple sorting (CS50 Week 3); stepping through code in a debugger.

Capstone (PC, text mode): **Terminal Pong or a grid "tile mover"** using structs, a state machine, fixed-point ball velocity and bit-flag input. It is later re-implemented in SGDK.

#### Track 2: C++ fundamentals (15 lessons; optional, after C; learncpp as the reference)
Rationale: SGDK is C; C++ pays off for PC tools (asset converters) and for ClownMDSDK. Teach a "zero-cost subset" mindset for the console (no exceptions or RTTI, little heap use; verify against ClownMDSDK docs).

1. **From C to C++**: compile C++, namespaces, iostream vs printf; what carries over from C.
2. **References**: references vs pointers, const references, when to use each.
3. **Safer types**: enum class, constexpr, auto, uniform initialization.
4. **Classes**: an Entity class with member functions; public vs private.
5. **Constructors, destructors and RAII**: object lifetime; a file-handle wrapper; tie this to C's manual cleanup.
6. **Operator overloading**: write a Fixed16 class with +, - and * (connects to C lesson 18).
7. **Function overloading and default arguments**.
8. **Templates I**: function templates, std::array<T,N>; a fixed-size entity pool template.
9. **The standard library on a PC**: vector, string, algorithms, lambdas; why these are heavy on a 64 KB-RAM console (verify RAM size).
10. **Inheritance and virtual functions**: polymorphic enemies; the cost of vtables; composition as an alternative.
11. **Memory**: new/delete, unique_ptr; static pools and placement on embedded targets.
12. **Build systems and mixing C/C++**: CMake basics; extern "C" for calling C libraries such as SGDK-style code.
13. **Tool project I**: a PNG → 4bpp tile + palette converter (reinforces the tile format).
14. **Tool project II**: a level-text → binary map converter with validation.
15. **C++ on the Mega Drive (optional)**: a ClownMDSDK hello world; port the Pong entity code to classes; compare the generated code size with C.

Capstone: an **asset converter** used by the learner's own SGDK game, or Pong in C++ via ClownMDSDK.

#### Track 3: SGDK game development (24 lessons; ordered after the SGDK wiki and Ohsat; Pigsy for art and scrolling)
1. **Inside the Mega Drive**: CPU, VDP, VRAM/CRAM, planes A and B, sprites, Z80, YM2612/PSG; no OS (Computerphile).
2. **Toolchain and emulator setup**: SGDK 2.11 on Windows, or MarsDev/Docker on Mac or Linux; BlastEm; build and run a ROM.
3. **Hello Mega Drive**: VDP_drawText; the main loop; SYS_doVBlankProcess and frames (60 Hz NTSC / 50 Hz PAL).
4. **The tile and palette model**: 8×8 tiles, 4 bits per pixel, 16-color palettes ×4, color 0 is transparent (verify); draw graphics in Aseprite.
5. **Resources with rescomp**: .res files and IMAGE/SPRITE/PALETTE declarations; reading build errors.
6. **Palettes**: load palettes, color swapping, fades.
7. **Backgrounds and planes**: draw an image to BG_A/BG_B; tile indexes and attributes (priority, flip, palette).
8. **Sprites**: the sprite engine, adding a sprite, setting its position, update per frame.
9. **Input**: read the joypad and test button bitmasks; callbacks vs polling. **Mini-project: move a sprite around the screen.**
10. **Pong I**: paddles and a ball with velocity; bounding.
11. **Pong II**: collisions, score/HUD text, game over, restart. **Project 1: Megapong.**
12. **Fixed-point physics in SGDK**: fix16/fix32 types; gravity and jumping (SGDK "Maths", Ohsat "jumping math").
13. **Scrolling**: plane scrolling, parallax layers, tile scrolling (Pigsy parallax; Megarunner).
14. **Endless runner**: obstacles, spawning, difficulty ramp. **Project 2: Megarunner.**
15. **Entity pools**: arrays of structs for enemies and bullets; activate and deactivate without malloc.
16. **Collision systems**: sprite-vs-sprite AABB; tile-map collision lookups.
17. **Sound and music**: XGM music, sound effects, the PSG; when to trigger them (Megalaga 9; Ohsat music lessons).
18. **Game states and menus**: title, pause, menu cursor; handling reset (Ohsat misc lessons).
19. **Animation**: sprite animation frames, animated tiles, palette cycling (Pigsy).
20. **Shooter project**: enemy formations, bullets, power-up. **Project 3: Megalaga-style shmup.**
21. **Tilemaps, levels and camera**: map-editor export, scrolling maps, a 2D camera (Ohsat "Scrolling Maps"; Pigsy camera).
22. **Frame budget and DMA**: VBlank time, DMA queue, sprite-per-line limits (verify against Plutiedev); profiling.
23. **ROM header, region, save data**: the header fields, region check, SRAM saves (Ohsat; Plutiedev SRAM).
24. **Reading real code**: walk through SGDK's Sonic sample and the Doxygen docs.

Capstone: **a one-level platformer** combining the camera, tile collision, fixed-point jumping, animation, music and states. Then read Plutiedev's homebrew guidelines before any release.

#### Track 4: 68000 assembly on Genesis (26 lessons; Part A follows MarkeyJester/ChibiAkumas, Part B follows Big Evil Corp, with Hugues Johnson for structure)
Part A runs in a simulator or debugger view (EASy68K is Windows-only and from 2013, so the app may need its own sandbox). Part B runs in an emulator with a debugger (BlastEm/ClownMDEmu/Exodus). Pick one assembler (for example VASM, as in ChibiAkumas and GameHut, or asm68k-compatible to match Sonic disassemblies) and stay with it.

Part A: the CPU
1. **Bits, nybbles, bytes, words, longs**: binary and hex conversion; hex as nybble shorthand (MarkeyJester S1P1).
2. **Memory and addresses**: big-endian byte order; the Genesis memory map in outline (ROM low, 64 KB work RAM at $FF0000; verify).
3. **Registers**: D0–D7, A0–A7 (A7 is the stack pointer), PC, SR/CCR; what each is for.
4. **MOVE and sizes**: .b, .w and .l; immediate (#) vs memory operands; what a partial-size write leaves in a data register (verify).
5. **Addressing modes I**: Dn, An, #imm, absolute, (An); load from a table.
6. **Addressing modes II**: (An)+, -(An), d16(An), d8(An,Xn), PC-relative; walk through an array of structs.
7. **Arithmetic**: ADD/SUB/ADDQ/SUBQ/ADDI, NEG, EXT, CLR, SWAP, EXG.
8. **The condition codes**: X, N, Z, V, C; which instructions set them; TST and CMP.
9. **Branching**: BRA/Bcc; signed (BLT/BGT) vs unsigned (BCS/BHI) comparisons (MarkeyJester S6).
10. **Loops**: DBRA/DBF countdown semantics (load n−1; verify); loops over tables.
11. **Bit operations and shifts**: AND/OR/EOR/NOT, BTST/BSET/BCLR, LSL/LSR/ASL/ASR/ROL; multiply by shifting.
12. **Multiply and divide**: MULU/MULS/DIVU/DIVS and their sizes and costs (MarkeyJester cycle tables); avoid them in hot loops.
13. **Subroutines and the stack**: BSR/JSR/RTS, pushing and popping, MOVEM to save registers; a calling convention.
14. **Assembler directives and data**: labels, equ, dc.b/dc.w/dc.l, include, macros, alignment (even); struct offsets via rs (assembler-specific; verify).

Part B: the Genesis hardware
15. **Boot**: the vector table, ROM header, TMSS handshake, init code (BEC "Awaking the Beast"; Plutiedev ROM header).
16. **Talking to the VDP**: control and data ports, register writes, VRAM/CRAM write commands (Plutiedev "Setting up the VDP" and "Writing to video memory").
17. **Palettes**: the CRAM color format; turn the screen a color (first visible result; Hugues Johnson Part 1).
18. **Tiles, planes and text**: load a font into VRAM, write the name table, print "Hello World" (BEC 4–5).
19. **Sprites**: the sprite attribute table, size bits, the link field; show a sprite (BEC 6; Hugues Johnson Part 2 and Part 10).
20. **VBlank interrupt and game loop**: the interrupt handler, waiting for vsync, a frame counter (BEC 7).
21. **Reading the joypad**: I/O port protocol for 3- and 6-button pads (Plutiedev controllers; Hugues Johnson Part 19). **Mini-project: move a sprite.**
22. **DMA and animation**: DMA transfers to VRAM; frame-based sprite animation (BEC 8; Plutiedev DMA).
23. **Scrolling**: the hscroll table and modes, VSRAM; scroll a plane with the d-pad (BEC 9; Hugues Johnson Part 6).
24. **Sound**: PSG tones and noise (BEC 10); the YM2612 via a driver (Echo) or the Z80 (ChibiAkumas P20/P21).
25. **Game structure in asm**: object lists, state machines, collision, pseudorandomness (Hugues Johnson Parts 5, 8, 9, 24).
26. **Capstone: Pong in assembly**: then compare it with the SGDK Pong (and with the compiler's output). Optional reading: one subsystem of the Tanglewood source.

Mini-projects across the track: an in-simulator "sum a table" (after A10), a colored screen (B17), Hello World (B18), move a sprite (B21), scrolling starfield (B23), Pong (B26).

#### Track 5: Sonic ROM hacking (16 lessons; modeled on Clownacy's 2025 path; needs 68k Part A plus B15–B20)
1. **ROMs vs. disassemblies**: what a split disassembly is and why the community edits source instead of ROMs.
2. **Setup**: clone s1disasm, run the build script, run the ROM in an emulator with a debugger.
3. **Git habits**: commit before every change, diff, revert; find a bad commit when a build breaks.
4. **Touring the code**: folder layout, the main loop and game modes, the object routines; follow labels.
5. **First edits**: change starting rings and lives; change speed constants and relate them to the SPG (acc 0.046875 = 12/256 of a pixel per frame; the arithmetic is mine, check the constant in the code).
6. **The RAM map**: player object fields, global variables (SCHG RAM tables are still useful).
7. **Palettes**: edit palette data, palette cycling.
8. **Art and mappings**: Flex 2/ClownMapEd; compressed art formats and mdcomp/ClownCompTool.
9. **Levels**: SonLVL layouts, chunks and blocks, collision data.
10. **Objects**: object slots, routine counters, spawning; tweak a badnik's behavior.
11. **Player physics**: read the SPG (running, jumping, slopes, sensors) and map it to the player code; change jump height.
12. **Following a guide**: add the Spin Dash to Sonic 1 (SCHG; check that the disassembly version matches).
13. **Debugging crashes**: install Flamewing's or Vladikcomper's error handler; read the exception screens.
14. **Bug-fix guides**: apply the common Sonic 1/2 fixes; understand why each bug happened.
15. **New ability or object**: design and implement something small (for example an air dash).
16. **Sound (advanced, later)**: what SMPS is; driver ports (S2 Clone Driver v2, Flamedriver); music conversion is hard.

Capstone: **a small, polished hack** (one modified zone, a new ability, new palette and art) shared with the SHC/SSRG/MDDC communities.

### Gaps
- No source evaluated a complete Genesis curriculum against learner outcomes. All sequencing above is inferred from how individual tutorials order topics.
- C++-on-Mega-Drive resources are thin. ClownMDSDK's docs and stability weren't directly reviewed; only a secondary listing was found.
- Which assembler each current Sonic Git disassembly uses (AS vs asm68k) wasn't verified this session.
- The Genesis-specific facts marked "(verify)" in the lesson list come from background knowledge and should be checked against Plutiedev, the Sega manual or the Motorola manual. These include the RAM address, sprite-per-line limits, color-0 transparency, TMSS, DBRA semantics and partial register writes.

---

## Q3. Common conceptual stumbling blocks for beginners (C: pointers and memory; 68k: hex/binary, addressing modes, flags) and how good tutorials explain them

### Takeaway
CS education research says novices fail mostly for lack of an accurate mental model of the machine (the "notional machine"), especially for pointers, stacks and references. The recommended fix is to teach that model explicitly with memory and stack diagrams. The best 68k tutorials do this structurally:
- MarkeyJester builds from bits up and treats hex as nybble shorthand.
- ChibiAkumas gives addressing modes a full lesson.
- MarkeyJester teaches signed/unsigned before conditional branches and splits branches into signed and unsigned sets.
- Plutiedev and Pigsy have standalone number-base and number-size lessons.

Console-specific confusion comes from there being no OS: you must set up the VDP yourself, and video memory sits behind ports.

### Cited Findings
- Sorva's 2013 review argues that instructors should make the notional machine an explicit learning objective. — [Sorva 2013 (Crossref)](https://api.crossref.org/works/10.1145%2F2483710.2483713)
- Students start with a weak grasp of stacks and environments. An accurate stack depiction tied to name bindings is central to a notional machine. — [Clements & Krishnamurthi (Brown)](https://cs.brown.edu/people/sk/Publications/Papers/Published/ck-nm-stacks/paper.pdf)
- Lacking a useful mental model of pointers is one reason many novices fail data-structures courses. Pointers remain among the hardest beginner concepts. A study used a program-visualization tool with worked examples and follow-up questions to improve pointer mental models (value vs. address assignment). — [Pointer mental models study (cyberleninka)](https://cyberleninka.ru/article/n/the-impact-of-combining-follow-up-questions-and-worked-examples-in-program-visualization-tool-on-improving-students-held-mental)
- Students often form incomplete notional machines that cause errors. Chiarelli & Muldner compared tutors that teach the notional machine directly with ones that don't. — [Chiarelli & Muldner (eScholarship)](https://escholarship.org/uc/item/5z5024gz)
- Confusion between an object and a reference to it ("reference-point errors") is attributed to deficient mental models, notional-machine misconceptions and everyday language habits. — [Miller, PPIG 2016](https://ppig.org/files/2016-PPIG-27th-Miller.pdf)
- A few bug types account for most novice errors. Misconceptions about specific constructs were less widespread than expected. — [Garner et al. 2005](https://www.cs.auckland.ac.nz/courses/compsci747s2c/lectures/garner.ea-program-ace-05.pdf)
- CS50 puts "Memory" (Week 4) only after C, arrays and algorithms, and before data structures. — [CS50x](https://cs50.harvard.edu/x/)
- learncpp's 2025 revisions added material on unintentional infinite loops and revised integer types and bitwise operators. These are areas where learners evidently stumble. — [learncpp changes](https://learncpp.com/latest-changes)
- Hex/binary: MarkeyJester teaches bits → nybble → byte → word → long, maps each nybble to one hex digit with a three-base table, and shows carrying in hex (9F + 1 = A0). — [MarkeyJester S1P1](https://mrjester.hapisan.com/04_MC68/Sect01Part01/Index.html)
- Plutiedev has a "decimal/binary/hex" article and a fixed-point article in its Game programming section. Pigsy has a lesson on 8/16/32-bit numbers. — [Plutiedev](https://plutiedev.com/); [Pigsy Patreon sitemap](https://www.patreon.com/PigsysRetroGameDevTutorials/sitemap)
- Signedness and flags: MarkeyJester's Section 4 (bit significance, signed/unsigned, NEG/EXT) comes before Section 6 (the CCR, CMP/TST/BTST, Bcc), which explicitly separates signed and unsigned branches and sets. — [MarkeyJester TOC](https://mrjester.hapisan.com/04_MC68/)
- Addressing modes: ChibiAkumas devotes lesson 2 entirely to them, and has separate lessons for loops/conditions and the stack. — [ChibiAkumas](https://www.chibiakumas.com/68000/)
- The console has no operating system or drivers, so the game must set up the VDP itself. That is why even "Hello World" is involved. — [Computerphile Hello World](https://rosetta.to/u/computerphile/hello-world-on-sega-megadrive-computerphile)
- Ohsat's first SGDK lesson deliberately defers VBlank details ("you don't need" them yet). That is scaffolding, but it leaves a conceptual gap. — [Ohsat Megapong 1](https://www.ohsat.com/tutorial/megapong/megapong-1/)
- The Sonic hacking community keeps a "Beginner Mistakes" page and forum guides on common bugs and assembler errors. — [SCHG Beginner Mistakes](https://info.sonicretro.org/SCHG:Beginner_Mistakes); [Clownacy 2025](https://forums.sonicretro.org/goto/post?id=1097465)
- Mixed disassemblies trip up beginners: guides target different disassemblies, and the Git versions change often. — [Clownacy 2025](https://forums.sonicretro.org/goto/post?id=1097465)

### Inferences
Stumbling blocks the AI tutor should anticipate, with suggested explanations. These are my synthesis. Items marked (verify) are background knowledge to confirm against the Motorola 68000 Programmer's Reference Manual linked from ChibiAkumas.

**C**
- **Pointers.** Always draw memory as numbered boxes (address | value) before introducing `*` and `&`, following the notional-machine research. Drill "value vs. address" with predict-then-run exercises. Use visualizers (Python Tutor-style memory diagrams for C). Then reuse the same box diagram in 68k lessons: an address register is just a pointer.
- **Arrays vs. pointers, and out-of-bounds access.** Show that `a[i]` is "start address + i × size". Make an out-of-bounds write corrupt a neighboring variable on purpose, so undefined behavior becomes concrete.
- **Integer sizes and overflow.** Use an 8-bit counter wrapping from 255 to 0. On the Mega Drive, sizes matter because SGDK uses u8/s16/u32 and the CPU is fastest on 16-bit (verify). This sets up fixed-point.
- **Fixed-point instead of floats.** Present 8.8 as "the top byte is whole pixels, the bottom byte is fractions of a pixel". Link it to Sonic's 0.046875 acceleration as 12/256 (from the SPG).
- **`=` vs `==`, off-by-one errors, infinite loops.** These are high-frequency bugs (Garner et al.; learncpp). The tutor should recognize them on sight in learner code.
- **Stack and scope.** Pair C function calls with a stack diagram. That prepares for JSR/RTS and the 68k stack.

**68k assembly**
- **Hex and binary.** Use the nybble-per-digit method (MarkeyJester), with drills converting button masks and colors. On the Mega Drive, CRAM colors are 3-bit-per-channel values packed into a word (verify), which makes hex practice meaningful.
- **Operand size (.b/.w/.l).** Show register contents before and after a byte or word MOVE into a data register, where only the low part changes. Also cover how word writes to address registers are sign-extended (verify).
- **Immediate vs. memory.** A missing `#` silently reads memory instead of using a constant (verify). The tutor should check for this first when a learner's value is "random".
- **Addressing modes.** Map each mode to a C equivalent: `(a0)` is `*p`, `(a0)+` is `*p++`, `-(a7)` is a push, `8(a0)` is `p->field`, `(a0,d0.w)` is `p[i]`. This reuses the C pointer model.
- **Flags.** Teach the CCR as "the result's report card". Show which instructions set flags; MOVE does, and MOVE to an address register does not (verify). Teach that CMP computes destination − source. Separate signed and unsigned branches early, following MarkeyJester's ordering.
- **DBRA loop counts.** It counts down to −1, so load n−1 (verify). This is a classic off-by-one error.
- **Word alignment.** Word or long accesses at odd addresses cause an address error on the 68000 (verify). Use `even` directives after byte data.
- **Saving registers in subroutines.** Use MOVEM in and out, and explain it with the stack diagram from C.
- **Video memory is not normal memory.** VRAM/CRAM/VSRAM are reached through VDP ports with command words, not pointers (verify against Plutiedev's "Writing to video memory"). This "no OS, set up the VDP yourself" step is the biggest conceptual jump in the hardware half.
- **Assembler dialect confusion.** Directives and local-label syntax differ between ASM68K, VASM and AS. Pin one per track and show the equivalents when learners copy from other tutorials.

**Sonic hacking**
- **Guide/disassembly mismatch.** This is the most common source of frustration. Always state which disassembly and commit a guide targets.
- **Editing without version control.** Make Git compulsory from lesson 1, as the community advises.

### Gaps
- No empirical studies of novice misconceptions specific to 68000 or other assembly languages were found. The 68k advice above extrapolates from general CS-education research and from how tutorials are structured.
- The full pointer-study findings weren't read; only its framing from the abstract.
- The specific pedagogical content of MarkeyJester's later sections (addressing and CCR pages) and of ChibiAkumas's lesson pages wasn't fetched. Only their TOCs and MarkeyJester S1P1 were examined.
- The 68000 behaviors marked (verify) were not checked against the Motorola manual in this session.
