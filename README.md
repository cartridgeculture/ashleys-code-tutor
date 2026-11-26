# ACT (Ashley's Code Tutor)

Vibe-coded by Ashley Rojas with Claude. Version 0.6 (ACT > About Ashley's Code Tutor shows it; the version is
in `Resources/Info.plist`).

A Mac app for learning to program, from zero to Sega Genesis homebrew and Sonic ROM hacks.

## Layout
- **Left:** the code editor. It is Monaco, the editor inside VS Code, with VS Code's Dark Modern / Light Modern
  colors and its keyboard shortcuts (⌘/ comment, ⌥↑/⌥↓ move line, ⌘D next match, ⌘⇧P command palette…).
  File tabs sit on top; the status bar below shows errors, line/column and the tutor's model.
- **Top right:** TERMINAL (build output and the running program; type into it when a program asks for input),
  PROBLEMS (compiler errors and warnings; click one to jump to it), and GENESIS (for the Genesis tracks).
  With a tutor character, this area is split in half: those tabs on the left, the character always on the
  right (drag the line between them to resize).
- **Bottom right:** the tutor, an IM-style chat with Claude. The tutor can write code into the editor (⌘Z undoes it),
  highlight lines with notes, run your code, switch lessons, mark them finished, and add detour lessons.
  Pick the model and effort at the top of the chat.
- **Far right:** the lesson tabs, top to bottom. ⌥⌘B collapses them.

## Tutor characters (roleplay)
After choosing a language, a Street Fighter II-style select screen picks the tutor: the first slot is
"No character" (the plain tutor), then each character (click a slot or use the arrow keys). Under the slots,
**Special Instructions** for the highlighted tutor (for example "call me Captain") are added to the tutor's
instructions; they're remembered per tutor, and changing them starts a fresh conversation (with a recap).
With a character:
- **Replies type out in the chat** at Ace Attorney's text speed (about 34 letters a second, a short beat
  after each sentence, measured from the DS game), with the character's voice blips. Click a reply to show
  the rest at once. Code cards and chips appear whole, and the tutor's actions happen as the text reaches
  them (the code lands in the editor right when its card appears).
- **The right half of the top-right area is the character's window** (always open): their sprite on a stage, mouth moving while
  the reply types, expressions the tutor picks (`<act:emote name="..."/>`), sound cues with flashes and
  shakes (`<act:sfx name="..."/>`), and the green date-and-place caption when a lesson opens.
- **Idle chatter**: the stage has no dialogue box, except after five minutes without the tutor speaking or
  being asked anything. Then the character says something casual (not about the lesson) in an Ace
  Attorney-style box for one minute, and a new line comes every five minutes while it stays quiet. Lines
  are in `character.json` (`chatter`), with `[emotion]` markers.
- Changing character starts a fresh tutor conversation (with a recap), because Claude keeps a
  conversation's instructions fixed.

Sprites are pixel-exact: `python3 tools/slice_sprites.py assets-src/<id>/slice.json web/characters/<id>`
cuts the original, lossless sprite sheet (PNG) by removing exactly the sheet's background colour, keeps
every other pixel as it is, and lines frames up (each expression's frames by matching pixels, poses by the
bottom edge where the screen cuts them off). The scene draws them at a whole number of screen pixels per
sprite pixel, like an emulator, so they stay sharp. Each character folder has `character.json` (name,
style, personality, voice, expression descriptions, chatter) plus the generated `atlas.png`/`atlas.json`
and `avatar.png` (a face crop at the sheet's own size).
- Maya Fey is the test character (sprites ripped by Shada; Ace Attorney sound effects in `web/sfx`, see CREDITS.txt).
- Backgrounds: the scene is a DS-sized screen (256×192) drawn at a whole-number scale with the character, centred
  in the window. Hover the window and click the small arrows in its top-right corner to switch between Gourd Lake
  Nature Park and the Office (`web/backgrounds/`, listed in `scene.js`); the choice is remembered. A full
  SF2-style stage select is still an idea for later.

## Preferences (File > Preferences, ⌘,)
- **Appearance**, as in AIM: **Colors** (ACT's own VS Code look, or AIM's themes with AIM's exact colors:
  Classic, Paper, Coral, Arcade, Pastel, Magazine, Terminal; each has a light and a dark version and follows
  the Mac, and recolors the code editor too) and **App icon** (the pixel "ACT" in AIM's eight colour pairs,
  shadowed or outlined, plus "Original", ACT's first blue icon). Both change at once while you try them;
  Save keeps them (the icon also changes in Finder and Launchpad) and Cancel puts the old ones back.
- Your name (the first letter replaces "U" on your messages) and avatar picture.
- Editor minimap and word wrap (⌥Z); font size.
- Sound effects and blips, and a **Sound volume** slider (0, 25, 50, 70, 100).
- The tutor character's **Dialog speed** slider (Natural = Ace Attorney's pace, Fast, Instant), and whether
  idle chatter turns its own pages.

## App icon
ACT ships with the pixel "ACT" in purple and yellow, outlined (the letters match AIM's hand-drawn ones: the A
is AIM's, the C and T were drawn to match). The letters live in `web/js/appicon.js`;
`python3 tools/make_icon.py` renders `Resources/AppIcon.icns` from them. "Original" is
`Resources/OriginalIcon.png` (drawn by `tools/make_original_icon.swift`). A picked icon is saved as
`app-icon.png` in the data folder and put back on the app each time it opens, like AIM.

## Tracks
C, C++, SGDK (C on the Genesis), 68000 Assembly (Sega Genesis), Sonic ROM Hacking, and 6502 Assembly (NES).
Each track has a roadmap (`curriculum/roadmaps.json`: titles and goals); the tutor builds each lesson live the
first time it's opened.

The NES track (24 lessons, ca65 syntax, NROM cartridges) has its own reference library in
`knowledge/research_notes/NES 6502 programming library/` (copied into the app as `knowledge/nes/`): the 6502,
memory map and booting, the PPU, the APU, the ca65/ld65 toolchain, and a complete commented example program.
Hardware facts were checked against the NESdev Wiki and the cc65 manuals on 2026-11-25; each note marks what
was verified. The editor colors 6502 assembly (`.s` files in the NES track).

## How the tutor works
Each reply runs Claude Code (`claude -p`) on your Claude plan, the same way AIM does, resuming that track's
conversation. Every message carries the lesson, your files with line numbers, the last build/run output and
any selected text. The tutor can read the researched reference library (`knowledge/`, copied into the app)
and search the web, but it can't edit files or run commands except through ACT.

## Running code
- **C / C++:** Apple's clang (Command Line Tools), with warnings and UndefinedBehaviorSanitizer on
  (AddressSanitizer hangs on this macOS version, so it's off). Programs run in a pseudo-terminal, so input works.
- **Genesis (68000, SGDK, Sonic):** not yet. Planned: the AS assembler (what the Sonic disassemblies use),
  and Genesis Plus GX compiled into the app for the GENESIS pane, with register/VRAM/palette views.
- **NES (6502):** not yet. It would need ca65/ld65 (the cc65 suite) and an NES emulator for the NES pane.

## Files
- Source: `Sources/*.swift` (window, bridge, runner, tutor), `web/` (the page), `curriculum/`, `knowledge/`.
- Build: `./build.sh` builds `build.noindex/ACT.app`; `./build.sh --install` also copies it to /Applications.
- Data: `~/Library/Application Support/ACT/` (settings, each track's state, chat and lesson files).
- Testing: `ACT_SELFTEST=<script.js> ./build.noindex/ACT.app/Contents/MacOS/ACT` injects a script into the page
  (see `tools/devlog.js`, `tools/test_flow.js`, and `tools/test_vn.js` / `tools/test_idle.js` for the
  character mode with a faked tutor reply); add `ACT_DATA_DIR=<folder>` to use a scratch data folder.
- Third-party: Monaco Editor 0.52.2 (MIT), marked 12.0.2 (MIT), in `web/vendor/`.
