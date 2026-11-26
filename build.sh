#!/bin/bash
# Builds "ACT.app" into ./build.noindex (the .noindex suffix keeps Spotlight and Launchpad
# from listing the build copy). Pass --install to also install it in /Applications.
set -euo pipefail
cd "$(dirname "$0")"

APP="build.noindex/ACT.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O -swift-version 5 -target "$(uname -m)-apple-macos13.0" \
  -o "$APP/Contents/MacOS/ACT" Sources/*.swift \
  -framework Cocoa -framework WebKit -framework UniformTypeIdentifiers

cp Resources/Info.plist "$APP/Contents/Info.plist"
cp -R web "$APP/Contents/Resources/web"
# The lesson roadmaps, as a script the page loads.
{ printf 'window.ACT_ROADMAPS = '; cat curriculum/roadmaps.json; printf ';\n'; } > "$APP/Contents/Resources/web/js/roadmaps.js"
# Tutor characters: each web/characters/<id>/character.json plus its sprite atlas description.
python3 -I - "$APP/Contents/Resources/web/js/characters-data.js" <<'PY'
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
# The tutor's reference library (lesson roadmaps + researched notes).
K="$APP/Contents/Resources/knowledge"
mkdir -p "$K/genesis"
cp -R curriculum "$K/curriculum"
cp knowledge/research_notes/"Genesis 68k programming library"/*.md "$K/genesis/"
if [ -f "knowledge/reports/Genesis 68k programming library.md" ]; then
  cp "knowledge/reports/Genesis 68k programming library.md" "$K/genesis/00-overview.md"
fi
mkdir -p "$K/nes"
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
