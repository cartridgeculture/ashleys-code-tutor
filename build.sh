#!/bin/bash
# Builds "ACT.app" into ./build.noindex: the web app in ./web, wrapped by the Tauri (Rust) shell in
# ./src-tauri. (The .noindex suffix keeps Spotlight and Launchpad from listing the build copy.)
# Pass --install to also install it in /Applications.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:/opt/homebrew/opt/rustup/bin:$PATH"

# 1. The page, plus files generated from the curriculum and the characters. Tauri embeds this
#    folder into the program when it compiles.
STAGE="build.noindex/web"
mkdir -p build.noindex
rm -rf "$STAGE"
cp -R web "$STAGE"
{ printf 'window.ACT_ROADMAPS = '; cat curriculum/roadmaps.json; printf ';\n'; } > "$STAGE/js/roadmaps.js"
python3 -I - "$STAGE/js/characters-data.js" <<'PY'
import json, sys, pathlib
out = []
for d in sorted(pathlib.Path("web/characters").iterdir()):
    cj, aj = d / "character.json", d / "atlas.json"
    if cj.exists() and aj.exists():
        c = json.loads(cj.read_text())
        c["atlas"] = json.loads(aj.read_text())
        out.append(c)
pathlib.Path(sys.argv[1]).write_text("window.ACT_CHARACTERS = " + json.dumps(out) + ";\n")
PY

# 2. The program.
(cd src-tauri && cargo build --release --quiet)

# 3. The app bundle.
APP="build.noindex/ACT.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp src-tauri/target/release/act "$APP/Contents/MacOS/ACT"
cp Resources/Info.plist "$APP/Contents/Info.plist"
# The tutor's reference library (lesson roadmaps + researched notes).
K="$APP/Contents/Resources/knowledge"
mkdir -p "$K/genesis" "$K/nes"
cp -R curriculum "$K/curriculum"
cp knowledge/research_notes/"Genesis 68k programming library"/*.md "$K/genesis/"
if [ -f "knowledge/reports/Genesis 68k programming library.md" ]; then
  cp "knowledge/reports/Genesis 68k programming library.md" "$K/genesis/00-overview.md"
fi
cp knowledge/research_notes/"NES 6502 programming library"/*.md "$K/nes/"
if [ ! -f Resources/AppIcon.icns ]; then ./tools/make_icon.sh; fi
cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
# ACT's first icon, offered as "Original" in Preferences > App icon.
cp Resources/OriginalIcon.png "$APP/Contents/Resources/OriginalIcon.png"
codesign --force --sign - "$APP" >/dev/null
echo "Built $APP"

if [ "${1:-}" = "--install" ]; then
  DEST="/Applications"
  [ -w "$DEST" ] || DEST="$HOME/Applications"
  mkdir -p "$DEST"
  rm -rf "$DEST/ACT.app"
  cp -R "$APP" "$DEST/"
  echo "Installed to $DEST/ACT.app"
fi
