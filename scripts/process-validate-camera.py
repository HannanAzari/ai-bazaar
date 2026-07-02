#!/usr/bin/env python3
"""Nestudio Camera DNA Lock — P0 validation: process + validate + score + select.

Same engine as the M9 validator, pointed at the camera-DNA validation pack. For each
of the 3 candidates per asset: resize the master to spec, cut objects to alpha + trim,
emit mobile/standard/focus WebP variants, validate, and score 5 dimensions. Selects the
top candidate per asset as a RECOMMENDATION (never "approved"). Camera-pitch conformance
(10° downward) is a MANUAL visual check — flagged per asset, not auto-scored.

    python3 scripts/process-validate-camera.py   (after generate-camera-validation.mjs)

Pillow only. Writes:
    metadata/reports/camera-dna-p0-validation.md
    metadata/reports/camera-dna-p0-validation.json
"""

import json, os, sys
from datetime import datetime, timezone

try:
    from PIL import Image, ImageDraw, ImageStat, ImageFilter
except Exception:
    print("Pillow (PIL) required: pip install pillow", file=sys.stderr); sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, "public/nests/camera-dna-v1/candidates")
REPORTS = os.path.join(ROOT, "metadata/reports")
MANIFEST = os.path.join(CAND, "metadata", "manifest.json")
REPORT_BASE = "camera-dna-p0-validation"
ASPECT_TOL = 0.15
OBJ_STANDARD, OBJ_MOBILE = 1024, 512
CAMERA_NOTE = "MANUAL: confirm locked camera DNA — ~180cm eye level, 10° downward pitch, 35-40mm, subtle natural perspective (not iso/ortho/wide-angle)."


def aspect_value(a): w, h = a.split(":"); return float(w) / float(h)
def rel(p): return p.replace(ROOT + "/", "")


def cutout_alpha(im, tol=30):
    im = im.convert("RGBA"); w, h = im.size
    corners = [im.getpixel((1, 1)), im.getpixel((w - 2, 1)), im.getpixel((1, h - 2)), im.getpixel((w - 2, h - 2))]
    close = lambda a, b: all(abs(a[i] - b[i]) <= tol for i in range(3))
    reliable = all(close(corners[0], c) for c in corners[1:])
    for c in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]:
        ImageDraw.floodfill(im, c, (0, 0, 0, 0), thresh=tol)
    frac = sum(1 for p in im.split()[3].getdata() if p == 0) / (w * h)
    return im, reliable, frac


def trim(im):
    b = im.split()[3].getbbox() if im.mode == "RGBA" else im.getbbox()
    return im.crop(b) if b else im


def save_webp(im, path, max_kb=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for q in range(92, 39, -6):
        im.save(path, "WEBP", quality=q, method=6)
        kb = os.path.getsize(path) / 1024
        if max_kb is None or kb <= max_kb: return q, kb
    return q, kb


def resize_longest(im, longest):
    w, h = im.size; s = longest / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def warmth_score(im):
    s = im.convert("RGB").resize((64, 64)); px = list(s.getdata()); warm = grey = 0
    for r, g, b in px:
        if max(r, g, b) - min(r, g, b) < 12: grey += 1
        elif r >= g >= b: warm += 1
    n = len(px); return round(min(10.0, (warm / n) * 12 - (grey / n) * 4 + 4), 2)


def sharpness_score(im, cap=42.0):
    sd = ImageStat.Stat(im.convert("L").filter(ImageFilter.FIND_EDGES)).stddev[0]
    return round(min(10.0, sd / cap * 10), 2)


def composition_score(wh, center_off, aspect_ok):
    fill = max(wh[0] / wh[0], wh[1] / wh[1])  # normalized-to-self → 1; use centering + aspect mainly
    center_s = 10 - (abs(center_off[0]) + abs(center_off[1])) * 20
    return round(max(0, min(10, (center_s + (10 if aspect_ok else 5) + 9) / 3)), 2)


def transparency_score(reliable, frac, corners_clear):
    if not corners_clear: return 2.0
    if frac < 0.05: return 3.0
    s = 8.0 if reliable else 5.0
    if frac > 0.35: s += 1.5
    return round(min(10.0, s), 2)


def process_candidate(asset, cand):
    src = os.path.join(ROOT, cand["masterPath"])
    im = Image.open(src); cdir = os.path.dirname(src)
    mw, mh = asset["masterResolution"]; issues, notes = [], [CAMERA_NOTE]
    result = {"candidate": cand["candidate"]}

    if asset["kind"] == "object":
        rgba, reliable, frac = cutout_alpha(im)
        trimmed = trim(rgba); tw, th = trimmed.size
        Image.open(src).convert("RGB").resize((mw, mh)).save(os.path.join(cdir, f"{asset['id']}-master.png"))
        cut = os.path.join(cdir, f"{asset['id']}-cutout.png"); trimmed.save(cut)
        focus_long = max(mw, mh); variants = {}
        for tier, longest, cap in [("focus", focus_long, None), ("standard", OBJ_STANDARD, asset["deliverMaxKB"]), ("mobile", OBJ_MOBILE, asset["deliverMaxKB"])]:
            vp = os.path.join(cdir, "variants", tier, f"{asset['id']}.webp")
            q, kb = save_webp(resize_longest(trimmed, longest), vp, cap)
            variants[tier] = {"path": rel(vp), "kb": round(kb, 1), "quality": q, "longest": longest}
        target = asset.get("trimToAspect"); ratio = tw / th if th else 0; aspect_ok = True
        if target:
            tr = aspect_value(target); aspect_ok = abs(ratio - tr) / tr <= ASPECT_TOL
            if not aspect_ok: issues.append(f"trimmed aspect {ratio:.2f} vs target {target} ({tr:.2f}) beyond {int(ASPECT_TOL*100)}% tol")
        corners_clear = all(trimmed.split()[3].getpixel(c) == 0 for c in [(0, 0), (tw - 1, 0), (0, th - 1), (tw - 1, th - 1)]) if tw and th else False
        if frac < 0.05: issues.append("little/no transparency after cut-out (baked background likely)")
        if not reliable: issues.append("background not uniform — auto cut-out UNRELIABLE; recommend rembg/manual matte")
        bb = rgba.split()[3].getbbox()
        cxo = ((bb[0] + bb[2]) / 2) / rgba.size[0] - 0.5; cyo = ((bb[1] + bb[3]) / 2) / rgba.size[1] - 0.5
        scores = {"dnaAdherence": warmth_score(trimmed), "composition": composition_score((tw, th), (cxo, cyo), aspect_ok),
                  "transparency": transparency_score(reliable, frac, corners_clear),
                  "focusReadability": sharpness_score(resize_longest(trimmed, focus_long)), "editableSurfaceSuitability": 7.0}
        result.update({"masterPng": rel(os.path.join(cdir, f"{asset['id']}-master.png")), "cutoutPng": rel(cut), "variants": variants,
                       "trimmedResolution": [tw, th],
                       "transparency": {"hasAlpha": frac > 0.02, "transparentFraction": round(frac, 3), "cornersClear": corners_clear, "cutoutReliable": reliable},
                       "aspectRatio": {"target": target, "actual": round(ratio, 3), "ok": aspect_ok}, "editableSurface": None})
    else:
        rgb = im.convert("RGB"); rgb.resize((mw, mh)).save(os.path.join(cdir, f"{asset['id']}-master.png"))
        variants = {}
        for tier, wpx, cap in [("focus", mw, None), ("standard", 1080, asset["deliverMaxKB"]), ("mobile", 720, asset["deliverMaxKB"])]:
            hpx = round(wpx * 4 / 3); vp = os.path.join(cdir, "variants", tier, f"{asset['id']}.webp")
            q, kb = save_webp(rgb.resize((wpx, hpx)), vp, cap)
            variants[tier] = {"path": rel(vp), "kb": round(kb, 1), "quality": q, "size": [wpx, hpx]}
        aspect_ok = abs((mw / mh) - aspect_value(asset["aspectRatio"])) < 0.02
        if not aspect_ok: issues.append(f"master {mw}x{mh} != {asset['aspectRatio']}")
        notes.append("MANUAL: confirm EMPTY personality room (no baked furniture) + ~55% wall / ~45% floor / 10-15% side walls.")
        scores = {"dnaAdherence": warmth_score(rgb), "composition": round(min(10.0, 6 + (2 if aspect_ok else 0)), 2),
                  "transparency": 10.0, "focusReadability": sharpness_score(rgb.resize((mw, round(mw * 4 / 3)))), "editableSurfaceSuitability": 7.0}
        result.update({"masterPng": rel(os.path.join(cdir, f"{asset['id']}-master.png")), "variants": variants,
                       "transparency": {"expectedOpaque": True, "hasAlpha": False},
                       "aspectRatio": {"target": asset["aspectRatio"], "actual": f"{mw}x{mh}", "ok": aspect_ok}, "editableSurface": None})

    result["scores"] = scores; result["totalScore"] = round(sum(scores.values()), 2)
    result["issues"] = issues; result["notes"] = notes
    return result


def main():
    if not os.path.exists(MANIFEST):
        print(f"No manifest at {MANIFEST}. Run scripts/generate-camera-validation.mjs first.", file=sys.stderr); sys.exit(1)
    manifest = json.load(open(MANIFEST)); os.makedirs(REPORTS, exist_ok=True)
    assets_out = []
    for asset in manifest["results"]:
        cands = []
        for cand in asset.get("candidates", []):
            if cand.get("status") != "generated":
                cands.append({"candidate": cand["candidate"], "status": "failed", "error": cand.get("error")}); continue
            r = process_candidate(asset, cand); r["status"] = "generated"; cands.append(r)
        scored = [c for c in cands if c.get("status") == "generated"]
        selected = max(scored, key=lambda c: c["totalScore"])["candidate"] if scored else None
        best = next((c for c in scored if c["candidate"] == selected), None)
        rec = "no viable candidate — regenerate" if not best else (
            f"recommend c{selected} ({best['totalScore']}/50) — REVIEW (not approved)"
            if best["totalScore"] >= 32 and not best["issues"]
            else f"recommend c{selected} ({best['totalScore']}/50) — REVISE ({'; '.join(best['issues']) or 'low score'})")
        assets_out.append({"assetId": asset["id"], "name": asset.get("name"), "kind": asset["kind"], "modelUsed": asset["model"],
                           "masterResolution": asset["masterResolution"], "aspectRatio": asset["aspectRatio"],
                           "transparencyRequired": asset["transparency"], "editableSurfaceSpec": None, "promptUsed": asset["prompt"],
                           "candidateCount": len(asset.get("candidates", [])), "selectedCandidate": selected, "candidates": cands,
                           "recommendation": rec, "approved": False})

    errs = [c.get("error", "") for a in manifest["results"] for c in a.get("candidates", []) if c.get("status") != "generated"]
    total_c = sum(len(a.get("candidates", [])) for a in manifest["results"])
    blocker = None
    if errs and len(errs) == total_c:
        common = max(set(e[:60] for e in errs), key=lambda x: sum(1 for e in errs if e.startswith(x)))
        blocker = {"allCandidatesFailed": True, "count": len(errs), "dominantError": common, "sampleError": errs[0][:400]}

    summary = {"generatedAt": datetime.now(timezone.utc).isoformat(), "pack": "camera-dna-v1", "model": manifest["model"],
               "candidatesPerAsset": manifest.get("candidatesPerAsset"), "cameraDna": "docs/nestudio-camera-dna-lock.md",
               "generationBlocker": blocker,
               "approvalPolicy": "No asset auto-approved. Each has a recommended candidate for human review.",
               "scoreDimensions": ["dnaAdherence", "composition", "transparency", "focusReadability", "editableSurfaceSuitability"],
               "scoreNote": "Scores are AUTOMATED PROXIES (warmth/centering/sharpness/alpha). Camera-pitch conformance is a MANUAL visual check per asset.",
               "counts": {"assets": len(assets_out), "withViableCandidate": sum(1 for a in assets_out if a["selectedCandidate"]),
                          "needsRegenerate": sum(1 for a in assets_out if not a["selectedCandidate"])},
               "assets": assets_out}
    json.dump(summary, open(os.path.join(REPORTS, f"{REPORT_BASE}.json"), "w"), indent=2)
    write_markdown(summary)
    print(f"Wrote reports for {len(assets_out)} assets → {REPORTS}/{REPORT_BASE}.md")


def write_markdown(s):
    L = ["# Nestudio Camera DNA — P0 Validation & Scoring Report", "",
         f"- **Pack:** camera-dna-v1 · **Model:** `{s['model']}` · **Candidates/asset:** {s['candidatesPerAsset']} · **Written:** {s['generatedAt']}",
         f"- **Camera DNA:** [`{s['cameraDna']}`](../../{s['cameraDna']}) — 180cm eye level · 10° pitch · 35-40mm · 55% wall / 45% floor · 10-15% side walls",
         f"- **Assets:** {s['counts']['assets']} · viable: {s['counts']['withViableCandidate']} · needs regenerate: {s['counts']['needsRegenerate']}",
         "- **Approval:** no asset auto-approved — each row is a RECOMMENDATION for human review.",
         f"- _{s['scoreNote']}_", ""]
    if s.get("generationBlocker"):
        b = s["generationBlocker"]
        L += [f"> 🚫 **GENERATION BLOCKED** — all {b['count']} candidates failed. `{b['dominantError']}`.",
              f"> Sample: `{b['sampleError']}`", ""]
    L += ["| Asset | Kind | Sel | Score /50 | Alpha | Aspect | Recommendation |", "|---|---|---|---|---|---|---|"]
    for a in s["assets"]:
        best = next((c for c in a["candidates"] if c.get("candidate") == a["selectedCandidate"]), None)
        score = best["totalScore"] if best else "—"
        alpha = ("yes" if best["transparency"].get("hasAlpha") else "NO") if (best and a["kind"] == "object") else "opaque"
        asp = best["aspectRatio"] if best else {}
        asps = f"{asp.get('actual')}~{asp.get('target')} {'ok' if asp.get('ok') else 'OFF'}" if best else "—"
        L.append(f"| `{a['assetId']}` ({a.get('name')}) | {a['kind']} | c{a['selectedCandidate']} | {score} | {alpha} | {asps} | {a['recommendation']} |")
    L += ["", "## Per-asset detail", ""]
    for a in s["assets"]:
        L.append(f"### `{a['assetId']}` — {a.get('name')} ({a['kind']})")
        L += [f"- **Model:** {a['modelUsed']} · master {a['masterResolution']} ({a['aspectRatio']}) · transparency required: {a['transparencyRequired']}",
              f"- **Candidates:** {a['candidateCount']} · selected c{a['selectedCandidate']} · approved: {a['approved']}",
              f"- **Recommendation:** {a['recommendation']}", "- **Candidate scores:**", "",
              "  | Cand | DNA | Comp | Transp | Focus | Surf | Total | Issues |", "  |---|---|---|---|---|---|---|---|"]
        for c in a["candidates"]:
            if c.get("status") != "generated":
                L.append(f"  | c{c['candidate']} | — | — | — | — | — | — | {c.get('error','failed')} |"); continue
            sc = c["scores"]
            L.append(f"  | c{c['candidate']}{' ★' if c['candidate']==a['selectedCandidate'] else ''} | {sc['dnaAdherence']} | {sc['composition']} | {sc['transparency']} | {sc['focusReadability']} | {sc['editableSurfaceSuitability']} | **{c['totalScore']}** | {'; '.join(c['issues']) or '—'} |")
        best = next((c for c in a["candidates"] if c.get("candidate") == a["selectedCandidate"] and c.get("status") == "generated"), None)
        if best:
            L.append("")
            L.append(f"- **Selected c{a['selectedCandidate']} outputs:**")
            if best.get("masterPng"): L.append(f"  - master: `{best['masterPng']}`")
            if best.get("cutoutPng"): L.append(f"  - cutout (alpha): `{best['cutoutPng']}`")
            for tier, v in (best.get("variants") or {}).items(): L.append(f"  - {tier}: `{v['path']}` ({v['kb']} KB)")
            L.append(f"  - transparency: {best['transparency']}")
            L.append(f"  - aspect: {best['aspectRatio']}")
            if best.get("notes"): L += ["  - notes:"] + [f"    - {n}" for n in best["notes"]]
        L.append(f"- **Prompt used:** {a['promptUsed'][:500]}{'…' if len(a['promptUsed'])>500 else ''}")
        L.append("")
    open(os.path.join(REPORTS, f"{REPORT_BASE}.md"), "w").write("\n".join(L))


if __name__ == "__main__":
    main()
