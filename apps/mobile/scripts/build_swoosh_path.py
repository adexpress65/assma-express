"""Build a variable-width calligraphic SVG from the measured reference geometry."""
from __future__ import annotations

import math
import os

OUT = r"c:\Dev\assma\apps\mobile\assets\swoosh-debug.svg"

# viewBox sized to the original swoosh aspect (287 x 42) -> 400 x 68 + pad
VB_W, VB_H = 400, 72


def cubic(p0, p1, p2, p3, n=48):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def lerp(a, b, t):
    return a + (b - a) * t


def catmull(points, n_per=12):
    if len(points) < 2:
        return points[:]
    pts = [points[0]] + points + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for j in range(n_per):
            t = j / n_per
            t2, t3 = t * t, t * t * t
            x = 0.5 * (
                2 * p1[0]
                + (-p0[0] + p2[0]) * t
                + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
            )
            y = 0.5 * (
                2 * p1[1]
                + (-p0[1] + p2[1]) * t
                + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
            )
            out.append((x, y))
    out.append(points[-1])
    return out


# Centerline in viewBox, from the reference scan (left blunt -> arch -> right hook
# -> underside return -> hairline -> terminal dot).
# Thickness is half-width in viewBox units.
spine = [
    # x, y, half-width
    (10, 18.5, 6.2),   # blunt heavy start under 厂
    (28, 19.8, 5.8),
    (55, 21.5, 5.4),
    (90, 22.8, 5.0),
    (130, 23.2, 4.6),  # slight arch high point
    (170, 22.0, 4.2),
    (210, 20.2, 3.6),
    (250, 19.0, 3.0),
    (290, 19.2, 2.6),
    (325, 21.0, 2.4),
    (352, 24.5, 2.2),  # enter the hook
    (372, 30.0, 2.1),
    (382, 38.0, 2.0),  # rightmost of the loop
    (376, 46.5, 2.0),
    (358, 50.8, 1.9),
    (330, 51.2, 1.8),
    (295, 48.6, 1.7),
    (260, 45.4, 1.55),
    (230, 43.0, 1.35),
    (208, 44.5, 1.15),  # hairline turns down
    (200, 50.5, 1.05),
    (206, 57.0, 1.15),
    (218, 61.5, 1.6),   # swell into the dot
    (228, 63.8, 2.8),
    (236, 64.2, 3.4),   # terminal blob
]

xy = [(p[0], p[1]) for p in spine]
hw = [p[2] for p in spine]
curve = catmull(xy, n_per=14)

# interpolate half-width along resampled curve by nearest spine param
def hw_at_xy(x, y):
    best, bd = hw[0], 1e9
    for (sx, sy), h in zip(xy, hw):
        d = (x - sx) ** 2 + (y - sy) ** 2
        if d < bd:
            bd, best = d, h
    return best


# Smooth hw along curve via projection on arc length of spine
spine_s = [0.0]
for i in range(1, len(xy)):
    spine_s.append(spine_s[-1] + math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]))
total_s = spine_s[-1] or 1.0


def hw_at_s(s):
    for i in range(1, len(spine_s)):
        if s <= spine_s[i]:
            t = (s - spine_s[i - 1]) / (spine_s[i] - spine_s[i - 1] or 1)
            return lerp(hw[i - 1], hw[i], t)
    return hw[-1]


# Compute arc length on curve
clen = [0.0]
for i in range(1, len(curve)):
    clen.append(clen[-1] + math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]))
scale_s = total_s / (clen[-1] or 1)

left, right = [], []
tangents = []
for i, (x, y) in enumerate(curve):
    if i == 0:
        dx, dy = curve[1][0] - x, curve[1][1] - y
    elif i == len(curve) - 1:
        dx, dy = x - curve[i - 1][0], y - curve[i - 1][1]
    else:
        dx, dy = curve[i + 1][0] - curve[i - 1][0], curve[i + 1][1] - curve[i - 1][1]
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L, dx / L
    h = hw_at_s(clen[i] * scale_s)
    left.append((x + nx * h, y + ny * h))
    right.append((x - nx * h, y - ny * h))
    tangents.append((dx / L, dy / L))

# Blunt cap at start: flat bar perpendicular to tangent
tx, ty = tangents[0]
# already have left[0] and right[0] as the flat cap endpoints

# Round-ish cap at the terminal blob: sample a semicircle from right[-1] to left[-1]
end = curve[-1]
ex, ey = end
etx, ety = tangents[-1]
enx, eny = -ety, etx
eh = hw_at_s(total_s)
cap = []
for k in range(1, 10):
    a = math.pi * k / 10  # 0 = right side, pi = left side, around the forward direction
    # rotate normal: from -normal (right) toward +tangent toward +normal (left)
    ca, sa = math.cos(a), math.sin(a)
    # start at -normal, rotate toward +tangent
    vx = -enx * math.cos(a) + etx * math.sin(a)
    vy = -eny * math.cos(a) + ety * math.sin(a)
    cap.append((ex + vx * eh, ey + vy * eh))

poly = left + cap + list(reversed(right))


def path_from(pts, close=True):
    d = [f"M {pts[0][0]:.2f} {pts[0][1]:.2f}"]
    for x, y in pts[1:]:
        d.append(f"L {x:.2f} {y:.2f}")
    if close:
        d.append("Z")
    return " ".join(d)


fill_d = path_from(poly, True)
write_d = "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in curve)
write_len = clen[-1]

# extra terminal dot (the swell already includes it; keep a circle for the animation pop)
dot = (236.0, 64.2, 3.6)

print("FILL_PATH")
print(fill_d)
print("WRITE_PATH")
print(write_d)
print("WRITE_LEN", round(write_len, 1))
print("DOT", dot)
print("poly pts", len(poly), "curve pts", len(curve))

with open(OUT, "w", encoding="utf-8") as f:
    f.write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_W} {VB_H}">'
        f'<rect width="100%" height="100%" fill="#fff"/>'
        f'<path d="{fill_d}" fill="#000"/>'
        f'<circle cx="{dot[0]}" cy="{dot[1]}" r="{dot[2]}" fill="#000"/>'
        f'<path d="{write_d}" fill="none" stroke="#f00" stroke-width="0.35" opacity="0.5"/>'
        f"</svg>"
    )
print("wrote", OUT)
