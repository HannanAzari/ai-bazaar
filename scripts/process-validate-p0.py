#!/usr/bin/env python3
"""M9.2 — P0 pilot: process + validate + score + select (no auto-approve).

For every generated candidate (3 per asset): resize the master to the exact spec
dims, cut objects out to alpha + trim, emit mobile/standard/focus WebP variants,
validate against the M9.2 gates, and score 5 dimensions. Selects the single
highest-scoring candidate per asset as a RECOMMENDATION (never "approved").

Writes:
    metadata/reports/production-p0-validation.md
    metadata/reports/production-p0-validation.json

Run after scripts/generate-p0-pilot.mjs:
    python3 scripts/process-validate-p0.py

Pillow only. Scores for DNA/composition are automated PROXIES — the report flags
them for human confirmation (the pilot deliberately does not auto-approve).
"""

import json
import os
import sys
from datetime import datetime, timezone

try:
    from PIL import Image, ImageDraw, ImageStat, ImageFilter
except Exception:  # pragma: no cover
    print("Pillow (PIL) is required: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, "public/nests/production-v1/candidates")
REPORTS = os.path.join(ROOT, "metadata/reports")
MANIFEST = os.path.join(CAND, "metadata", "manifest.json")
ASPECT_TOL = 0.15

# Variant longest-side (objects) / width (backgrounds, 3:4).
OBJ_STANDARD, OBJ_MOBILE = 1024, 512  # focus = native master longest side
BG_FOCUS_W, BG_STD_W, BG_MOBILE_W = 2048, 1080, 720


def aspect_value(a):
    w, h = a.split(":"); return float(w) / float(h)


def rel(p):
    return p.replace(ROOT + "/", "")


# ── cut-out / trim ───────────────────────────────────────────────────────────
def cutout_alpha(im, tol=30):
    im = im.convert("RGBA"); w, h = im.size
    corners = [im.getpixel((1, 1)), im.getpixel((w - 2, 1)), im.getpixel((1, h - 2)), im.getpixel((w - 2, h - 2))]
    def close(a, b): return all(abs(a[i] - b[i]) <= tol for i in range(3))
    reliable = all(close(corners[0], c) for c in corners[1:])
    for c in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]:
        ImageDraw.floodfill(im, c, (0, 0, 0, 0), thresh=tol)
    alpha = im.split()[3]
    frac = sum(1 for p in alpha.getdata() if p == 0) / (w * h)
    return im, reliable, frac


def trim(im):
    b = im.split()[3].getbbox() if im.mode == "RGBA" else im.getbbox()
    return im.crop(b) if b else im


def save_webp(im, path, max_kb=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for q in range(92, 39, -6):
        im.save(path, "WEBP", quality=q, method=6)
        kb = os.path.getsize(path) / 1024
        if max_kb is None or kb <= max_kb:
            return q, kb
    return q, kb


def resize_longest(im, longest):
    w, h = im.size
    s = longest / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


# ── scoring proxies (0..10) ──────────────────────────────────────────────────
def warmth_score(im):
    s = im.convert("RGB").resize((64, 64))
    px = list(s.getdata()); warm = grey = 0
    for r, g, b in px:
        if max(r, g, b) - min(r, g, b) < 12:
            grey += 1
        elif r >= g >= b:
            warm += 1
    n = len(px)
    return round(min(10.0, (warm / n) * 12 - (grey / n) * 4 + 4), 2)


def sharpness_score(im, cap=42.0):
    edges = im.convert("L").filter(ImageFilter.FIND_EDGES)
    sd = ImageStat.Stat(edges).stddev[0]
    return round(min(10.0, sd / cap * 10), 2)


def composition_score(bbox_wh, canvas_wh, center_off, aspect_ok):
    fw = bbox_wh[0] / canvas_wh[0]; fh = bbox_wh[1] / canvas_wh[1]
    fill = max(fw, fh)  # object should fill most of the frame
    fill_s = 10 - abs(0.9 - fill) * 12
    center_s = 10 - (abs(center_off[0]) + abs(center_off[1])) * 20
    a_s = 10 if aspect_ok else 5
    return round(max(0, min(10, (fill_s + center_s + a_s) / 3)), 2)


def transparency_score(reliable, frac, corners_clear):
    if not corners_clear:
        return 2.0
    if frac < 0.05:
        return 3.0  # almost nothing removed → baked bg
    s = 8.0 if reliable else 5.0
    if frac > 0.35:
        s += 1.5  # good isolation
    return round(min(10.0, s), 2)


def surface_flatness_score(rgba, es):
    if not es:
        return 7.0, None  # N/A → neutral
    w, h = rgba.size; b = es["bounds"]
    box = (int(b["x"] * w), int(b["y"] * h), int((b["x"] + b["width"]) * w), int((b["y"] + b["height"]) * h))
    crop = rgba.convert("RGB").crop(box)
    sd = sum(ImageStat.Stat(crop).stddev[:3]) / 3
    # a good editable surface (empty screen/photo/flat top) is LOW variance
    score = round(max(0.0, min(10.0, 10 - sd / 12)), 2)
    return score, {"region": box, "stddev": round(sd, 1), "emptyEnough": sd < 55}


def process_candidate(asset, cand):
    src_master = os.path.join(ROOT, cand["masterPath"])
    im = Image.open(src_master)
    cand_dir = os.path.dirname(src_master)
    mw, mh = asset["masterResolution"]
    is_obj = asset["kind"] == "object"

    issues, notes = [], []
    result = {"candidate": cand["candidate"]}

    if is_obj:
        rgba, reliable, frac = cutout_alpha(im)
        trimmed = trim(rgba)
        tw, th = trimmed.size
        # save exact-dims square master (opaque, as generated) + trimmed alpha cutout
        Image.open(src_master).convert("RGB").resize((mw, mh)).save(os.path.join(cand_dir, f"{asset['id']}-master.png"))
        cutout_path = os.path.join(cand_dir, f"{asset['id']}-cutout.png")
        trimmed.save(cutout_path)
        # variants (from the trimmed cutout, alpha preserved)
        focus_long = max(mw, mh)
        variants = {}
        for tier, longest, cap in [("focus", focus_long, None), ("standard", OBJ_STANDARD, asset["deliverMaxKB"]), ("mobile", OBJ_MOBILE, asset["deliverMaxKB"])]:
            vpath = os.path.join(cand_dir, "variants", tier, f"{asset['id']}.webp")
            q, kb = save_webp(resize_longest(trimmed, longest), vpath, cap)
            variants[tier] = {"path": rel(vpath), "kb": round(kb, 1), "quality": q, "longest": longest}
        # gates
        target = asset.get("trimToAspect")
        ratio = tw / th if th else 0
        aspect_ok = True
        if target:
            tr = aspect_value(target)
            aspect_ok = abs(ratio - tr) / tr <= ASPECT_TOL
            if not aspect_ok:
                issues.append(f"trimmed aspect {ratio:.2f} vs target {target} ({tr:.2f}) beyond {int(ASPECT_TOL*100)}% tol")
        corners_clear = all(trimmed.split()[3].getpixel(c) == 0 for c in [(0, 0), (tw - 1, 0), (0, th - 1), (tw - 1, th - 1)]) if tw and th else False
        if frac < 0.05:
            issues.append("little/no transparency after cut-out (baked background likely)")
        if not reliable:
            issues.append("background not uniform — auto cut-out UNRELIABLE; recommend rembg/manual matte")
        # centering
        cx = ((trim(rgba).getbbox()[0] if False else 0))  # placeholder; centering from pre-trim bbox
        bb = rgba.split()[3].getbbox()
        cxoff = ((bb[0] + bb[2]) / 2) / rgba.size[0] - 0.5
        cyoff = ((bb[1] + bb[3]) / 2) / rgba.size[1] - 0.5
        # scores
        surf_s, surf_info = surface_flatness_score(trimmed, asset.get("editableSurface"))
        scores = {
            "dnaAdherence": warmth_score(trimmed),
            "composition": composition_score((tw, th), (tw, th), (cxoff, cyoff), aspect_ok),
            "transparency": transparency_score(reliable, frac, corners_clear),
            "focusReadability": sharpness_score(resize_longest(trimmed, focus_long)),
            "editableSurfaceSuitability": surf_s,
        }
        result.update({
            "masterPng": rel(os.path.join(cand_dir, f"{asset['id']}-master.png")),
            "cutoutPng": rel(cutout_path), "variants": variants,
            "trimmedResolution": [tw, th],
            "transparency": {"hasAlpha": frac > 0.02, "transparentFraction": round(frac, 3),
                             "cornersClear": corners_clear, "cutoutReliable": reliable},
            "aspectRatio": {"target": target, "actual": round(ratio, 3), "ok": aspect_ok},
            "editableSurface": surf_info,
        })
    else:
        rgb = im.convert("RGB")
        rgb.resize((mw, mh)).save(os.path.join(cand_dir, f"{asset['id']}-master.png"))
        variants = {}
        for tier, wpx, cap in [("focus", BG_FOCUS_W, None), ("standard", BG_STD_W, asset["deliverMaxKB"]), ("mobile", BG_MOBILE_W, asset["deliverMaxKB"])]:
            hpx = round(wpx * 4 / 3)
            vpath = os.path.join(cand_dir, "variants", tier, f"{asset['id']}.webp")
            q, kb = save_webp(rgb.resize((wpx, hpx)), vpath, cap)
            variants[tier] = {"path": rel(vpath), "kb": round(kb, 1), "quality": q, "size": [wpx, hpx]}
        aspect_ok = abs((mw / mh) - aspect_value(asset["aspectRatio"])) < 0.02
        if not aspect_ok:
            issues.append(f"master {mw}x{mh} != {asset['aspectRatio']}")
        notes.append("MANUAL: confirm EMPTY stage (no baked furniture) + floor seam in band 0.58–0.64.")
        scores = {
            "dnaAdherence": warmth_score(rgb),
            "composition": round(min(10.0, 6 + (2 if aspect_ok else 0)), 2),
            "transparency": 10.0,  # opaque background is correct
            "focusReadability": sharpness_score(rgb.resize((BG_FOCUS_W, round(BG_FOCUS_W * 4 / 3)))),
            "editableSurfaceSuitability": 7.0,  # N/A
        }
        result.update({
            "masterPng": rel(os.path.join(cand_dir, f"{asset['id']}-master.png")),
            "variants": variants,
            "transparency": {"expectedOpaque": True, "hasAlpha": False},
            "aspectRatio": {"target": asset["aspectRatio"], "actual": f"{mw}x{mh}", "ok": aspect_ok},
            "editableSurface": None,
        })

    result["scores"] = scores
    result["totalScore"] = round(sum(scores.values()), 2)  # /50
    result["issues"] = issues
    result["notes"] = notes
    return result


def main():
    if not os.path.exists(MANIFEST):
        print(f"No manifest at {MANIFEST}. Run scripts/generate-p0-pilot.mjs first.", file=sys.stderr)
        sys.exit(1)
    manifest = json.load(open(MANIFEST))
    os.makedirs(REPORTS, exist_ok=True)

    assets_out = []
    for asset in manifest["results"]:
        cands = []
        for cand in asset.get("candidates", []):
            if cand.get("status") != "generated":
                cands.append({"candidate": cand["candidate"], "status": "failed", "error": cand.get("error")})
                continue
            r = process_candidate(asset, cand)
            r["status"] = "generated"
            cands.append(r)
        scored = [c for c in cands if c.get("status") == "generated"]
        selected = max(scored, key=lambda c: c["totalScore"])["candidate"] if scored else None
        best = next((c for c in scored if c["candidate"] == selected), None)
        recommendation = "no viable candidate — regenerate" if not best else (
            f"recommend c{selected} ({best['totalScore']}/50) — REVIEW (not approved)"
            if best["totalScore"] >= 32 and not best["issues"]
            else f"recommend c{selected} ({best['totalScore']}/50) — REVISE ({'; '.join(best['issues']) or 'low score'})")
        assets_out.append({
            "assetId": asset["id"], "kind": asset["kind"], "tier": asset.get("tier"),
            "modelUsed": asset["model"], "masterResolution": asset["masterResolution"],
            "aspectRatio": asset["aspectRatio"], "transparencyRequired": asset["transparency"],
            "editableSurfaceSpec": asset.get("editableSurface"),
            "promptUsed": asset["prompt"], "candidateCount": len(asset.get("candidates", [])),
            "selectedCandidate": selected, "candidates": cands,
            "recommendation": recommendation, "approved": False,
        })

    # Root-cause: dominant candidate failure (e.g. an API quota/billing block).
    errs = [c.get("error", "") for a in manifest["results"] for c in a.get("candidates", []) if c.get("status") != "generated"]
    total_c = sum(len(a.get("candidates", [])) for a in manifest["results"])
    blocker = None
    if errs and len(errs) == total_c:
        common = max(set(e[:60] for e in errs), key=lambda x: sum(1 for e in errs if e.startswith(x)))
        blocker = {"allCandidatesFailed": True, "count": len(errs), "dominantError": common,
                   "sampleError": errs[0][:400]}

    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": manifest["model"], "candidatesPerAsset": manifest.get("candidatesPerAsset"),
        "batch": "P0 pilot (9 assets)",
        "generationBlocker": blocker,
        "approvalPolicy": "No asset is auto-approved (M9.2). Each has a recommended candidate for human review.",
        "scoreDimensions": ["dnaAdherence", "composition", "transparency", "focusReadability", "editableSurfaceSuitability"],
        "scoreNote": "dnaAdherence + composition are AUTOMATED PROXIES (warmth / centering / sharpness) — confirm visually.",
        "counts": {
            "assets": len(assets_out),
            "withViableCandidate": sum(1 for a in assets_out if a["selectedCandidate"]),
            "needsRegenerate": sum(1 for a in assets_out if not a["selectedCandidate"]),
        },
        "assets": assets_out,
    }
    json.dump(summary, open(os.path.join(REPORTS, "production-p0-validation.json"), "w"), indent=2)
    write_markdown(summary)
    print(f"Wrote reports for {len(assets_out)} assets → {REPORTS}")


def write_markdown(s):
    L = ["# P0 Production Generation Pilot — Validation & Scoring Report", "",
         f"- **Model:** `{s['model']}`  ·  **Candidates/asset:** {s['candidatesPerAsset']}  ·  **Written:** {s['generatedAt']}",
         f"- **Assets:** {s['counts']['assets']}  ·  with viable candidate: {s['counts']['withViableCandidate']}  ·  needs regenerate: {s['counts']['needsRegenerate']}",
         "- **Approval:** no asset auto-approved — each row is a RECOMMENDATION for human review.",
         f"- **Score dims (0–10 each, /50):** {', '.join(s['scoreDimensions'])}",
         f"- _{s['scoreNote']}_", ""]
    if s.get("generationBlocker"):
        b = s["generationBlocker"]
        L += ["> 🚫 **GENERATION BLOCKED** — all "
              f"{b['count']} candidates failed. Dominant error: `{b['dominantError']}`.",
              ">",
              f"> Sample: `{b['sampleError']}`",
              ">",
              "> This is an external Gemini API quota/billing limit on the project behind `GEMINI_API_KEY` "
              "(HTTP 429). Enable billing / raise the image-generation quota (or supply a key with quota), "
              "then re-run `node scripts/generate-p0-pilot.mjs && python3 scripts/process-validate-p0.py`.", ""]
    L += [
         "| Asset | Kind | Cand | Selected | Score /50 | Alpha | Aspect | Recommendation |",
         "|---|---|---|---|---|---|---|---|"]
    for a in s["assets"]:
        best = next((c for c in a["candidates"] if c.get("candidate") == a["selectedCandidate"]), None)
        score = best["totalScore"] if best else "—"
        if best and a["kind"] == "object":
            t = best["transparency"]; alpha = "yes" if t.get("hasAlpha") else "NO"
        else:
            alpha = "opaque"
        asp = best["aspectRatio"] if best else {}
        asps = f"{asp.get('actual')}~{asp.get('target')} {'ok' if asp.get('ok') else 'OFF'}" if best else "—"
        L.append(f"| `{a['assetId']}` | {a['kind']} | {a['candidateCount']} | c{a['selectedCandidate']} | {score} | {alpha} | {asps} | {a['recommendation']} |")
    L += ["", "## Per-asset detail", ""]
    for a in s["assets"]:
        L.append(f"### `{a['assetId']}` — {a['kind']}{' · ' + a['tier'] if a.get('tier') else ''}")
        L += [f"- **Model:** {a['modelUsed']} · master {a['masterResolution']} ({a['aspectRatio']}) · "
              f"transparency required: {a['transparencyRequired']}",
              f"- **Candidates:** {a['candidateCount']} · **selected:** c{a['selectedCandidate']} · **approved:** {a['approved']}",
              f"- **Recommendation:** {a['recommendation']}"]
        if a.get("editableSurfaceSpec"):
            L.append(f"- **Editable surface spec:** {a['editableSurfaceSpec']}")
        L.append("- **Candidate scores:**")
        L.append("")
        L.append("  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |")
        L.append("  |---|---|---|---|---|---|---|---|")
        for c in a["candidates"]:
            if c.get("status") != "generated":
                L.append(f"  | c{c['candidate']} | — | — | — | — | — | — | {c.get('error','failed')} |")
                continue
            sc = c["scores"]
            L.append(f"  | c{c['candidate']}{' ★' if c['candidate']==a['selectedCandidate'] else ''} | "
                     f"{sc['dnaAdherence']} | {sc['composition']} | {sc['transparency']} | {sc['focusReadability']} | "
                     f"{sc['editableSurfaceSuitability']} | **{c['totalScore']}** | {'; '.join(c['issues']) or '—'} |")
        # detail for the selected
        best = next((c for c in a["candidates"] if c.get("candidate") == a["selectedCandidate"] and c.get("status") == "generated"), None)
        if best:
            L.append("")
            L.append(f"- **Selected c{a['selectedCandidate']} outputs:**")
            if best.get("masterPng"): L.append(f"  - master: `{best['masterPng']}`")
            if best.get("cutoutPng"): L.append(f"  - cutout (alpha): `{best['cutoutPng']}`")
            for tier, v in (best.get("variants") or {}).items():
                L.append(f"  - {tier}: `{v['path']}` ({v['kb']} KB)")
            L.append(f"  - transparency: {best['transparency']}")
            L.append(f"  - aspect: {best['aspectRatio']}")
            if best.get("editableSurface"): L.append(f"  - editable-surface check: {best['editableSurface']}")
            if best.get("notes"):
                L += ["  - notes:"] + [f"    - {n}" for n in best["notes"]]
        L.append(f"- **Prompt used:** {a['promptUsed'][:500]}{'…' if len(a['promptUsed'])>500 else ''}")
        L.append("")
    open(os.path.join(REPORTS, "production-p0-validation.md"), "w").write("\n".join(L))


if __name__ == "__main__":
    main()
