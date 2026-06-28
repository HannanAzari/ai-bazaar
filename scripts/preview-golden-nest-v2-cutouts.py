#!/usr/bin/env python3
"""Phase-3 visual contact sheet for the V2 cut-outs.

Renders each cut-out on three backgrounds (transparency checkerboard, dark
charcoal, warm plaster) so halos, missing leaves, or damaged legs are visible.
Writes metadata/reports/golden-nest-v2-cutouts-preview.png. Diagnostic only — not
used by the app.
"""

import os
from PIL import Image, ImageDraw, ImageFont

CUT_DIR = "public/nests/golden-nest-v1/cutouts-v2"
OUT = "metadata/reports/golden-nest-v2-cutouts-preview.png"
OBJECTS = ["avatar-v2.png", "tv-v2.png", "desk-v2.png", "bookshelf-v2.png",
           "frame-v2.png", "lamp-v2.png", "plant-v2.png", "books-v2.png"]

CELL_W, CELL_H = 300, 320
PAD = 16
LABEL_W = 130
CHARCOAL = (43, 41, 46, 255)
PLASTER = (230, 207, 169, 255)


def checker_bg(w, h, sq=16):
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, h, sq):
        for x in range(0, w, sq):
            if (x // sq + y // sq) % 2 == 0:
                d.rectangle([x, y, x + sq, y + sq], fill=(204, 204, 204, 255))
    return img


def fit(img, box_w, box_h):
    w, h = img.size
    s = min(box_w / w, box_h / h)
    return img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)


def main():
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
    except Exception:
        font = ImageFont.load_default()

    cols = [("checkerboard", None), ("charcoal", CHARCOAL), ("warm plaster", PLASTER)]
    sheet_w = LABEL_W + len(cols) * (CELL_W + PAD) + PAD
    sheet_h = PAD + 28 + len(OBJECTS) * (CELL_H + PAD)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (250, 247, 240, 255))
    d = ImageDraw.Draw(sheet)

    for ci, (name, _) in enumerate(cols):
        x = LABEL_W + ci * (CELL_W + PAD) + PAD
        d.text((x, PAD), name, fill=(56, 41, 29, 255), font=font)

    for ri, obj in enumerate(OBJECTS):
        y = PAD + 28 + ri * (CELL_H + PAD)
        d.text((PAD, y + CELL_H // 2), obj.replace("-v2.png", ""), fill=(56, 41, 29, 255), font=font)
        cut = Image.open(os.path.join(CUT_DIR, obj)).convert("RGBA")
        thumb = fit(cut, CELL_W - 12, CELL_H - 12)
        for ci, (cname, color) in enumerate(cols):
            x = LABEL_W + ci * (CELL_W + PAD) + PAD
            cell = checker_bg(CELL_W, CELL_H) if color is None else Image.new("RGBA", (CELL_W, CELL_H), color)
            ox = (CELL_W - thumb.size[0]) // 2
            oy = (CELL_H - thumb.size[1]) // 2
            cell.alpha_composite(thumb, (ox, oy))
            sheet.alpha_composite(cell, (x, y))
            d.rectangle([x, y, x + CELL_W, y + CELL_H], outline=(0, 0, 0, 40))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.convert("RGB").save(OUT)
    print(f"wrote {OUT} ({sheet_w}x{sheet_h})")


if __name__ == "__main__":
    main()
