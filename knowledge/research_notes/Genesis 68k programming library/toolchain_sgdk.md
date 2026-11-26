# Sega Genesis / Mega Drive toolchains on macOS (Apple Silicon): assemblers, SGDK, asset tools

Research date: 2026-11-18. Every claim has a source; anything I could not check is under Gaps. "Verified" means I read the primary source (repo file, GitHub API metadata, official homepage, or official manual) on 2026-11-18. I did not download or run any binaries. I did read page text, and GitHub/Homebrew/Compiler Explorer JSON metadata, with curl.

---

## Q1. Which 68k assemblers exist, and how do they compare (license, macOS arm64 build, version, syntax, silent optimizations, errors, binary/listing/symbol output)?

### Takeaway
There are three realistic open candidates to bundle in a Mac app:
- **The Macroassembler AS** (asl + p2bin), GPL-2.0. It is the assembler of the Sonic Retro disassemblies, and those repos already ship Mac arm64 binaries.
- **clownassembler**, AGPL-3.0+, a C++20 + CMake clone of SN Systems' asm68k.
- **GNU as** (m68k-elf binutils), GPL-3.0. Homebrew has arm64 bottles, and SGDK needs it anyway.

**vasm** is technically excellent, but its license allows only unmodified redistribution for non-commercial use, unless the author gives written consent. It also optimizes silently by default. **asm68k/SNASM68K** are proprietary Windows/DOS executables and cannot be bundled.

### Cited Findings

**The Macroassembler AS (asl / p2bin)**
- Upstream homepage: latest build is "1.42 Bld 316", the changelog entry is dated 2026-11-07, and the homepage says 2026-11-08. It is distributed under the GNU GPL and may be used commercially or non-commercially at no cost. — [AS homepage](http://john.ccac.rwth-aachen.de:8000/as/); [AS changelog](http://john.ccac.rwth-aachen.de:8000/as/changelog)
- Upstream offers C sources (`asl-current.tar.gz/.bz2`) and prebuilt binaries for Win32 and DOS/DPMI only. There is no prebuilt macOS binary from upstream. — [AS download page](http://john.ccac.rwth-aachen.de:8000/as/download.html)
- Build system: you pick a platform `Makefile.def` from `Makefile.def-samples` (or adapt `Makefile.def.tmpl`) and run make. — [AS manual (English)](http://john.ccac.rwth-aachen.de:8000/as/as_EN.html)
- Upstream has supported building on Apple systems since about January 2012. The author's essay describes the delay in adding it. — [AS "Apple version" story](http://john.ccac.rwth-aachen.de:8000/as/no-apple.html)
- **Sonic fork.** The Sonic Retro disassemblies use "Flamewing's modified version of The Macro Assembler AS", now hosted at github.com/Clownacy/asl-releases (GPL v2). — [s1disasm build_tools/AS.txt](https://github.com/sonicretro/s1disasm/blob/master/build_tools/AS.txt)
- Clownacy/asl-releases is a fork of flamewing/asl-releases, GPL-2.0, described as an "Improved/bugfixed version of Alfred Arnold's The Macro Assembler AS". Its last push was 2025-07-13, so it may lag upstream Bld 316. Build steps: copy a platform file from `Makefile.def-samples` to `Makefile.def`, then run `make binaries` and `make install`. The README says this was tested on macOS Catalina, which is old. — [Clownacy/asl-releases](https://github.com/Clownacy/asl-releases) (GitHub API metadata and README)
- The fork's README lists behaviour changes from newer AS that break older disassemblies:
  - includes are resolved relative to the current file;
  - `moveq` errors on values that don't sign-extend, instead of silently accepting them;
  - `phase`/`dephase` must be matched like a stack;
  - char constant plus integer stays a char constant.
  — [Clownacy/asl-releases README](https://github.com/Clownacy/asl-releases)
- The s1disasm and s2disasm repos ship prebuilt `asl` and `p2bin` for many platforms, including `build_tools/Mac-arm` (asl about 2.9 MB, p2bin about 70 KB) and `Mac-x86_64`. — [s1disasm build_tools](https://github.com/sonicretro/s1disasm/tree/master/build_tools) (GitHub API listing)
- The `p2bin` used by the disassemblies is Clownacy's separate p2bin (github.com/Clownacy/p2bin). s1disasm passes it `-p=FF -z=0,kosinski,...`, i.e. pad with $FF and compress the sound driver with Kosinski at build time. — [s1disasm build.lua](https://github.com/sonicretro/s1disasm/blob/master/build.lua); [s1disasm common.lua](https://github.com/sonicretro/s1disasm/blob/master/build_tools/lua/common.lua)
- How the disassemblies invoke AS: `asl -xx -n -q -A -L -U -E -i . [-c] ...`. The script's comments say `-xx` "shows the most detailed error output" and `-E` writes errors to a `.log` file. `-L` produces a listing. `-c` makes a `.h` header used to pass symbol values to p2bin. AS writes an intermediate `.p` object, which p2bin turns into the ROM `.bin`. — [s1disasm common.lua](https://github.com/sonicretro/s1disasm/blob/master/build_tools/lua/common.lua)
- **AS syntax specifics** (official manual):
  - Operators differ from C and from most 68k assemblers:
    - `!` = binary XOR
    - `^` = power (not XOR)
    - `#` = modulo
    - `~~` = logical NOT
    - `!!` = logical XOR
    - `><` = bit mirror
    - `|` = OR, `&` = AND, `~` = NOT
  - Temporary/local labels come in three kinds:
    - named temporary `$$name`;
    - nameless `+`/`-`;
    - "composed" `.name`, where the last non-dot label is prepended (`proc1:` then `.loop` defines `proc1.loop`).
  - Binary include is `BINCLUDE file[,offset[,length]]`.
  - `PADDING` (auto-insert a pad byte so DC data doesn't sit on an odd address) "is by default only enabled for the 680x0 family".
  - "AS always tries to generate the shortest code possible", choosing branch and address lengths over multiple passes. The manual advises giving explicit sizes.
  — [AS manual (English)](http://john.ccac.rwth-aachen.de:8000/as/as_EN.html)
- AS debug output: `-g` writes debug info in the AS-specific MAP format, NoICE command-file format, or Atmel format. — [AS manual (English)](http://john.ccac.rwth-aachen.de:8000/as/as_EN.html)

**clownassembler (asm68k clone)**
- It is a "Motorola 68000 assembler … [that] mimics the behaviour of SN 68k (also known as 'asm68k')". SN's manual (SATMAN.pdf) applies to it. — [clownassembler README](https://github.com/Clownacy/clownassembler)
- License: AGPLv3+ (GitHub API: `AGPL-3.0`). — [clownassembler](https://github.com/Clownacy/clownassembler)
- Build: "portable C++20", with a CMake build script. Flex and Bison are needed only to regenerate the lexer and parser. It builds two executables: `clownassembler_asm68k`, with SN's command-line interface, and `clownassembler`, with a simpler interface. — [clownassembler README](https://github.com/Clownacy/clownassembler)
- Version: there are no tagged releases. `master` was last pushed 2026-11-06. An older ANSI C codebase lives on the `ansi-c` branch. — [clownassembler](https://github.com/Clownacy/clownassembler) (GitHub API + README)
- Output options of the simple front end:
  - `-o` output;
  - `-l` listing file;
  - `-s` "asm68k-style symbol file";
  - `-v` include local labels in the symbol file;
  - `-a` automatic-even mode;
  - `-c` case-insensitive;
  - `-e X=Y` defines;
  - `-p` silence pedantic warnings;
  - `-w` silence warnings;
  - `-.X` sets the local-label signifier, "default '@'".
  — [clownassembler source/frontend/custom.cpp](https://github.com/Clownacy/clownassembler/blob/master/source/frontend/custom.cpp)
- Its option struct exposes only one optimisation toggle, `optimisation.zero_displacement`. So clownassembler does not do vasm-style instruction rewriting. — [clownassembler source/options.h](https://github.com/Clownacy/clownassembler/blob/master/source/options.h)
- The source tree has `listing.cpp` and `p2bin.cpp` modules. — [clownassembler source tree](https://github.com/Clownacy/clownassembler/tree/master/source)

**asm68k / SNASM68K (SN Systems / Cross Products, proprietary)**
- TANGLEWOOD's README says it builds with SNASM68K.EXE (16-bit, v2.02Ex, March 1995; needs MS-DOS, Win95 or DOSBox with EMS) or PSY-Q ASM68K.EXE (32-bit, with a path fix by Nemesis). You must source the executables yourself. — [BigEvilCorporation/TANGLEWOOD](https://github.com/BigEvilCorporation/TANGLEWOOD)
- The Hivebrain 2022 Sonic 1 disassembly ships only a Windows `build.bat` and references "axm68k" (an asm68k derivative) for Z80 macros. — [cvghivebrain/s1disasm](https://github.com/cvghivebrain/s1disasm)
- vladikcomper's md-modules note that on non-Windows systems you need Wine to run the assemblers, because "they're 32-bit Windows executables". — [vladikcomper/md-modules](https://github.com/vladikcomper/md-modules)

**vasm (vasmm68k_mot)**
- The official homepage was down when checked on 2026-11-18. sun.hasenbraten.de showed "Server is under maintenance!" and /vasm/ returned 404. The data below comes from a Wayback snapshot dated 2026-09-03. — [vasm homepage (Wayback 2026-09-03)](https://web.archive.org/web/20260903181534/http://sun.hasenbraten.de/vasm/)
- Latest release in that snapshot: **vasm 2.0f, 10 Jul 2026**. Earlier 2.0x releases: 2.0e (24 Feb 2026), 2.0d (23 Nov 2025), 2.0c (14 Jul 2025), 2.0b (21 Apr 2025), 2.0a (30 Dec 2024). — [vasm homepage (Wayback)](https://web.archive.org/web/20260903181534/http://sun.hasenbraten.de/vasm/)
- **License (manual §1.3 "Legal").** Copyright 2002–2026 Volker Barthelmann. The archive "may be redistributed without modifications and used for non-commercial purposes". Commercial use is allowed only when the target CPU is M68k and the target OS is AmigaOS. "In all other cases you need my written consent." — [vasm manual ch.1 (Wayback)](https://web.archive.org/web/2026/http://sun.hasenbraten.de/vasm/release/vasm_1.html)
- Build on Unix: `make CPU=m68k SYNTAX=mot` with the standard Unix/gcc `Makefile`. The result is `vasmm68k_mot`. — [vasm compilation notes (Wayback)](https://web.archive.org/web/2026/http://sun.hasenbraten.de/vasm/index.php?view=compile)
- Output and debug options:
  - `-Fbin` is the raw binary output module;
  - `-L <listfile>` writes a listing, and `-Lns`/`-Llo` tune the symbol part;
  - `-dwarf[=ver]` emits DWARF for source-level debugging;
  - `-maxerrors=<n>` sets how many errors are shown before aborting (default 5).
  — [vasm manual ch.2 general options (Wayback)](https://web.archive.org/web/2026/http://sun.hasenbraten.de/vasm/release/vasm_2.html); [vasm manual ch.18 bin output (Wayback)](https://web.archive.org/web/2026/http://sun.hasenbraten.de/vasm/release/vasm_18.html)
- **Mot syntax specifics:**
  - local labels are prefixed `.` or suffixed `$` and are valid between two global labels;
  - mnemonics must not start in column 1;
  - operand fields can't contain whitespace unless `-spaces` is given;
  - `even` = `cnop 0,2`;
  - `cnop` pads with `$4E71` (NOP) in code by default;
  - `incbin file[,offset[,length]]`, `include`, and `rept <expr>[,<sym>]` … `endr`;
  - extra operators: `=` equality, `//` modulo, `!` bitwise OR, `~` bitwise XOR;
  - `-devpac` mode restricts it to Devpac directives.
  — [vasm manual ch.4 mot syntax (Wayback)](https://web.archive.org/web/2026/http://sun.hasenbraten.de/vasm/release/vasm_4.html)
- **Silent optimizations (m68k module).** By default vasm rewrites operands and instructions. Examples:
  - `(0,An)` becomes `(An)`;
  - `<exp>.l` becomes `<exp>.w` when absolute and in 16-bit range;
  - `ADD #x` becomes `ADDQ`;
  - `CLR.L Dn` becomes `MOVEQ #0,Dn`;
  - `CMP #0` becomes `TST`;
  - `JMP`/`JSR` become `BRA`/`BSR`;
  - `LEA (0,An),An` is deleted;
  - `Bcc` gets an automatic 8/16-bit size.

  An operand optimization is skipped only when the size is forced explicitly, e.g. `(4.l,a0)`. Switches:
  - `-no-opt` "Disable all optimizations … main switch";
  - `-devpac` sets everything Devpac-compatible, "all optimizations are disabled … and vasm will warn about any optimization being done";
  - `-showopt` / `opt ow+` prints every optimization.

  (This doc comes from a GitHub mirror whose exact vasm version is unknown.) — [vasm cpu_m68k.texi (mbitsnbites mirror)](https://github.com/mbitsnbites/vasm-mirror/blob/master/doc/cpu_m68k.texi); the search summary of the same doc at [applefritter mirror](https://git.applefritter.com/Macintosh-SW/NetBoot/src/commit/9d4022b833aa6a2595ec455b10305c29ea1a2c23/vasm-1/doc/cpu_m68k.texi)
- 2.0f also added `-ctrace` and `-iserror=<n>`. 2.0c "Improved error messages for quick-immediate and shift-values", turned m68k out-of-range warnings back into errors, and added `-warnunaligned`. — [vasm homepage history (Wayback)](https://web.archive.org/web/20260903181534/http://sun.hasenbraten.de/vasm/)
- The vasm homepage asks contributors not to use generative AI, describing vasm as "human-made software". — [vasm homepage (Wayback)](https://web.archive.org/web/20260903181534/http://sun.hasenbraten.de/vasm/)
- There is no Homebrew formula named `vasm` or `asl` (the formulae.brew.sh API returned not-found on 2026-11-18). — [formulae.brew.sh API](https://formulae.brew.sh/api/formula/vasm.json)

**GNU as (m68k-elf binutils)**
- Homebrew `m68k-elf-binutils` 2.47 (GPL-3.0-or-later) has bottles for arm64 Sonoma, Sequoia, Tahoe and "golden_gate", plus Linux. — [Homebrew m68k-elf-binutils](https://formulae.brew.sh/formula/m68k-elf-binutils)
- `--register-prefix-optional` lets you write `d0` instead of `%d0`. `|` is a comment character unless `--bitwise-or` is given. `-m68000` selects the 68000; otherwise the default is normally the 68020. `--base-size-default-16` and `--disp-size-default-16` change the default displacement sizes. — [GNU as M68K options](https://sourceware.org/binutils/docs/as/M68K_002dOpts.html)
- GNU as's default m68k syntax is MIT/Sun-style: `%` register prefix, and `movl` = `mov.l` because periods are ignored. Motorola syntax is documented separately. — [GNU as M68K syntax](https://sourceware.org/binutils/docs/as/M68K_002dSyntax.html)
- SGDK assembles its `.s` files through gcc with `-x assembler-with-cpp -Wa,--register-prefix-optional,--bitwise-or`. So SGDK assembly is GNU as + the C preprocessor, not AS or asm68k syntax. — [SGDK makefile.gen](https://github.com/Stephane-D/SGDK/blob/master/makefile.gen)

**Syntax cheat-sheet (from the sources above)**

| Feature | AS (Sonic disasms) | asm68k / clownassembler | vasm mot | GNU as (SGDK) |
|---|---|---|---|---|
| Local labels | `.name` (composed), `+`/`-`, `$$name` ([AS manual](http://john.ccac.rwth-aachen.de:8000/as/as_EN.html)) | `@name` by default; signifier configurable ([custom.cpp](https://github.com/Clownacy/clownassembler/blob/master/source/frontend/custom.cpp)) | `.name` or `name$` ([vasm ch.4](https://web.archive.org/web/2026/http://sun.hasenbraten.de/vasm/release/vasm_4.html)) | see Gaps |
| Binary include | `binclude` | see Gaps (SATMAN) | `incbin f,off,len` | see Gaps |
| Align | `align`; PADDING on by default for 68k | `even`/`cnop` per SATMAN (see Gaps) | `even`, `cnop off,align`, `align bits` | see Gaps |
| XOR / power / mod | `!` / `^` / `#` | see Gaps | `^` or `~` XOR, `%` or `//` mod | `\|` needs `--bitwise-or` ([GNU as opts](https://sourceware.org/binutils/docs/as/M68K_002dOpts.html)); the rest: see Gaps |
| Silent size choice | yes, "shortest code possible" | only an optional zero-displacement opt | yes, extensive; `-no-opt` / `-devpac` turn it off | relaxation exists, see Gaps |
| Binary ROM | asl → `.p` → p2bin | direct | `-Fbin` | ELF → `objcopy -O binary` |
| Listing / symbols | `-L`, `-g MAP`, `-c` header | `-l`, `-s` | `-L`, `-dwarf` (DWARF needs an ELF-type output, see Inferences) | `-S` / `nm` / DWARF |

### Inferences
- **Bundling legality.** AS (GPL-2.0), clownassembler (AGPL-3.0+) and GNU binutils (GPL-3.0) can all be bundled as separate executables, provided the app offers the corresponding source. The AGPL's network clause matters only if the app serves a modified clownassembler over a network. vasm cannot be redistributed in modified form, and needs Volker Barthelmann's written consent for any commercial app or non-Amiga commercial use. Treat vasm as "user installs it themselves", or ask for permission.
- **vasm and byte-perfect builds.** vasm's default rewrites (for example `0(a0)` → `(a0)`, abs.l → abs.w) would silently break byte-perfect rebuilds of 1990s code. If vasm is ever used for Sonic sources it must run with `-no-opt` or `-devpac`. For a teaching app, silent rewriting also hides what the CPU really executes, which is a reason to prefer AS or clownassembler with listings on.
- **Mac arm64 build sketches** (from the documented build systems, not tested):
  - AS: `cp Makefile.def-samples/<macOS sample> Makefile.def && make binaries`;
  - clownassembler: `cmake -S . -B build && cmake --build build`, with a C++20 Clang, which the Command Line Tools provide;
  - vasm: `make CPU=m68k SYNTAX=mot`;
  - binutils/gcc: Homebrew bottles, or source builds.
- **DWARF in vasm.** DWARF only makes sense with an object format like ELF, so source-line debugging with vasm would likely mean ELF output plus objcopy to a binary. This is unverified.
- **Debugger source-line mapping.** For a debugger that shows source lines, the AS route (`-L` listing plus MAP or symbol export) and clownassembler (`-l` listing, `-s` symbols) both give what's needed. The GNU route gives full DWARF via ELF.

### Gaps
- I could not reach SATMAN.pdf (asm68k manual) or test asm68k's operator set, `rept`/`even`/`cnop`/`incbin` spellings and `/o` optimisation options. Check http://antime.kapsi.fi/sega/files/SATMAN.pdf.
- GNU as specifics are from general knowledge and were not fetched this session: numeric local labels `1:` / `1b` / `1f`, `.even`, `.incbin`, `.rept`, and branch relaxation (`jbra`/`jbsr`). Verify at https://sourceware.org/binutils/docs/as/.
- The vasm homepage was down. 2.0f (Jul 2026) may no longer be the newest release, and the m68k-module doc came from a mirror of unknown version.
- I found no side-by-side comparison of error-message quality. Evidence is indirect: AS `-xx` "most detailed", vasm's `-maxerrors` default of 5 and its improved m68k messages in 2.0c, clownassembler's pedantic-warnings switch.
- clownassembler's exact listing and symbol formats, and whether it can emit Kosinski-compressed segments like Clownacy's p2bin, were not examined.

---

## Q2. Which single syntax/assembler should the app teach so the learner can read and build Sonic disassemblies?

### Takeaway
Teach Motorola-syntax 68000 assembly and **bundle Clownacy's/flamewing's fork of AS (asl + p2bin)** as the primary assembler. All three flagship Sonic Retro disassemblies build with it, and they already ship Mac arm64 binaries. Offer **clownassembler** as a second "asm68k dialect" for asm68k-era sources. Introduce GNU as syntax only when the learner moves to SGDK/C.

### Cited Findings
- s1disasm (Sonic 1), s2disasm (Sonic 2) and skdisasm (S3&K) each ship Windows `.bat` builds plus Lua build scripts (`build.lua` / `buildS3.lua` / `buildSK.lua` / `buildS3Complete.lua`). The Lua scripts are cross-platform (Windows, Mac, Linux, FreeBSD) and need Lua 5.3+, because older Lua lacks `//` and bit-shift operators. — [skdisasm README](https://github.com/sonicretro/skdisasm); [s2disasm readme](https://github.com/sonicretro/s2disasm)
- The assembler they use is the modified AS. `common.lua` looks for `asl` in a per-OS folder (including `Mac-arm`) and refers users to the asl-releases repo. — [s1disasm AS.txt](https://github.com/sonicretro/s1disasm/blob/master/build_tools/AS.txt); [s1disasm common.lua](https://github.com/sonicretro/s1disasm/blob/master/build_tools/lua/common.lua)
- All three repos are actively maintained: pushes on 2026-11-12 (s1), 2026-11-18 (s2) and 2026-10-11 (skdisasm). GitHub shows no license file. Each README says the content is "for informational and educational purposes only" and "Commercial usage is expressly prohibited". — [s1disasm](https://github.com/sonicretro/s1disasm); [s2disasm](https://github.com/sonicretro/s2disasm); [skdisasm](https://github.com/sonicretro/skdisasm) (GitHub API + READMEs)
- skdisasm also ships a `flake.nix`, i.e. a Nix build. — [skdisasm](https://github.com/sonicretro/skdisasm)
- Asm68k-dialect sources still exist. The Hivebrain 2022 S1 disassembly uses a Windows `build.bat` with axm68k-related macros, and TANGLEWOOD builds with SNASM68K/ASM68K. clownassembler is the open-source drop-in for that dialect. — [cvghivebrain/s1disasm](https://github.com/cvghivebrain/s1disasm); [TANGLEWOOD](https://github.com/BigEvilCorporation/TANGLEWOOD); [clownassembler](https://github.com/Clownacy/clownassembler)

### Inferences
- The instruction set and addressing-mode syntax (`move.w d0,(a1)+`, `dbf`, `lea`) are the same in every Motorola-syntax assembler. The differences are directives, local-label rules and operators. The app could teach a "portable core" and add per-assembler dialect cards. Key AS traps: `^` is power not XOR, `!` is XOR, `#` is modulo, and the size of unsized branches and addresses is chosen for you.
- To build Sonic disassemblies inside the app:
  - The app should bundle its own arm64 `asl`/`p2bin`, built from Clownacy/asl-releases and Clownacy/p2bin source, not just run the binaries committed in each repo. That keeps provenance clear and satisfies the GPL source offer.
  - It needs a Lua 5.3+ interpreter, or a native re-implementation of `common.lua`'s steps.
- vasm is not recommended as the primary teaching assembler (license plus silent optimizations). GNU as is required for SGDK but isn't what Sonic sources use.

### Gaps
- I did not verify whether s1/s2/skdisasm still keep asm68k-compatible branches or forks. Sonic Retro's wiki (info.sonicretro.org/Disassemblies) blocked automated access, so I couldn't enumerate every disassembly's assembler, e.g. the Sonic CD, 3D Blast and Spinball disassemblies.
- I did not check whether clownassembler can build any current Sonic Retro disassembly unmodified.

---

## Q3. SGDK: contents, version, license, macOS setup routes, simplest reliable route for a Mac app, build time and size

### Takeaway
SGDK's latest tagged release is **2.11 (April 2025)**, and `master` is still active (last push 2026-11-10). The library and tools are MIT. GCC/libgcc are GPL-3 with the runtime exception. Windows is the only officially packaged host.

For a Mac app, the simplest native route is:
- Homebrew-style `m68k-elf-gcc` + `m68k-elf-binutils` (arm64 bottles exist; the current formula is GCC 16.2.0);
- SGDK's in-tree CMake build for its native helper tools;
- a bundled Java runtime for `rescomp.jar` and `xgm2tool.jar`.

marsdev, which builds everything from source, is the main tested alternative. The upstream-tested GCC version is 13.2, so the app should pin a GCC version.

### Cited Findings
- **Version and activity.**
  - Releases: v2.11 (2025-04-02, `sgdk211.7z` 54,060,415 bytes), v2.10 (2025-04-01), v2.00 (2024-01-31), v1.90 (2023-07-28).
  - No newer tag exists as of 2026-11-18. The repo was last pushed 2026-11-10 and has about 2.2k stars.
  — [SGDK releases](https://github.com/Stephane-D/SGDK/releases) (GitHub API)
- **License.** "SGDK library and custom tools are distributed under the MIT license". GCC and libgcc are GPL3, and software built with them falls under the GCC runtime library exception (COPYING.RUNTIME). — [SGDK readme](https://github.com/Stephane-D/SGDK/blob/master/readme.md)
- **What it is.** A C development kit: the library with source, plus custom resource tools. It uses GCC (m68k-elf) and libgcc. Windows binaries are provided with GCC 13.2; other OSes must install the toolchain themselves. Java is required. — [SGDK readme](https://github.com/Stephane-D/SGDK/blob/master/readme.md)
- **Contents of `bin/` (Windows package):**
  - GCC 13.2 toolchain: cc1.exe about 25 MB, lto1.exe about 24 MB, libstdc++-6.dll about 21.6 MB, gdb.exe about 9.8 MB, plus as, ld, objcopy, nm, make and msys DLLs;
  - `rescomp.jar` (about 288 KB);
  - `xgm2tool.jar`, `xgmtool.exe`, `xgmRomBuilder.jar`;
  - `sjasm.exe` (Z80 assembler for the sound drivers);
  - `convsym.exe`, `sizebnd.jar`, `apj.jar` (aPLib), `lz4w.jar`, `bintos.exe`, `mac68k.exe`;
  - docs `xgm.txt` and `xgm2.txt`.
  — [SGDK bin/](https://github.com/Stephane-D/SGDK/tree/master/bin) (GitHub API listing)
- **Features (2.10/2.11 changelog):**
  - GCC updated to 13.2;
  - Docker files removed;
  - VSCode template added;
  - XGM2Tool fixes;
  - rescomp improvements, including sprite-cutting optimizations, an `ordering` option, `export` for TILESET, and `sortby` for OBJECTS;
  - makefile adds `-ffunction-sections -fdata-sections`.
  — [SGDK changelog](https://github.com/Stephane-D/SGDK/blob/master/changelog.txt)
- **Credits in the readme** include a multi-tasking engine, an advanced error handler with backtraces, flash save, and MegaWifi. The readme says SGDK's sound drivers may not suit everyone and points to MDSDRV and Echo as alternatives. — [SGDK readme](https://github.com/Stephane-D/SGDK/blob/master/readme.md)
- **rescomp resource types:** PALETTE, BITMAP, TILESET, TILEMAP, MAP, OBJECTS, IMAGE, SPRITE, XGM, XGM2, WAV, BIN and ALIGN.
  - Images can be BMP/PNG.
  - TILEMAP, MAP and OBJECTS accept Tiled `.tmx`; TILESET accepts Tiled `.tsx`.
  - Compression options are none, APLIB ("good ratio but slow") and LZ4W ("fast").
  — [SGDK rescomp.txt](https://github.com/Stephane-D/SGDK/blob/master/bin/rescomp.txt)
- **Build flags** (`makefile.gen`):
  - common: `-m68000 -Wall -Wextra -fno-builtin -ffunction-sections -fdata-sections -fms-extensions`;
  - release: `-O3 -fuse-linker-plugin -fno-web -fno-gcse -fno-tree-loop-ivcanon -fomit-frame-pointer`, and one variant adds `-flto`;
  - debug: `-O1 -DDEBUG=1 -ggdb -g`;
  - link: `-nostdlib` with SGDK's `md.ld`, `libmd` and `libgcc`;
  - ROM via `objcopy -O binary`;
  - `symbol.txt` via `nm -n -l`;
  - `convsym` can inject symbols into the ROM for the error handler;
  - `sizebnd` pads the ROM and fixes the checksum.
  — [SGDK makefile.gen](https://github.com/Stephane-D/SGDK/blob/master/makefile.gen)
- **In-tree CMake.** `master` has a `CMakeLists.txt` (CMake ≥3.22) that defaults to the `m68k-elf-` prefix (overridable via `PREFIX`). It builds the native tools `bintos`, `xgmtool` and `sjasm` from `tools/`, runs rescomp via `java -jar`, and builds `libmd` into `lib/`. — [SGDK CMakeLists.txt](https://github.com/Stephane-D/SGDK/blob/master/CMakeLists.txt)
- **Officially listed Linux/macOS routes:**
  - SGDK_wine;
  - tlsa's SGDK Helper (native or container);
  - marsdev ("all OSes", plus 32X);
  - SONIC3D/gendev-macos, which the readme calls "probably a bit outdated".
  
  For Docker, the readme recommends doragasu's docker-sgdk (native Linux compiler). — [SGDK readme](https://github.com/Stephane-D/SGDK/blob/master/readme.md)
- **Activity and license of those routes** (GitHub/GitLab API, 2026-11-18):
  - marsdev: MIT, last push 2026-04-03;
  - sgdk-helper: ISC, 2026-07-24;
  - SGDK_wine: MIT, 2022-09-11;
  - gendev-macos: BSD-3-Clause, 2021-03-15;
  - docker-sgdk: last activity 2026-01-28.
  — [marsdev](https://github.com/andwn/marsdev); [sgdk-helper](https://github.com/tlsa/sgdk-helper); [SGDK_wine](https://github.com/Franticware/SGDK_wine); [gendev-macos](https://github.com/SONIC3D/gendev-macos); [docker-sgdk](https://gitlab.com/doragasu/docker-sgdk)
- **marsdev details:**
  - `make m68k-toolchain` (optionally `-newlib`), with the GCC version selectable via `GCC_VER`;
  - `make sgdk` with `SGDK_VER=<tag|master>`, though non-default versions are not guaranteed;
  - optional `sh` toolchain for 32X;
  - `mdtools-sik` (mdtiler, Echo tools; needs libpng) and `mdtools-flamewing` (Sonic compression tools; needs boost);
  - experimental `m68k-llvm`.
  
  The macOS steps are `xcode-select --install`, `brew install wget`, and `brew install java` for SGDK. The README's PATH example uses the Intel Homebrew prefix `/usr/local`; Apple Silicon isn't mentioned. On build time it says only "GCC is a big boy, so we just have to be patient" and to use `-j`. — [marsdev README](https://github.com/andwn/marsdev)
- **Homebrew `m68k-elf-gcc` 16.2.0:**
  - license GPL-3.0-or-later WITH GCC-exception-3.1;
  - arm64 bottles for Sonoma, Sequoia, Tahoe and golden_gate;
  - configured `--target=m68k-elf --without-headers --enable-languages=c,c++,objc,lto`;
  - builds `all-gcc` + `all-target-libgcc`, with no newlib;
  - depends on `m68k-elf-binutils` 2.47.
  
  There is no `m68k-elf-gdb` formula. — [Homebrew m68k-elf-gcc formula](https://github.com/Homebrew/homebrew-core/blob/HEAD/Formula/m/m68k-elf-gcc.rb); [formulae.brew.sh](https://formulae.brew.sh/formula/m68k-elf-gcc)
- **Alternative SDK: ClownMDSDK** (0BSD, last push 2026-11-15). It is "explicitly NOT a framework nor game engine": a GCC/binutils toolchain plus minimal libraries for freestanding C++. It installs to `/opt/clownmdsdk` with a Makefile include and a CMake toolchain file. Its documented builds are Linux and Windows (MSYS2/WSL); macOS isn't mentioned. — [Clownacy/clownmdsdk](https://github.com/Clownacy/clownmdsdk)

### Inferences
- **Simplest reliable Mac-app route** (proposal, untested):
  1. Ship or require `m68k-elf-gcc` + `m68k-elf-binutils`. Either rely on Homebrew bottles or vendor a relocatable build of the same configure line, pinned to GCC 13.x to match what SGDK is tested with.
  2. Build SGDK's `bintos`, `xgmtool` and `sjasm` natively with the in-tree CMake and Apple clang.
  3. Bundle a small JRE for `rescomp.jar`, `xgm2tool.jar`, `sizebnd.jar`, etc.
  4. Build `libmd.a` once with the bundled GCC.
  5. Drive projects with SGDK's `makefile.gen`, or call the steps directly.

  Wine and Docker are heavier and add a runtime dependency the app would have to manage. marsdev is a good reference recipe but compiles GCC from source on each install.
- **GCC version risk.** Homebrew tracks the newest GCC (16.2 today), so a Homebrew-dependent app could break when the formula bumps. SGDK's flags include odd tuning such as `-fno-gcse` and `-fno-tree-loop-ivcanon`, chosen against 13.2. Vendor a pinned toolchain.
- **Size, rough:**
  - Windows SGDK package: about 54 MB compressed, with GCC binaries making up most of `bin/`;
  - AS for Mac arm64: about 3 MB (asl + p2bin);
  - a JRE adds tens of MB (not measured).

  A minimal SGDK-capable bundle is plausibly in the 100–250 MB uncompressed range. That is an estimate, not measured.
- **Build time.** A small SGDK project's compile time is dominated by GCC -O3/LTO and rescomp (a JVM start). Expect seconds, not minutes, once `libmd` is prebuilt. Building GCC itself from source (the marsdev route) takes much longer. Both are unmeasured.

### Gaps
- I did not verify whether Homebrew's `m68k-elf-gcc` builds a 68000 multilib of libgcc. SGDK links `libgcc` with `-m68000`; check with `m68k-elf-gcc -print-multi-lib`, or use the `libgcc.a` SGDK ships, if it does (not checked).
- No measured build times for GCC/binutils on Apple Silicon or for a typical SGDK project. No Homebrew bottle sizes. No JRE size.
- I did not check whether SGDK `master` changed since 2.11 in user-visible ways (unreleased changelog).
- I didn't locate a "libmd" name in the sources I read; the library target is `libmd` per the makefile variables, but I did not open the library source. I didn't open XGM2 driver internals or the sprite engine API (SPR_* functions); confirm in the online doxygen docs at https://stephane-d.github.io/SGDK/.
- doragasu/docker-sgdk's license was not retrieved.

---

## Q4. SGDK (C) vs pure assembly, honestly: time-to-first-result, performance, what commercial homebrew actually used, mixing C and asm, what C hides

### Takeaway
SGDK gets a beginner to a moving sprite far faster. rescomp turns PNG and Tiled files into ready-to-use tiles, palettes, maps and sprites, and the sprite engine and XGM sound drivers are built in. Well-known commercial homebrew used both routes:
- **Xeno Crisis**: SGDK;
- **Demons of Asteborg**: SGDK;
- **TANGLEWOOD**: pure 68000 assembly on SNASM68K/ASM68K;
- **Paprium**: proprietary in-house tools; language not publicly confirmed.

For a learner whose goal includes Sonic ROM hacks, assembly is unavoidable, because Sonic hacking is editing 68k assembly. The C route hides exactly the things a ROM hacker must see.

### Cited Findings
- SGDK's readme says it uses C, "assembly is also possible, but not necessary". It strongly recommends knowing C before starting, and says SGDK "heavily relies on resources" compiled by rescomp. — [SGDK readme](https://github.com/Stephane-D/SGDK/blob/master/readme.md)
- **Xeno Crisis.** The Bitmap Bureau backer update "Progress Update (April/May 2019)" (posted 2019-06-04) says the Mega Drive version "was built using 'SGDK'". The same update describes a custom MAME build and MAME Lua scripts for debugging. — [Xeno Crisis BackerKit updates p.3](https://xenocrisis.backerkit.com/hosted_preorders/project_updates?page=3)
- The SGDK readme lists Xeno Crisis (Bitmap Bureau) and Demons of Asteborg (Neofid Studios) among "projects known to be based on the SGDK", and credits both teams as supporters. — [SGDK readme](https://github.com/Stephane-D/SGDK/blob/master/readme.md)
- A 2019 Game Developer blog by Doctor Ludos says Xeno Crisis "was developed with SGDK", while Tanglewood "was fully developed in Assembly like in the 90's". — [Game Developer, "Making a SEGA Mega Drive / Genesis game in 2019"](https://www.gamedeveloper.com/design/making-a-sega-mega-drive-genesis-game-in-2019)
- **TANGLEWOOD.** The source is public on GitHub, GPL-3.0 per the repo listing. It is 68000 assembly built with SNASM68K 2.02Ex or PSY-Q ASM68K, and has build variants for a final BIN, an emulator BIN, and a COFF debug build for the SNASM2 debugger. Sound uses Sik's Echo; part of development was done in MDStudio. — [TANGLEWOOD repo](https://github.com/BigEvilCorporation/TANGLEWOOD)
- **Paprium.** In a developer Q&A, WaterMelon said the game needed "100% proprietary tools and code" to hit 60 fps, and that it uses a custom cartridge chip for extra audio. I saw this only as a search-result summary; I did not fetch the page directly. — [HonestGamers Paprium developer Q&A](https://www.honestgamers.com/honestgamer/blog/posts/64824-paprium-developer-qa.html)
- **Mixing C and asm in SGDK.** Plain `.s` files are assembled by gcc with the C preprocessor and GNU as options `--register-prefix-optional,--bitwise-or`. Z80 `.s80` files go through sjasm, then `bintos`, then a 68k `.s`. — [SGDK makefile.gen](https://github.com/Stephane-D/SGDK/blob/master/makefile.gen)
- SGDK's release build uses `-O3 … -fomit-frame-pointer` with optional LTO. Debug builds drop to `-O1` with `-g`. — [SGDK makefile.gen](https://github.com/Stephane-D/SGDK/blob/master/makefile.gen)

### Inferences
- **Time-to-first-result.**
  - SGDK: a PNG listed in a `.res` file, plus about 10 lines of C (`VDP_drawImage…` / `SPR_addSprite…`), gives an on-screen image in one session.
  - Pure asm: the beginner must first understand the ROM header, the VDP register init sequence, the TMSS handshake, DMA/VRAM writes, the tile format, the palette format and VBlank handling before anything appears.
  - A good compromise: start with a provided asm "shell" that already does init, like vladikcomper's MD-Shell (an "assembly header to run small programs as Mega-Drive ROMs", [md-modules](https://github.com/vladikcomper/md-modules)).
- **Performance.** GCC's 68000 output at -O3 is serviceable, but hand-written asm usually wins in hot loops: register allocation across calls, `movem` bulk copies, `dbf` loops, avoiding 32-bit ops on a 16-bit bus. SGDK mitigates this by doing heavy lifting (DMA queue, sprite engine) in tuned library code. Commercial SGDK titles (Xeno Crisis, Demons of Asteborg) show C is sufficient for full games. No benchmark was found.
- **What C/SGDK hides from a ROM hacker:**
  - VDP port writes and register values;
  - DMA setup;
  - VRAM layout;
  - the 68000 memory map;
  - the Z80 bus handshake;
  - interrupt handlers;
  - data-format specifics (SGDK uses APLIB/LZ4W, Sonic uses Kosinski/Nemesis/Enigma);
  - cycle costs.

  Sonic hacking requires reading exactly this layer in 68k assembly.
- **Teaching plan.** Learn 68k asm (AS dialect) first because of the Sonic goal. Then show SGDK C side by side, with the compiler's `-S` output (see Q6), so the learner sees C mapped to the same instructions.

### Gaps
- I found no first-hand developer statement on what fraction of Xeno Crisis was C vs asm. A search summary claimed "both C and ASM using SGDK", but I couldn't confirm it on the page I fetched.
- Paprium's language and assembler are not publicly documented in any source I found.
- I found no Neofid interview detailing Demons of Asteborg's C/asm split. Only SGDK's own list confirms SGDK.
- I found no quantitative GCC-vs-hand-asm benchmark on the 68000.

---

## Q5. Asset tools: PNG → tiles/palettes, maps (Tiled), and Sonic compressors (Kosinski, Nemesis, Enigma)

### Takeaway
On the SGDK side, rescomp (Java) is the converter: PNG/BMP to tiles and palettes, Tiled TMX/TSX to maps and objects, sprite cutting, and APLIB/LZ4W compression. On the Sonic side, flamewing's **mdcomp** (C++/CMake/Boost, LGPL-3.0; 68k decompressors 0BSD) covers Kosinski, Kosinski+, Nemesis, Enigma, Saxman, Comper, Rocket and others. Clownacy's **clownnemesis** (0BSD) and the clownlzss sources inside s2disasm are lighter options.

### Cited Findings
- rescomp handles PNG/BMP images and Tiled TMX/TSX, with APLIB/LZ4W compression and sprite animation timing. — [SGDK rescomp.txt](https://github.com/Stephane-D/SGDK/blob/master/bin/rescomp.txt)
- **SGDK readme's suggested asset tools:**
  - pixel art: Aseprite, GraphicsGale, Pro Motion, Grafx2, and the web "Palette quantizer" (tiledpalettequant) for MD palette constraints;
  - maps: 16Tile (SGDK-specific), PNGPalPrio4SGDK, Tiled ("supported by SGDK resource compiler tool"), LDtk, Ogmo, Palette merger;
  - music: Deflemask, Furnace.
  — [SGDK readme](https://github.com/Stephane-D/SGDK/blob/master/readme.md)
- **mdcomp:**
  - "Assorted compression formats for the Sega Mega Drive";
  - license: `src/asm` (68k decompressors) 0BSD, the rest LGPL-3.0;
  - build with CMake ≥3.19 + Boost ≥1.54; the `Xcode` and `Unix Makefiles` generators are listed;
  - tools: `koscmp`, `kosplus`, `nemcmp`, `enicmp`, `saxcmp`, `compcmp`, `comperx`, `rockcmp`, `snkcmp`, `lzkn1cmp`;
  - last push 2026-11-16.
  — [flamewing/mdcomp](https://github.com/flamewing/mdcomp) (README + GitHub API)
- clownnemesis is a "Bit-exact compressor and decompressor for the Nemesis file format", 0BSD, last push 2024-03-18. — [Clownacy/clownnemesis](https://github.com/Clownacy/clownnemesis)
- s2disasm's `build_tools/source_code` contains `clownlzss`, `lz_comp2`, `saxman.c` and a CMake/Makefile, i.e. compressor sources used by the build. — [s2disasm build_tools/source_code](https://github.com/sonicretro/s2disasm/tree/master/build_tools/source_code)
- marsdev can build "mdtools-flamewing" (the Sonic compression tools) and Sik's mdtiler. — [marsdev](https://github.com/andwn/marsdev)
- The Sonic disassemblies keep art in folders named by compression: `artkos`, `artnem` and `artunc` in s1disasm. — [s1disasm](https://github.com/sonicretro/s1disasm)
- vladikcomper's md-modules provide ConvSym (symbol extraction/conversion) and the MD Debugger and Error Handler; MIT, last push 2026-10-22. — [vladikcomper/md-modules](https://github.com/vladikcomper/md-modules)

### Inferences
- **For an asm-first app.** Write a small native PNG → 4bpp-tile + 9-bit-palette converter (Swift or C). The format is simple, and a custom converter avoids a JVM dependency. Link mdcomp's library, or the 0BSD clownnemesis, for Kosinski/Nemesis/Enigma round-tripping so learners can edit Sonic art.
- **For the SGDK path**, rescomp is effectively mandatory, so a JRE must be bundled anyway.

### Gaps
- I didn't research Imagenesis; it's an older Windows-only tool. Current status and license unknown.
- I didn't examine SonLVL/SonED2 macOS viability. They are referenced by s2disasm and skdisasm as project-file targets.
- mdcomp's GitHub license field shows "NOASSERTION" because of the dual license. The README's statement is what I used.

---

## Q6. Can m68k-elf-gcc show its generated assembly (Compiler-Explorer style) for teaching?

### Takeaway
Yes. `m68k-elf-gcc -S` emits 68000 assembly. SGDK's own makefile already has a `.lst` rule that runs `$(CC) $(CFLAGS) -S -c file.c`. Godbolt Compiler Explorer currently hosts M68K gcc 13.1 through 16.1 plus M68K clang (trunk). Note that GCC emits MIT/GAS-style syntax, not AS or asm68k syntax.

### Cited Findings
- SGDK `makefile.gen` defines `LSTS := $(SRC_C:.c=.lst)` with the rule `$(OUT_DIR)/%.lst: %.c … $(CC) $(CFLAGS) -S -c $< -o $@`. — [SGDK makefile.gen](https://github.com/Stephane-D/SGDK/blob/master/makefile.gen)
- The Compiler Explorer API, queried 2026-11-18, lists these C compilers: "M68K gcc 13.1.0", "13.2.0", "13.3.0", "13.4.0", "14.1.0", "14.2.0", "14.3.0", "15.1.0", "15.2.0", "16.1.0", and "M68K clang (trunk)". — [godbolt.org/api/compilers/c](https://godbolt.org/api/compilers/c)
- GNU as's default m68k syntax is the MIT/Sun dialect (`%d0`, `movl`). This is what GCC output follows unless it's post-processed. — [GNU as M68K syntax](https://sourceware.org/binutils/docs/as/M68K_002dSyntax.html)
- marsdev offers an experimental `m68k-llvm` (clang) build target. — [marsdev](https://github.com/andwn/marsdev)

### Inferences
- **In-app "C ↔ asm" panel:**
  1. Run the bundled `m68k-elf-gcc -m68000 -O2 -S -fverbose-asm` (or `-g` + `objdump -dS` for interleaved source).
  2. Optionally translate the MIT-syntax output into Motorola syntax for display, so it matches what the learner writes in AS.
  3. Godbolt's public instance can serve as a no-install fallback, but it has no SGDK headers.
- Use the same pinned GCC version as the SGDK toolchain, so the output matches the ROM the learner actually builds.

### Gaps
- I did not verify a GCC flag or tool that emits Motorola syntax directly. As far as I know there isn't one, and a display-side converter would be needed. Treat as unverified.
- I did not check whether Compiler Explorer's m68k compilers default to `-m68020`. Learners should pass `-m68000`.
