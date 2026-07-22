# Generation Platform — one engine, many modules

Asset Factory and Nest Factory are no longer separate apps. They are **modules** on one
shared **Generation Platform**. Adding a new generation type (Avatar, …) means writing a
module descriptor — **no shell code**.

## Shape

```
components/generation/
  generation-studio.tsx   ← THE engine: gate, token, input→interpret→spec→generate→
                             review→approve→publish→saved stage machine, re-entrancy
                             guard, 401 handling, cost display, moderation gating,
                             upload capability, sticky action bar.
  ui.tsx                  ← shared primitives (Centered, Spinner, Field, Warn, Thumb,
                             StickyBar, Primary, Secondary, CHECKER).
lib/generation-platform/
  types.ts                ← GenerationModule<Spec, Result> contract + Ownership seam.
  modules/asset-module.tsx← object engine (reference → segmentation → honest → publish).
  modules/nest-module.tsx ← empty-room engine (text-to-image → publish).
app/asset-factory/asset-factory-client.tsx  → <GenerationStudio module={assetModule} />
app/nest-factory/nest-factory-client.tsx     → <GenerationStudio module={nestModule} />
```

## The contract (`GenerationModule<Spec, Result>`)

A module supplies ONLY what differs:

- `copy` — titles, placeholders, review question, approve label, publishing label.
- `uploadMode` — `"none" | "optional" | "required"` (Avatar will be `"required"`).
- `translate()` → `Spec` · `estimatedCost` · `moderationOk` · `specName`.
- `generate()` → `Result` (the ONLY meaningfully different part) · `resultImage` · `resultCost`.
- `publish()` → its library (nest_assets / nest_backgrounds / …) · optional `onApproved` local mirror.
- Four render slots: `SpecView`, `ReviewView`, `DetailsView?`, `SavedView`.

The Studio owns the gate, stages, guard, 401→gate, cost line, sticky bar, and ownership.
A module never re-implements any of that.

## What the refactor deleted

| | before | after |
|---|---|---|
| `asset-factory-client.tsx` | 350 lines | **11** |
| `nest-factory-client.tsx` | 272 lines | **11** |

The duplicated shell (gate, token, stage machine, sticky bar, six primitives,
interpret/generate/approve orchestration) that existed **in both** clients now exists **once**
in `generation-studio.tsx` + `ui.tsx` (312 lines, shared). The remaining per-module code is
genuinely type-specific (the engine + the four screens), not duplication.

## Adding a module (e.g. Avatar) — the proof

1. `lib/generation-platform/modules/avatar-module.tsx`: implement `GenerationModule<AvatarSpec,
   AvatarResult>` — `uploadMode: "required"`, an avatar translator, the avatar generate engine,
   `publish()` → `nest_avatars`, and the four screens.
2. `app/avatar-factory/…` → `<GenerationStudio module={avatarModule} />`.

No shell code. TypeScript enforces the whole contract at compile time. That is the platform's
success test: a new engine is a descriptor, not an app.

## Behaviour guarantee

The refactor is behaviour-preserving: Asset Factory and Nest Factory look and act exactly as
before (verified: typecheck, 589 tests, production build, browser render). One latent fix: a
failed publish now returns to the Review screen so **Approve** can be retried (previously the UI
stuck on the publishing spinner despite telling the user to retry).
