"""Rebuild the calligraphic swoosh from the splash reference."""
from __future__ import annotations

import math
import os
from collections import deque
from PIL import Image

SRC = r"C:\Users\AskiaWin11\.cursor\projects\c-Dev\assets\c__Users_AskiaWin11_AppData_Roaming_Cursor_User_workspaceStorage_c62e7cae85c3c8487d7ee0cf355d4c7e_images_WhatsApp_Image_2026-08-18_at_23.02.25-d5085bcb-0e33-43aa-83e9-59bb91ec8f11.png"
OUT_DIR = r"c:\Dev\assma\apps\mobile\assets"
LEFT, TOP, RIGHT, BOTTOM = 84, 483, 384, 536


def rdp(points, epsilon):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    abx, aby = b[0] - a[0], b[1] - a[1]
    ab_len = math.hypot(abx, aby) or 1.0
    max_d, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(abx * (a[1] - py) - (a[0] - px) * aby) / ab_len
        if d > max_d:
            max_d, idx = d, i
    if max_d > epsilon:
        return rdp(points[: idx + 1], epsilon)[:-1] + rdp(points[idx:], epsilon)
    return [a, b]


def largest_component(mask, w, h):
    seen = [[False] * w for _ in range(h)]
    best = []
    for y in range(h):
        for x in range(w):
            if not mask[y][x] or seen[y][x]:
                continue
            blob = []
            q = deque([(x, y)])
            seen[y][x] = True
            while q:
                cx, cy = q.popleft()
                blob.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if len(blob) > len(best):
                best = blob
    return best


def moore(mask, w, h, start):
    dirs = [(-1, 0), (-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1)]
    x, y = start
    bx, by = x - 1, y
    contour = []
    start_back = (bx, by)
    for _ in range(w * h * 8):
        contour.append((x, y))
        # find backtrack in neighbor ring
        try:
            bi = dirs.index((bx - x, by - y))
        except ValueError:
            bi = 0
        found = None
        for k in range(1, 9):
            dx, dy = dirs[(bi + k) % 8]
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and mask[ny][nx]:
                found = (nx, ny, x + dirs[(bi + k - 1) % 8][0], y + dirs[(bi + k - 1) % 8][1])
                break
        if not found:
            break
        nx, ny, bx, by = found
        if (nx, ny) == start and (bx, by) == start_back and len(contour) > 4:
            break
        x, y = nx, ny
    return contour


def polyline_len(pts):
    return sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))


im = Image.open(SRC).convert("RGB")
crop = im.crop((LEFT, TOP, RIGHT, BOTTOM))
cw, ch = crop.size
px = crop.load()

mask = [[False] * cw for _ in range(ch)]
ink = 0
for y in range(ch):
    for x in range(cw):
        r, g, b = px[x, y]
        if (r + g + b) / 3 < 130:
            mask[y][x] = True
            ink += 1
print("crop", cw, ch, "ink", ink)

# 1px dilate to reconnect JPEG gaps, then keep largest blob
dil = [[False] * cw for _ in range(ch)]
for y in range(ch):
    for x in range(cw):
        if mask[y][x]:
            for ny in range(max(0, y - 1), min(ch, y + 2)):
                for nx in range(max(0, x - 1), min(cw, x + 2)):
                    dil[ny][nx] = True

blob = largest_component(dil, cw, ch)
keep = set(blob)
print("largest blob", len(blob))
comp = [[(x, y) in keep for x in range(cw)] for y in range(ch)]

# PNG: original luminance as alpha, black ink, only on component
rgba = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
rp = rgba.load()
for x, y in blob:
    r, g, b = px[x, y]
    lum = (r + g + b) / 3
    a = 255 if lum < 90 else int(max(40, min(255, (130 - lum) * 4)))
    rp[x, y] = (0, 0, 0, a)

scale = 5
big = rgba.resize((cw * scale, ch * scale), Image.Resampling.NEAREST)
bbox = big.getbbox()
big = big.crop(bbox)
pad = 20
asset = Image.new("RGBA", (big.size[0] + pad * 2, big.size[1] + pad * 2), (0, 0, 0, 0))
asset.paste(big, (pad, pad), big)
asset.save(os.path.join(OUT_DIR, "swoosh.png"))

dbg = Image.new("RGB", asset.size, (255, 255, 255))
dbg.paste(asset, (0, 0), asset)
dbg.save(os.path.join(OUT_DIR, "swoosh-debug.png"))
print("png", asset.size)

# runs
print("--- runs sample ---")
for x in list(range(0, cw, 8)) + [cw - 1]:
    runs = []
    y = 0
    while y < ch:
        if comp[y][x]:
            y0 = y
            while y < ch and comp[y][x]:
                y += 1
            runs.append((y0, y - 1))
        else:
            y += 1
    if runs:
        print(f"x={x:3d} runs={runs}")

start = min(blob, key=lambda p: (p[0], p[1]))
contour = moore(comp, cw, ch, start)
print("contour", len(contour), "start", start)
simple = rdp(contour, 1.05)
print("simple", len(simple))

vb_w, pad_x, pad_y = 400, 10, 8
vb_h = round((ch / cw) * (vb_w - 2 * pad_x) + 2 * pad_y)
sx = (vb_w - 2 * pad_x) / cw
sy = (vb_h - 2 * pad_y) / ch


def vb(pts):
    return [(round(pad_x + x * sx, 2), round(pad_y + y * sy, 2)) for x, y in pts]


fill_pts = vb(simple)
fill_d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in fill_pts) + " Z"

# Writing centerline: top run L->R, then bottom run R->L
top, bot = [], []
for x in range(cw):
    runs = []
    y = 0
    while y < ch:
        if comp[y][x]:
            y0 = y
            while y < ch and comp[y][x]:
                y += 1
            runs.append((y0, y - 1))
        else:
            y += 1
    if not runs:
        continue
    a, b = runs[0]
    top.append((x, (a + b) / 2))
    a, b = runs[-1]
    bot.append((x, (a + b) / 2))

write = top + list(reversed(bot[:-1] if bot else []))
write_s = rdp(write, 0.85)
write_vb = vb(write_s)
write_d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in write_vb)
print("viewBox", vb_w, vb_h)
print("write len", round(polyline_len(write_vb), 1), "pts", len(write_s))
print("FILL=")
print(fill_d)
print("WRITE=")
print(write_d)

with open(os.path.join(OUT_DIR, "swoosh-paths.txt"), "w", encoding="utf-8") as f:
    f.write(f"VIEWBOX {vb_w} {vb_h}\n")
    f.write(f"WRITE_LEN {polyline_len(write_vb):.1f}\n")
    f.write("FILL\n" + fill_d + "\n")
    f.write("WRITE\n" + write_d + "\n")
