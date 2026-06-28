# Golden Nest V2 — Asset Validation (Phase 1)

> Phase 1 — validate V2 candidates · generated 2026-06-27T12:42:15.717Z · dir `public/nests/golden-nest-v1`
>
> Policy: **background** may be opaque; **every other object must have genuine alpha transparency**.
> A visible checkerboard is **not** proof of transparency — a checkerboard baked into opaque pixels
> is rejected. Object passes at ≥ 1% transparent pixels (alpha < 250).

**Summary:** 1 approved · 8 rejected ·
objects 0 approved / 8 rejected.

| Status | File | Kind | Size | Alpha ch. | Min α | Transparent | Checkerboard baked? | Reason |
|---|---|---|---|---|---|---|---|---|
| ✅ | `background-v2.png` | background | 1086×1448 | no | 255 | 0% | no | background — opaque allowed |
| ❌ | `avatar-v2.png` | object | 1086×1448 | no | 255 | 0% | no | opaque (no alpha channel) — re-export with a real transparent background |
| ❌ | `tv-v2.png` | object | 1448×1086 | no | 255 | 0% | **YES** | opaque with a BAKED checkerboard (no real alpha — a checkerboard is not transparency) |
| ❌ | `desk-v2.png` | object | 1448×1086 | no | 255 | 0% | **YES** | opaque with a BAKED checkerboard (no real alpha — a checkerboard is not transparency) |
| ❌ | `bookshelf-v2.png` | object | 1086×1448 | no | 255 | 0% | **YES** | opaque with a BAKED checkerboard (no real alpha — a checkerboard is not transparency) |
| ❌ | `frame-v2.png` | object | 1254×1254 | no | 255 | 0% | no | opaque (no alpha channel) — re-export with a real transparent background |
| ❌ | `lamp-v2.png` | object | 1086×1448 | no | 255 | 0% | no | opaque (no alpha channel) — re-export with a real transparent background |
| ❌ | `plant-v2.png` | object | 1254×1254 | no | 255 | 0% | **YES** | opaque with a BAKED checkerboard (no real alpha — a checkerboard is not transparency) |
| ❌ | `books-v2.png` | object | 1254×1254 | no | 255 | 0% | no | opaque (no alpha channel) — re-export with a real transparent background |

**8 object asset(s) rejected.** Per the sprint rules the fixture must NOT be switched to rejected files. Re-export the rejected objects with a *real* transparent background (genuine alpha, not a baked checkerboard), keep the same `-v2` filenames, and re-run this validation.
