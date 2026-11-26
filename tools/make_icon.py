#!/usr/bin/env python3
"""Renders ACT's app icon (Resources/AppIcon.icns): the hand-drawn pixel "ACT" from web/js/appicon.js,
purple and yellow with an outline, drawn the same way the page draws icons picked in Preferences.

Usage: python3 tools/make_icon.py   (needs Pillow; uses sips and iconutil, which come with macOS)
"""
import re, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parent.parent
src = (root / "web/js/appicon.js").read_text()
block = src[src.index("const MASK = ["):]
mask = re.findall(r"'([.#]{56})'", block[:block.index("];")])
N = 56
assert len(mask) == N
BG, FILL, DARK = (0x6a, 0x3f, 0x9e), (0xff, 0xd8, 0x4a), (0x22, 0x1f, 0x5c)

letters = [[c == "#" for c in row] for row in mask]
at = lambda x, y: 0 <= x < N and 0 <= y < N and letters[y][x]
grown = [[any(at(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)) for x in range(N)] for y in range(N)]
art = Image.new("RGB", (N, N), BG)
px = art.load()
def paint(m, color, dx, dy):
    for y in range(N):
        for x in range(N):
            if m[y][x] and 0 <= x + dx < N and 0 <= y + dy < N:
                px[x + dx, y + dy] = color
paint(grown, DARK, 2, 2)
paint(grown, DARK, 0, 0)
paint(letters, FILL, 0, 0)

S, inset, size, r = 1024, 92, 840, 188
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([inset, inset + 12, inset + size, inset + size + 12], r, fill=(0, 0, 0, 72))
icon.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
shape = Image.new("L", (S, S), 0)
ImageDraw.Draw(shape).rounded_rectangle([inset, inset, inset + size, inset + size], r, fill=255)
body = Image.new("RGBA", (S, S), (0, 0, 0, 0))
body.paste(art.resize((size, size), Image.NEAREST), (inset, inset))
icon.paste(body, (0, 0), shape)

with tempfile.TemporaryDirectory() as tmp:
    big = Path(tmp) / "icon.png"
    icon.save(big)
    iconset = Path(tmp) / "AppIcon.iconset"
    iconset.mkdir()
    for s in (16, 32, 128, 256, 512):
        for scale, suffix in ((1, ""), (2, "@2x")):
            subprocess.run(["sips", "-z", str(s * scale), str(s * scale), str(big), "--out", str(iconset / f"icon_{s}x{s}{suffix}.png")],
                           check=True, capture_output=True)
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(root / "Resources/AppIcon.icns")], check=True)
print("Wrote Resources/AppIcon.icns")
