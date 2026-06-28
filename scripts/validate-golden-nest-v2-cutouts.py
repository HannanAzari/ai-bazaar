#!/usr/bin/env python3
"""Phase-2 validation of the Golden Nest V2 transparent cut-outs.

Inspects public/nests/golden-nest-v1/cutouts-v2/<obj> plus the opaque
background-v2.png, and writes:
  metadata/reports/golden-nest-v2-cutout-validation.json
  metadata/reports/golden-nest-v2-cutout-validation.md

Object rules: RGBA with a real alpha channel, min alpha == 0, > 10% transparent
pixels, no baked checkerboard, subject must not touch every canvas edge, and not a
fully-opaque rectangle. Background may be opaque. Exits non-zero on any failure.
"""

import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image

SRC_DIR = "public/nests/golden-nest-v1"
CUT_DIR = "public/nests/golden-nest-v1/cutouts-v2"
REPORT_DIR = "metadata/reports"
OBJECTS = [
    "avatar-v2.png", "tv-v2.png", "desk-v2.png", "bookshelf-v2.png",
    "frame-v2.png", "lamp-v2.png", "plant-v2.png", "books-v2.png",
]
MIN_TRANSPARENT_PCT = 10.0
OPAQUE_ALPHA = 250


def checkerboard_suspected(arr: np.ndarray) -> bool:
    """Heuristic: alternating light-gray tones among opaque pixels (a baked board)."""
    r, g, b, a = arr[..., 0].astype(int), arr[..., 1].astype(int), arr[..., 2].astype(int), arr[..., 3]
    opaque = a >= OPAQUE_ALPHA
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    avg = (r + g + b) / 3
    grayish = opaque & ((mx - mn) < 10) & (avg >= 170)
    if grayish.mean() <= 0.15:
        return False
    vals = avg[grayish]
    hist, edges = np.histogram(vals, bins=np.arange(168, 260, 4))
    order = np.argsort(hist)[::-1]
    if len(order) < 2:
        return False
    t1 = edges[order[0]] + 2
    t2 = edges[order[1]] + 2
    if abs(t1 - t2) < 12:
        return False
    # row alternation
    h = arr.shape[0]
    alt_rows, sampled = 0, 0
    for y in range(int(h * 0.1), int(h * 0.9), max(1, h // 40)):
        sampled += 1
        last, switches, seen = 0, 0, 0
        row = arr[y]
        for x in range(0, arr.shape[1], 2):
            if row[x, 3] < OPAQUE_ALPHA:
                continue
            rr, gg, bb = int(row[x, 0]), int(row[x, 1]), int(row[x, 2])
            if max(rr, gg, bb) - min(rr, gg, bb) >= 10:
                continue
            av = (rr + gg + bb) / 3
            if av < 170:
                continue
            cls = 1 if abs(av - t1) <= 8 else (2 if abs(av - t2) <= 8 else 0)
            if not cls:
                continue
            seen += 1
            if last and cls != last:
                switches += 1
            last = cls
        if seen > 20 and switches >= 6:
            alt_rows += 1
    return alt_rows >= max(3, sampled * 0.3)


def inspect(path: str):
    img = Image.open(path)
    mode = img.mode
    rgba = np.array(img.convert("RGBA"))
    a = rgba[..., 3]
    total = a.size
    transparent_pct = round(float((a < OPAQUE_ALPHA).mean() * 100), 2)
    amin, amax = int(a.min()), int(a.max())
    ys, xs = np.where(a > 0)
    if len(xs):
        bbox = [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]
    else:
        bbox = None
    h, w = a.shape
    edges = {
        "top": bool((a[0, :] > 0).any()),
        "bottom": bool((a[h - 1, :] > 0).any()),
        "left": bool((a[:, 0] > 0).any()),
        "right": bool((a[:, w - 1] > 0).any()),
    }
    touches_all = all(edges.values())
    return {
        "width": w, "height": h, "mode": mode,
        "hasAlpha": "A" in mode or img.mode == "RGBA",
        "alphaMin": amin, "alphaMax": amax,
        "transparentPct": transparent_pct,
        "bbox": bbox,
        "edgesTouched": [k for k, v in edges.items() if v],
        "touchesAllEdges": touches_all,
        "checkerboardSuspected": checkerboard_suspected(rgba),
    }


def decide(kind, info):
    if kind == "background":
        return "approved", "background — opaque allowed"
    if not info["hasAlpha"] or info["alphaMin"] != 0:
        return "rejected", "no real alpha (min alpha must reach 0)"
    if info["transparentPct"] < MIN_TRANSPARENT_PCT:
        return "rejected", f"insufficient transparency ({info['transparentPct']}% < {MIN_TRANSPARENT_PCT}%)"
    if info["checkerboardSuspected"]:
        return "rejected", "baked checkerboard detected"
    if info["touchesAllEdges"]:
        return "rejected", "subject touches every canvas edge (no transparent margin)"
    return "approved", f"genuine alpha cut-out ({info['transparentPct']}% transparent, min α 0)"


def main():
    results = []
    bg = os.path.join(SRC_DIR, "background-v2.png")
    results.append({"file": "background-v2.png", "kind": "background", **inspect(bg),
                    **dict(zip(("status", "reason"), decide("background", inspect(bg))))})
    for name in OBJECTS:
        p = os.path.join(CUT_DIR, name)
        if not os.path.exists(p):
            results.append({"file": name, "kind": "object", "status": "rejected", "reason": "missing cut-out"})
            continue
        info = inspect(p)
        status, reason = decide("object", info)
        results.append({"file": name, "kind": "object", **info, "status": status, "reason": reason})

    obj = [r for r in results if r["kind"] == "object"]
    summary = {
        "total": len(results),
        "approved": sum(r["status"] == "approved" for r in results),
        "rejected": sum(r["status"] == "rejected" for r in results),
        "objectsApproved": sum(r["status"] == "approved" for r in obj),
        "objectsRejected": sum(r["status"] == "rejected" for r in obj),
    }
    report = {
        "gate": "golden-nest-v2-cutout-validation",
        "phase": "Phase 2 — validate transparent cut-outs",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "directory": CUT_DIR,
        "rules": {"minTransparentPct": MIN_TRANSPARENT_PCT, "opaqueAlphaThreshold": OPAQUE_ALPHA,
                  "policy": "objects: RGBA, min alpha 0, >10% transparent, no checkerboard, must not touch all edges; background may be opaque"},
        "summary": summary,
        "results": results,
    }
    os.makedirs(REPORT_DIR, exist_ok=True)
    with open(os.path.join(REPORT_DIR, "golden-nest-v2-cutout-validation.json"), "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    with open(os.path.join(REPORT_DIR, "golden-nest-v2-cutout-validation.md"), "w") as f:
        f.write(render_md(report))

    print("\nGolden Nest V2 — Phase 2 cut-out validation")
    for r in results:
        mark = "✓" if r["status"] == "approved" else "✗"
        if r["kind"] == "object":
            print(f"  {mark} {r['file']:<16} {r.get('width','?')}x{r.get('height','?')} "
                  f"alpha={'Y' if r.get('hasAlpha') else 'N'} min={r.get('alphaMin','-')} max={r.get('alphaMax','-')} "
                  f"transp={r.get('transparentPct','-')}% edges={r.get('edgesTouched',[])} "
                  f"checker={'Y' if r.get('checkerboardSuspected') else 'n'}  {r['status'].upper()} — {r['reason']}")
        else:
            print(f"  {mark} {r['file']:<16} [background]  {r['status'].upper()} — {r['reason']}")
    print(f"\n  objects: {summary['objectsApproved']} approved · {summary['objectsRejected']} rejected\n")
    return 1 if summary["rejected"] else 0


def render_md(report):
    rows = "\n".join(
        f"| {'✅' if r['status']=='approved' else '❌'} | `{r['file']}` | {r['kind']} | "
        f"{r.get('width','—')}×{r.get('height','—')} | {r.get('mode','—')} | {'yes' if r.get('hasAlpha') else 'no'} | "
        f"{r.get('alphaMin','—')} | {r.get('alphaMax','—')} | {r.get('transparentPct','—') if r.get('transparentPct') is None else str(r.get('transparentPct','—'))+'%'} | "
        f"{','.join(r.get('edgesTouched',[])) or '—'} | {'**YES**' if r.get('checkerboardSuspected') else 'no'} | {r['reason']} |"
        for r in report["results"]
    )
    s = report["summary"]
    tail = ("**All cut-outs passed.**" if s["objectsRejected"] == 0
            else f"**{s['objectsRejected']} cut-out(s) rejected — do not wire V2.**")
    return f"""# Golden Nest V2 — Cut-out Validation (Phase 2)

> {report['phase']} · generated {report['generatedAt']} · dir `{report['directory']}`
>
> Object rules: RGBA, min alpha 0, > {report['rules']['minTransparentPct']}% transparent, no baked
> checkerboard, subject must not touch every edge. Background may be opaque.

**Summary:** {s['approved']} approved · {s['rejected']} rejected · objects {s['objectsApproved']}/{s['objectsApproved']+s['objectsRejected']} approved.

| Status | File | Kind | Size | Mode | Alpha ch. | Min α | Max α | Transparent | Edges touched | Checkerboard | Reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
{rows}

{tail}
"""


if __name__ == "__main__":
    sys.exit(main())
