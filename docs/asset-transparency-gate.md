# Asset Transparency Gate

A permanent Asset Factory ingestion gate that enforces the V2 compositing contract:
**object assets must ship with real alpha transparency** (so they sit on a Nest as cut-out
objects, not opaque tiles), while **background assets may be opaque**.

- Validator: [`scripts/validate-asset-transparency.mjs`](../scripts/validate-asset-transparency.mjs)
- Reports: written to [`metadata/reports/`](../metadata/reports) as
  `asset-transparency-<dir>.json` (machine) + `.md` (human).

## Modes

| Command | Validates |
|---|---|
| `npm run validate:assets` (default, **fixture mode**) | **only the assets the Golden Nest fixture references** — the template `backgroundImageUrl` + each assigned asset image — parsed from [`lib/fixtures/golden-nest.ts`](../lib/fixtures/golden-nest.ts). Stray/unused PNGs in the folder are ignored. |
| `npm run validate:assets -- --all` | **every PNG** in the fixture's art directory. |
| `node scripts/validate-asset-transparency.mjs --all <dir>` | every PNG in an arbitrary directory. |

In fixture mode, **kind is taken from the fixture role** (the template background vs an assigned
asset image), so classification is exact. In `--all` mode, kind is inferred from the filename
(see the pattern below).

## Policy

| Asset kind | Detected by | Requirement |
|---|---|---|
| **Background** | filename matches `(background\|bg\|backdrop\|template\|shell\|scene)` | opaque allowed (always approved) |
| **Object** | everything else | **must** have ≥ 1% (semi-)transparent pixels (alpha < 250) |

An object is **rejected** when it has no alpha channel, or has an alpha channel that is fully
opaque. The check inspects actual pixels (via `sharp`), so an RGBA-but-opaque export is caught,
not just RGB.

## Behaviour (a real gate)

- Prints an approved/rejected table to stdout.
- Writes the JSON + Markdown report to `metadata/reports/`.
- **Exits non-zero** if any object asset is rejected — so it can block CI / pre-commit / the
  Asset Factory pipeline. (Exit `2` if the target directory can't be read.)

## Fixing a rejection

Re-export the rejected object PNG with a **transparent background** (cut out the object, no
white/checkerboard matte), keep the **same filename**, drop it back in, and re-run
`npm run validate:assets`. No renderer, slot, or interaction changes are involved — the gate
only inspects and reports.

## Scope (what it does NOT touch)

Renderer logic, slot positions, interactions, and the art itself are untouched. The gate reads
pixels and writes a report; it never modifies or regenerates assets.
