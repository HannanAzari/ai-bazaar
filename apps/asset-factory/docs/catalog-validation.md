# Catalog Validation (V2.5)

How we prove the asset pipeline end-to-end **before** spending money on large-scale
AI generation. The chain we validate:

```
Asset → Review → Approve → Export → Import-validate → Room Designer Sandbox → Beautiful Room
```

Everything here is internal tooling in `apps/asset-factory`. No AI generation, no
provider calls — V2.5 only proves the catalog is ready.

---

## Review workflow

1. Open the dashboard (**Review** tab). Candidates are seeded (90 samples) or
   imported. Each has a category, tags, dimensions, and derived Nestudio metadata.
2. Filter by status / group, search, open a card, and decide:
   **Approve / Reject / Needs edit / Back to review** (`A`/`R`/`E`/`N` shortcuts).
   Approving stamps the reviewer + time and logs the decision to the activity log.
3. Approval is **blocked** while an asset has *critical* quality issues (missing
   image/name/category). Warnings (missing tags, non-transparent, etc.) don't block.

## Validation workflow

The **Reports** tab runs Nestudio import validation over every **approved** asset
(`lib/import-validation.ts`). For each asset it checks:

| Check | Severity |
|---|---|
| Missing name / slug / image | error |
| Invalid category (or maps to an invalid Nestudio category) | error |
| Invalid placement | error |
| Missing compatible zones | error |
| Unknown zone in `compatibleZones` | error |
| No room zone accepts the category (unplaceable) | error |
| None of the listed zones accept the category | error |
| Invalid action type | error |
| Scale out of range (0.1–5) | error |
| Some listed zones don't accept the category (partial) | warning |
| Missing tags / single-tag (weak metadata) | warning |

**Errors must be zero** before export. Warnings are advisory. The report shows
pass/warn/fail counts and lists the offenders.

> **Placement rule (critical):** an asset's `nestudioCategory` must be accepted by
> at least one of its `compatibleZones` under the nine-zone template
> (`lib/zones.ts`). Nestudio zones accept: walls→`decor`/`wall` · shelf→`decor`/
> `plant` · window→`decor` · floor→`furniture`/`plant`/`structure`/`floor`/`stairs`/
> `door` · door→`structure`/`door`/`stairs`. There is **no zone for `lighting`**, and
> floor zones do **not** accept `decor`. `CATEGORY_META` is the single source of
> truth and is guarded by a unit test so this can't regress.

## Export workflow

From **Packs** (or the dashboard), export the generated artifacts — they never
overwrite the main app:

- **`approved-assets.json`** / **`approved-assets.ts`** — approved assets in the
  Nestudio `CatalogAsset` shape (`ast-<slug>` ids).
- **`asset-packs.json`** — each pack with its approved members resolved to
  `ast-<slug>` ids.

Committed examples live in `apps/asset-factory/exports/`. Import into the main app
is **manual + reviewed** (see README "How approved assets enter Nestudio").

## Room-designer validation workflow

The **Sandbox** tab (`lib/sandbox.ts`) is a self-contained mirror of the main app's
AI Room Designer (`lib/ai-room-designer.ts`): it matches a creator type to an
intent, ranks approved assets by category/tag/action/style affinity, and places the
top picks into the nine-zone template under the **same** placement rules
(category↔zone + capacity). It reports:

- **placed** assets (with zone, action, and a reason),
- **unplaced** assets (and why — the key signal that an approved asset isn't
  room-ready),
- **zone usage** vs capacity, and plain-language explanations.

Choose a pack (or all approved), a creator type, and a style, then **Generate**. A
healthy catalog places its pack with **zero unplaced** assets.

## Quality score

`lib/quality-score.ts` produces a 0–100 **Catalog Quality Score** (and a per-pack
score) from five sub-metrics: metadata completeness, tag quality, zone coverage,
category balance, approved ratio. Internal gauge only.

## Readiness criteria before V3 (AI Generation Queue)

Treat V3 as **gated** on all of the following, measured here:

1. **Zero validation errors** on approved assets (Reports → import validation).
2. **Zone coverage = 100%** — approved assets can occupy all nine zones.
3. **Every starter pack generates a room with zero unplaced assets** in the Sandbox.
4. **Catalog Quality Score ≥ 70**, with metadata completeness ≥ 90.
5. **Export round-trips** (`approved-assets.*`, `asset-packs.json` regenerate
   cleanly and match committed examples — enforced by tests).
6. A documented **manual import** path into Nestudio (no automated writes).

If a future generated batch fails any of these, fix the metadata pipeline before
scaling generation — that is the whole point of V2.5.

## V3 generation runs through this same gate

The **Generate** tab (V3) does not bypass any of the above. Every generated
candidate — placeholder (dry-run) or real (Replicate) — enters `needs_review` and is
auto-run through quality checks + Nestudio import validation + a pack-compatibility
check (`lib/generation-validate.ts`). Nothing is auto-approved. Raw AI output is not
transparent, so it surfaces a `non_transparent` warning until a background-removal
pass (V4) is applied. Operating + cost-control details: [generation-ops.md](generation-ops.md).
