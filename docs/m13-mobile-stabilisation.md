# M13 — Mobile Stabilisation Sprint (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform` at commit `a3c2ca9`. **No merge to
> `main`, no production deploy.** This is a polish/stabilisation sprint — not a feature,
> AI, or multiplayer sprint. Canonical record; see [changelog.md](changelog.md) and
> [decision-log.md](decision-log.md) (ADR-032).

## Why this sprint

The M12/M12.1 library cutover moved the single editor (`/nest-editor`) off the built-in
Golden Living Nest fixture and onto the **production library** via
[`lib/nest-editor-bridge.ts`](../lib/nest-editor-bridge.ts). That swapped the tray asset
**ids** (`ast-lr-*` / `ast-so-*` oak assets) but left the editor's supporting metadata
keyed to the old Golden Nest ids — which is the root cause of most of the reported bugs:

- **Hotspots** ([`lib/nest-hotspot-catalog.ts`](../lib/nest-hotspot-catalog.ts)) are keyed
  by asset id → production assets got **no Connect hotspots**.
- **Surfaces** ([`lib/nest-surface-catalog.ts`](../lib/nest-surface-catalog.ts)) same →
  TV/frames had **no editable surfaces**.
- **Guardrails** ([`lib/nest-editor-policy.ts`](../lib/nest-editor-policy.ts)) are keyed by
  slot type and **omitted `seat`/`desk`** → floor furniture fell back to the wall-first
  `DEFAULT_GUARDRAIL` and was born in the **upper wall band**.
- The clean, catalog-aligned art still existed on disk but was no longer in the tray.

## What shipped (task by task)

| Task | Change | Key files |
|---|---|---|
| **1 — Restore assets** | Re-added the approved Golden Nest assets under their **catalog-aligned ids** (`ast-tv`, `ast-framed-photo`, `ast-floor-lamp`, `ast-side-plant`, `ast-avatar`, `ast-desk`, `ast-stacked-books`, `ast-bookshelf`) so hotspots + surfaces light up by id. Deployable web-optimized WEBP built from the golden cut-outs. | [`nest-production-library-v1.ts`](../lib/fixtures/nest-production-library-v1.ts), [`scripts/build-library-golden-art.mjs`](../scripts/build-library-golden-art.mjs), `public/nests/library-v1/assets/*.webp` |
| **2 — Placement rules** | Added floor-first guardrails for `seat`, `desk` (+ `window`, `pinboard`, `product`). Floor furniture now spawns + clamps on the floor. | [`nest-editor-policy.ts`](../lib/nest-editor-policy.ts) |
| **3 — Connect hotspots** | Carry `ProductionAsset.hotspots` → `LivingNestAsset.predefinedHotspots`; seed hotspots on placement-seeded objects (catalog id first, else asset-declared). | [`nest-editor-bridge.ts`](../lib/nest-editor-bridge.ts), [`nest-visual-types.ts`](../lib/nest-visual-types.ts), [`nest-editor.ts`](../lib/nest-editor.ts) |
| **4 — Surfaces + overlays** | (A) Surface fallback: register production `editableSurfaces` when an id isn't in the static surface catalog. (B) **Generic overlays** — text/image "stickers" that move/resize/rotate/place anywhere and persist in the document. | [`nest-surfaces.ts`](../lib/nest-surfaces.ts), [`nest-surface-catalog.ts`](../lib/nest-surface-catalog.ts), [`overlay-content.tsx`](../components/nest/overlay-content.tsx), [`overlay-editor-sheet.tsx`](../components/nest/editor/overlay-editor-sheet.tsx), [`nest-editor.ts`](../lib/nest-editor.ts), [`nest-editor-types.ts`](../lib/nest-editor-types.ts) |
| **5 — Mobile UX** | Done/Back → `/studio`; body scroll-lock while the editor is mounted; ≥16px inputs (no iOS keyboard zoom); `viewport-fit=cover` so safe-area insets resolve; Done button spacing. | [`nest-editor.tsx`](../components/nest/editor/nest-editor.tsx), [`publish-gate.tsx`](../components/nest/editor/publish-gate.tsx), [`hotspot-binding-sheet.tsx`](../components/nest/editor/hotspot-binding-sheet.tsx), [`app/layout.tsx`](../app/layout.tsx) |
| **6 — Focus sharp** | Made `slotTypeForAsset` null-safe. The reported "focus blurs when adding assets" was a crash in `overlapAdvisories` (runs on every edit) triggering the Next.js error overlay; the crop now stays sharp. | [`nest-editor-policy.ts`](../lib/nest-editor-policy.ts) |
| **7 — Admin route** | `/nest-admin` redirects to `/design/nest-admin`. | [`app/nest-admin/page.tsx`](../app/nest-admin/page.tsx) |
| **8 — Asset quality** | Set the flawed oak TV/desk/chair to **`hidden`** (still resolvable by id for published Nests); repointed the affected templates to golden equivalents (TV→`ast-tv`, desk→`ast-desk`); dropped the flawed chair from the writer/gamer templates. | [`nest-production-library-v1.ts`](../lib/fixtures/nest-production-library-v1.ts) |

## Architecture notes carried forward

- **The editor bridge** ([`lib/nest-editor-bridge.ts`](../lib/nest-editor-bridge.ts)) is the
  only adapter between the production library (`ProductionAsset/Background/Template` +
  `NestDocument`) and the editor's runtime contracts (`LivingNestAsset` /
  `EditableNestObject`). Connect/surface metadata now flows through it; there is still
  exactly **one editor**.
- **Overlays** are modelled as `EditableNestObject`s with a synthetic `overlay:text` /
  `overlay:image` `assetId`, routed to the free-placement `DEFAULT_OVERLAY` guardrail via
  `guardrailForObject`. They persist through new optional `NestPlacement.overlay` / `w` /
  `h` / `rotation` fields, so they survive the publish/reload round-trip in **local mode**.
- **Never hard-delete:** hidden/archived library items still resolve by id (published Nests
  never break) — unchanged from M10/M11/M12.

## Verification

- Gates (Node 20): `typecheck · lint · test (319, incl. 8 new in
  [`test/nest-editor-m13.test.ts`](../test/nest-editor-m13.test.ts)) · build` — all green.
- Browser-verified on a 375×812 mobile viewport: onboarding → Quick Start → editor; golden
  tray (flawed oak absent); sofa lands on the floor; TV Connect region; text overlay
  add/edit/render; focus scene stays sharp on asset-add; `/nest-admin` redirect; admin gate.

## Known limitations / follow-ups (not M13)

- **Supabase overlay persistence:** overlays round-trip in **local mode** (the `?c=`
  self-contained link + localStorage). The Supabase `nest_objects` schema has no overlay
  columns yet, so overlays would not persist through the Supabase backend — a follow-up if
  the preview is flipped to `NEXT_PUBLIC_NEST_BACKEND=supabase`.
- **No-`?document=` editor default** still opens the legacy Golden Living fixture, which
  references `ast-sofa`/`ast-coffee-table`/`ast-rug` (SVG-placeholder ids not in the
  production library) → they render as fallback boxes. Harmless; the real flow always opens
  with a document. Easy cleanup: seed the default from a production template.
- **No chair asset** in V1 — the writer/gamer templates dropped the flawed task chair rather
  than substitute; revisit when a clean seat/chair asset lands.
