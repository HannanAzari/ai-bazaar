#!/usr/bin/env python3
"""Create production transparent cut-outs from the opaque V2 source art.

Uses rembg's `isnet-general-use` segmentation model (real foreground/background
segmentation — NOT colour-threshold removal) with alpha matting for clean edges,
then light Pillow post-processing:
  - drop near-zero alpha (kills faint white/checkerboard halo)
  - trim to the content bounding box, then re-pad ~8% so the subject never
    touches the canvas edge (and keeps reasonable transparent padding)

Inputs:  public/nests/golden-nest-v1/<name>-v2.png   (opaque sources — unchanged)
Outputs: public/nests/golden-nest-v1/cutouts-v2/<name>-v2.png  (RGBA)

Run with the isolated venv:
  <venv>/bin/python scripts/cutout-golden-nest-v2.py
"""

import io
import os
import sys

import numpy as np
from PIL import Image
from rembg import new_session, remove

SRC_DIR = "public/nests/golden-nest-v1"
OUT_DIR = "public/nests/golden-nest-v1/cutouts-v2"
OBJECTS = [
    "avatar-v2.png",
    "tv-v2.png",
    "desk-v2.png",
    "bookshelf-v2.png",
    "frame-v2.png",
    "lamp-v2.png",
    "plant-v2.png",
    "books-v2.png",
]

# Alpha below this is treated as background (removes faint halo / spill).
ALPHA_FLOOR = 12
# Padding added around the trimmed subject, as a fraction of the trimmed size.
PAD_FRAC = 0.08


def clean_alpha(img: Image.Image) -> Image.Image:
    """Zero out near-transparent halo pixels without blurring the silhouette."""
    arr = np.array(img.convert("RGBA"))
    a = arr[:, :, 3].astype(np.int16)
    a[a < ALPHA_FLOOR] = 0
    arr[:, :, 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def trim_and_pad(img: Image.Image) -> Image.Image:
    """Crop to the alpha bounding box, then pad so the subject never touches an edge."""
    arr = np.array(img)
    a = arr[:, :, 3]
    ys, xs = np.where(a > 0)
    if len(xs) == 0:
        return img  # nothing to do (shouldn't happen for a valid cut-out)
    x0, x1 = xs.min(), xs.max() + 1
    y0, y1 = ys.min(), ys.max() + 1
    cropped = img.crop((x0, y0, x1, y1))
    w, h = cropped.size
    pad = max(8, int(round(max(w, h) * PAD_FRAC)))
    out = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    out.paste(cropped, (pad, pad), cropped)
    return out


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    session = new_session("isnet-general-use")
    print(f"model: isnet-general-use | rembg session ready\n")
    for name in OBJECTS:
        src = os.path.join(SRC_DIR, name)
        if not os.path.exists(src):
            print(f"  ! missing source: {src}")
            return 2
        with open(src, "rb") as f:
            raw = f.read()
        cut = remove(
            raw,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
            post_process_mask=True,
        )
        img = Image.open(io.BytesIO(cut)).convert("RGBA")
        img = clean_alpha(img)
        img = trim_and_pad(img)
        out = os.path.join(OUT_DIR, name)
        img.save(out)
        a = np.array(img)[:, :, 3]
        transp = float((a < 250).mean() * 100.0)
        print(f"  ✓ {name:<16} {img.size[0]}x{img.size[1]}  transparent={transp:5.1f}%  -> {out}")
    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
