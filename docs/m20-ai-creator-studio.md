# M20 — AI Creator Studio Foundation (2026-07-14)

Branch `m12-nest-platform`, **preview only — no merge to `main`, no production deploy**. An
**architecture sprint**: build the ONE reusable AI engine every future studio (Avatar, Background,
House, Decoration, Admin Asset Factory) will share, and prove it end-to-end with a single working
vertical — **furniture/object generation**. No future AI features were built.

> The one question every file answers: *"Can Avatar Studio, Background Studio, House Studio and the
> Admin Asset Factory reuse this without modification?"* — if not, it was redesigned.

## The pipeline, proven

Upload → Validate → Resize → Background removal → Prompt assembly → Generation → Post-processing →
Transparent PNG → Metadata → Save → **available in the editor**. Verified in-browser (375×812): a sample
coffee-mug photo runs the full pipeline (chips: `validate · resize · removeBackground · assemblePrompt ·
generate · postProcess`), produces a 640×640 transparent PNG, is approved, saved to inventory, and then
appears in the Nest editor's asset tray and places into a room — all with no console errors and no API key.

## Architecture (80%)

### The engine — [lib/ai](../lib/ai) (UI never calls a provider or writes a prompt string)
- **[types.ts](../lib/ai/types.ts)** — the shared contracts. The reuse seam is **`StudioConfig`**: a
  studio is data (a kind + prompt builder + output options + `publishTargets`). Adding Avatar Studio =
  flip `enabled` + point at `buildAvatarPrompt`.
- **[engine.ts](../lib/ai/engine.ts)** — `STUDIO_CONFIGS` (furniture **enabled**; decoration/avatar/
  background/house registered but **disabled**), `generateAsset(kind, input)` dispatch, and the
  primitives `removeBackground` / `stylizeAsset` / `upscaleAsset`. Refuses a disabled kind up front.
- **[pipeline.ts](../lib/ai/pipeline.ts)** — modular, named, skippable stages + `runPipeline`; a studio
  can reorder/subset via `StudioConfig.stages`. Provider- and use-case-agnostic.
- **[provider.ts](../lib/ai/provider.ts)** + **[providers/](../lib/ai/providers)** — the
  `AIImageProvider` interface + a registry. `stub` (Canvas, **no key**, ships) does real bg-removal +
  cozy stylize + upscale; `gemini` is a server-only scaffold aligned to the repo's existing
  `GEMINI_API_KEY` — enabling it is a one-line registry swap, no studio/UI change.
- **[prompts.ts](../lib/ai/prompts.ts)** + **[style.ts](../lib/ai/style.ts)** — `buildBasePrompt` +
  one builder per kind, composed from `NESTUDIO_STYLE` tokens (from
  [nestudio-visual-dna.md](nestudio-visual-dna.md): warm, rounded, matte, front-facing, alpha cutout).
  **No string concatenation in components.**
- **[canvas.ts](../lib/ai/canvas.ts)** — the only DOM-touching helpers, env-guarded so server imports
  never reach `document`.

### Inventory — [lib/ai-inventory](../lib/ai-inventory) (Supabase-swappable)
`InventoryStore` interface: async mutations + a sync snapshot + subscription (`useSyncExternalStore`
via [react.ts](../lib/ai-inventory/react.ts)). `LocalInventoryStore` uses localStorage following the
app's conventions ([nest-document-store](../lib/nest-document-store.ts) pattern), bounded to the newest
N. A `SupabaseInventoryStore` implements the same interface later; the Admin Factory reuses it with
`target: "globalLibrary"` — the ONLY difference between user-save and admin-publish.

### Editor integration — [lib/nest-editor-ai-bridge.ts](../lib/nest-editor-ai-bridge.ts)
Adapts `InventoryAsset → LivingNestAsset` and merges into `productionEditorCatalog(extra)` so approved
AI assets appear in the tray AND resolve by id on the canvas. An "AI" virtual category was added to the
picker taxonomy. Inventory stays editor-agnostic; this adapter is the only meeting point.

### Creator Studio — [/creator-studio](../app/creator-studio)
Minimal, premium: upload/sample → subject → **Generate** → the AI output is the hero on a transparency
checker → **Approve & Save** / Discard → inventory grid + delete → **Open editor**. The kind switcher
shows the future studios as "· soon", so the multi-studio architecture is visible on the screen.

## Generation (20%)

The stub provider is a deterministic Canvas pass — corner-sampled background knockout, posterize + warm
saturate toward the Nestudio look, trim + pad to a centered transparent PNG. Basic output, **production
pipeline**. Real quality arrives by implementing the Gemini provider behind the unchanged interface.

## How each future studio reuses this (the point)

| To add… | You write | You do NOT touch |
| --- | --- | --- |
| Avatar Studio | `enabled: true` on `STUDIO_CONFIGS.avatar` + flesh out `buildAvatarPrompt` | engine, pipeline, provider, inventory, Studio UI, editor bridge |
| Background/House | same — a config flag + a prompt builder | everything else |
| Hosted quality | implement `geminiProvider` methods + register it | every studio + the UI |
| Admin Asset Factory | an `InventoryStore` with `target: "globalLibrary"` | the engine + pipeline |

## Tests

`test/ai-engine.test.ts` (prompts, provider registry, studio dispatch guard, pipeline orchestration with
a fake provider) + `test/ai-inventory.test.ts` (store CRUD, subscription, target, mapping) — **18 tests**.

## Gates

typecheck ✓ · lint ✓ · test **480** ✓ · build ✓.

## Not built (as instructed)

Avatar/background/house/batch generation, marketplace, AI chat, animation. Only the shared foundation.
