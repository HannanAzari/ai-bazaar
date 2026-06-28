# Asset Transparency Report — `public/nests/golden-nest-v1`

> Gate: **asset-transparency** · mode: **fixture** (referenced by `lib/fixtures/golden-nest.ts`) · generated 2026-06-27T10:21:29.614Z
>
> Policy: **object** assets must contain alpha transparency; **background** assets may be opaque.
> Object passes when ≥ 1% of pixels are (semi-)transparent
> (alpha < 250). Background detection: fixture role (template background vs assigned asset image).

**Summary:** 1 approved · 8 rejected ·
8 objects · 1 background(s) · 9 total.

| Status | File | Kind | Size | Transparent | Alpha ch. | Reason |
|---|---|---|---|---|---|---|
| ❌ | `avatar.png` | object | 1086×1448 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |
| ✅ | `background.png` | background | 1086×1448 | 0% | no | background — opaque allowed |
| ❌ | `books.png` | object | 1402×1122 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |
| ❌ | `bookshelf.png` | object | 1086×1448 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |
| ❌ | `desk.png` | object | 1448×1086 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |
| ❌ | `frame.png` | object | 1448×1086 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |
| ❌ | `lamp.png` | object | 1024×1536 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |
| ❌ | `plant.png` | object | 1149×1369 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |
| ❌ | `tv.png` | object | 1448×1086 | 0% | no | object is opaque (no alpha channel) — re-export with a transparent background |

**8 asset(s) rejected.** Re-export the rejected object PNGs with a transparent background (same filenames) and re-run the gate.
