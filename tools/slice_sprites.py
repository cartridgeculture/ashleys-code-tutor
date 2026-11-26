#!/usr/bin/env python3
"""Cuts an Ace Attorney-style sprite sheet into an animation atlas for ACT's character scene.

Usage: python3 tools/slice_sprites.py assets-src/<id>/slice.json web/characters/<id> [preview.png]

The sheet must be the original, lossless rip (PNG): every pixel that is exactly the sheet's
background colour becomes transparent and every other pixel is kept exactly as it is, so the
sprites stay pixel-for-pixel identical to the sheet. Nothing is scaled, filtered or trimmed.

slice.json: {"sheet", "background" (optional; default = the most common colour),
  "reference": the expression every other one is lined up against,
  "avatar": {"emotion", "frame", "size", "x", "y"} (x/y: top-left of the face crop, relative to
            the frame's top-left in the sheet),
  "emotions": [{"name", "label", "boxes": [[x0, y0, x1, y1], ...], "idle": [...], "talk": [...],
                "intro": [...], "align": "hips" (for poses turned to the side: line up the middle of
                the bottom edge instead of matching pixels), "nudge": [dx, dy] (manual correction)}]}
Frames are the large connected sprites inside an expression's boxes, in reading order; labels,
brackets and credits on the sheet are small and are ignored.

Lining up: every frame's bottom edge sits on the bottom of the screen (the games cut sprites off
there). Sideways, each frame is matched against its expression's first frame (the offset where the
most pixels are identical), so blinking and talking never jitter. Each expression's first
frame is matched against the reference expression the same way, so changing expression keeps
the body in place, the way the games swap poses.

Writes atlas.png (one row per expression, one column per frame, all cells the same size),
atlas.json (cell size, anchor, frame lists) and avatar.png (a face crop at the sheet's own size).
"""
import json, sys
from collections import Counter
from pathlib import Path
from PIL import Image, ImageChops

cfg_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
preview_path = Path(sys.argv[3]) if len(sys.argv) > 3 else None
cfg = json.loads(cfg_path.read_text())
sheet = Image.open(cfg_path.parent / cfg["sheet"]).convert("RGB")
W, H = sheet.size
bg = tuple(cfg["background"]) if cfg.get("background") else Counter(sheet.getdata()).most_common(1)[0][0]

# Opaque = any pixel that isn't exactly the background colour.
diff = ImageChops.difference(sheet, Image.new("RGB", sheet.size, bg))
r, g, b = diff.split()
alpha = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v else 0)
rgba = Image.composite(sheet.convert("RGBA"), Image.new("RGBA", sheet.size, (0, 0, 0, 0)), alpha)
rgba.putalpha(alpha)
opaque = alpha.tobytes()


def components(box, min_pixels=800):
    """Connected sprites (8-neighbour) inside a box of the sheet: [(bbox, pixel indexes)].
    Small pieces (labels, brackets, credits) are left out."""
    x0, y0, x1, y1 = box
    seen = set()
    found = []
    for y in range(y0, y1):
        row = y * W
        for x in range(x0, x1):
            i = row + x
            if not opaque[i] or i in seen:
                continue
            stack = [i]
            seen.add(i)
            pixels = []
            n, bx0, by0, bx1, by1 = 0, x, y, x, y
            while stack:
                j = stack.pop()
                n += 1
                pixels.append(j)
                jy, jx = divmod(j, W)
                bx0, bx1, by0, by1 = min(bx0, jx), max(bx1, jx), min(by0, jy), max(by1, jy)
                for dy in (-1, 0, 1):
                    yy = jy + dy
                    if yy < y0 or yy >= y1:
                        continue
                    for dx in (-1, 0, 1):
                        xx = jx + dx
                        if xx < x0 or xx >= x1:
                            continue
                        k = yy * W + xx
                        if opaque[k] and k not in seen:
                            seen.add(k)
                            stack.append(k)
            if n >= min_pixels:
                found.append(((bx0, by0, bx1 + 1, by1 + 1), pixels))
    return found


def cut(bbox, pixels):
    """The frame's own pixels only: neighbouring frames can reach into its bounding box."""
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    own = bytearray(w * h)
    for j in pixels:
        jy, jx = divmod(j, W)
        own[(jy - y0) * w + (jx - x0)] = 255
    frame = rgba.crop(bbox)
    frame.putalpha(Image.frombytes("L", (w, h), bytes(own)))
    return Image.composite(frame, Image.new("RGBA", (w, h), (0, 0, 0, 0)), frame.getchannel("A"))


def same_pixels(a, b, ox, oy):
    """How many opaque pixels are identical when b is placed at (ox, oy) relative to a."""
    x0, y0 = min(0, ox), min(0, oy)
    x1, y1 = max(a.width, ox + b.width), max(a.height, oy + b.height)
    size = (x1 - x0, y1 - y0)
    A = Image.new("RGBA", size, (0, 0, 0, 0)); A.paste(a, (-x0, -y0))
    B = Image.new("RGBA", size, (0, 0, 0, 0)); B.paste(b, (ox - x0, oy - y0))
    d = ImageChops.difference(A, B).split()
    differs = ImageChops.lighter(ImageChops.lighter(d[0], d[1]), ImageChops.lighter(d[2], d[3]))
    equal = differs.point(lambda v: 0 if v else 255)
    both = ImageChops.multiply(A.getchannel("A"), B.getchannel("A"))
    return ImageChops.multiply(equal, both).histogram()[255]


def register(a, b, guess, rx):
    """Best sideways offset of b relative to a near `guess`. The vertical offset stays as guessed:
    Ace Attorney sprites are all cut off by the bottom of the screen, so their bottom edges line up."""
    gx, gy = guess
    score, ox = max((same_pixels(a, b, gx + dx, gy), gx + dx) for dx in range(-rx, rx + 1))
    return (ox, gy), score


# ---- find each expression's frames ----
emotions = []
for e in cfg["emotions"]:
    found = []
    for box in e["boxes"]:
        found += sorted(components(box), key=lambda c: c[0][0])
    boxes = [c[0] for c in found]
    frames = [cut(*c) for c in found]
    emotions.append({"cfg": e, "boxes": boxes, "frames": frames})
    print(f"{e['name']:<11} {len(frames)} frames  " + " ".join(f"{c[2]-c[0]}x{c[3]-c[1]}" for c in boxes))


def bottom_center_guess(a_box, b_box):
    """Offset of b's top-left from a's top-left that puts their bottom centres together."""
    aw, ah = a_box[2] - a_box[0], a_box[3] - a_box[1]
    bw, bh = b_box[2] - b_box[0], b_box[3] - b_box[1]
    return round((aw - bw) / 2), ah - bh


def hips(frame):
    """Middle of the sprite's bottom edge (where the screen cuts it off)."""
    row = frame.crop((0, frame.height - 1, frame.width, frame.height)).getchannel("A").tobytes()
    xs = [x for x, v in enumerate(row) if v]
    return (xs[0] + xs[-1] + 1) / 2


# Offsets of every frame relative to its expression's first frame.
for em in emotions:
    first, fbox = em["frames"][0], em["boxes"][0]
    em["offsets"] = [(0, 0)]
    for f, box in zip(em["frames"][1:], em["boxes"][1:]):
        # Frames of one expression are cut to the same size on the sheet, so start from the
        # bottom-centre guess and let the pixel match settle it.
        guess = bottom_center_guess(fbox, box)
        (ox, oy), score = register(first, f, guess, 12)
        em["offsets"].append((ox, oy))

# Offset of each expression's first frame relative to the reference expression.
ref = next(em for em in emotions if em["cfg"]["name"] == cfg["reference"])
for em in emotions:
    if em is ref:
        em["origin"] = (0, 0)
        continue
    guess = bottom_center_guess(ref["boxes"][0], em["boxes"][0])
    if em["cfg"].get("align") == "hips":
        # A pose turned to the side shares too little with the reference for a pixel match:
        # keep the hips (the middle of the bottom edge) in the same place instead.
        ox = round(hips(ref["frames"][0]) - hips(em["frames"][0]))
        oy, score = guess[1], "hips"
    else:
        (ox, oy), score = register(ref["frames"][0], em["frames"][0], guess, 40)
    nx, ny = em["cfg"].get("nudge", (0, 0))
    em["origin"] = (ox + nx, oy + ny)
    print(f"  {em['cfg']['name']:<11} placed at {em['origin']} ({score} identical pixels with {cfg['reference']})")

# ---- lay out the atlas ----
placed = []  # (emotion index, frame index, x, y, image)
for ei, em in enumerate(emotions):
    for fi, (f, (ox, oy)) in enumerate(zip(em["frames"], em["offsets"])):
        placed.append((ei, fi, em["origin"][0] + ox, em["origin"][1] + oy, f))
minx = min(p[2] for p in placed)
miny = min(p[3] for p in placed)
cw = max(p[2] + p[4].width for p in placed) - minx
ch = max(p[3] + p[4].height for p in placed) - miny
cols = max(len(em["frames"]) for em in emotions)
atlas = Image.new("RGBA", (cw * cols, ch * len(emotions)), (0, 0, 0, 0))
for ei, fi, x, y, f in placed:
    atlas.paste(f, (fi * cw + x - minx, ei * ch + y - miny))

refw, refh = ref["frames"][0].size
# Centre the character on her head (the top of the reference pose), not on her outline, which
# props or sleeves can pull to one side.
_top = ref["frames"][0].crop((0, 0, refw, 8)).getchannel("A").getbbox()
anchor_x = -minx + ((_top[0] + _top[2]) // 2 if _top else refw // 2)
ref_top = -miny
ref_bottom = -miny + refh

out_dir.mkdir(parents=True, exist_ok=True)
atlas.save(out_dir / "atlas.png", optimize=True)

meta = {
    "cell": [cw, ch],
    "anchor": [anchor_x, ref_bottom],
    "refTop": ref_top,
    # The reference pose's box: the scene sizes the character by it (wider poses may reach the edges).
    "refBox": [-minx, ref_top, refw, refh],
    "bust": [anchor_x - 42, ref_top - 2, 84, 84],
    "emotions": {},
}
for ei, em in enumerate(emotions):
    e = em["cfg"]
    n = len(em["frames"])
    entry = {"row": ei, "frames": n, "label": e.get("label", e["name"]),
             "idle": e.get("idle", [0]), "talk": e.get("talk", e.get("idle", [0]))}
    if e.get("intro"):
        entry["intro"] = e["intro"]
    bad = [i for i in entry["idle"] + entry["talk"] + entry.get("intro", []) if i >= n]
    if bad:
        sys.exit(f"{e['name']}: frame numbers {bad} don't exist (it has {n} frames)")
    meta["emotions"][e["name"]] = entry
(out_dir / "atlas.json").write_text(json.dumps(meta, indent=1) + "\n")

# ---- avatar: a face crop at the sheet's own pixel size ----
av = cfg["avatar"]
aem = next(em for em in emotions if em["cfg"]["name"] == av["emotion"])
abox = aem["boxes"][av.get("frame", 0)]
s = av["size"]
face = rgba.crop((abox[0] + av["x"], abox[1] + av["y"], abox[0] + av["x"] + s, abox[1] + av["y"] + s))
face.save(out_dir / "avatar.png", optimize=True)

print(f"atlas {atlas.width}x{atlas.height}, cell {cw}x{ch}, anchor {meta['anchor']}, ref top {ref_top}")

if preview_path:
    # Every frame on a bright backdrop at 2x, plus an overlay strip per expression (frame 0 vs
    # each other frame) to check that nothing moves.
    k = 2
    pv = Image.new("RGBA", (cw * cols * k, ch * len(emotions) * k), (40, 200, 90, 255))
    big = atlas.resize((atlas.width * k, atlas.height * k), Image.NEAREST)
    pv.alpha_composite(big)
    pv.convert("RGB").save(preview_path)
