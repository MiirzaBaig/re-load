"""Turn a photo into a Reload "print": 4 tones, ordered (Bayer 8x8) dithering, big dots.

The look follows the homepage hero. Dots are drawn at a low resolution and then
enlarged with nearest-neighbour scaling, so they stay crisp and visible.
Needs Pillow (pip install pillow).

usage:
  python3 scripts/dither-print.py SRC OUT.png [--width 800] [--scale 3]
      [--crop x0 y0 x1 y1]   fractions of the photo to keep (default: all)
      [--palette ink|green]  ink = neutral greys, green = deep palm greens
"""
import argparse
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

PALETTES = {
    "ink": [(13, 13, 14), (46, 46, 48), (102, 102, 103), (186, 185, 182)],
    "green": [(9, 46, 35), (20, 72, 54), (46, 108, 82), (118, 168, 138)],
}
BAYER = [
    [0, 48, 12, 60, 3, 51, 15, 63], [32, 16, 44, 28, 35, 19, 47, 31],
    [8, 56, 4, 52, 11, 59, 7, 55], [40, 24, 36, 20, 43, 27, 39, 23],
    [2, 50, 14, 62, 1, 49, 13, 61], [34, 18, 46, 30, 33, 17, 45, 29],
    [10, 58, 6, 54, 9, 57, 5, 53], [42, 26, 38, 22, 41, 25, 37, 21],
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=800)
    ap.add_argument("--scale", type=int, default=3)
    ap.add_argument("--crop", type=float, nargs=4, default=[0, 0, 1, 1])
    ap.add_argument("--palette", choices=PALETTES, default="ink")
    a = ap.parse_args()

    im = Image.open(a.src).convert("RGB")
    w, h = im.size
    x0, y0, x1, y1 = a.crop
    im = im.crop((round(w * x0), round(h * y0), round(w * x1), round(h * y1)))
    gray = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=0.5)
    gray = ImageEnhance.Contrast(gray).enhance(1.15)
    gray = gray.resize((a.width, round(gray.height * a.width / gray.width)), Image.LANCZOS)
    # Crisp edges survive the reduction to four tones.
    gray = gray.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))

    palette = PALETTES[a.palette]
    levels = len(palette) - 1
    px = gray.load()
    W, H = gray.size
    out = Image.new("P", (W, H))
    out.putpalette(sum(palette, ()) + (0, 0, 0) * 252)
    op = out.load()
    for y in range(H):
        for x in range(W):
            v = px[x, y] / 255 * levels
            base = int(v)
            op[x, y] = min(levels, base + (1 if v - base > (BAYER[y % 8][x % 8] + 0.5) / 64 else 0))
    out = out.resize((W * a.scale, H * a.scale), Image.NEAREST)
    out.save(a.out, optimize=True, bits=2)
    print(a.out, out.size)


if __name__ == "__main__":
    main()
