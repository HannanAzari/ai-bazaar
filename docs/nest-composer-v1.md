# Nestudio V2 — Nest Composer V1 (M4)

> The smallest production-quality **deterministic Nest Composer**: a structured
> creator profile → a valid `ComposedNest` manifest, built by **selecting and
> binding existing approved data**. It never generates art, coordinates, or content,
> never calls an AI provider, and never uses randomness.
>
> **Source of truth:** [`lib/nest-composer.ts`](../lib/nest-composer.ts) (engine),
> [`lib/nest-composer-types.ts`](../lib/nest-composer-types.ts) (contract),
> [`lib/fixtures/golden-nest-v2-policy.ts`](../lib/fixtures/golden-nest-v2-policy.ts)
> (policy), [`lib/fixtures/nest-creator-profiles.ts`](../lib/fixtures/nest-creator-profiles.ts)
> (demo profiles). Tests: [`test/nest-composer.test.ts`](../test/nest-composer.test.ts).
> Demo route: `/design/nest-composer` (internal, noindex). It composes against the
> locked Golden Nest V2 contract ([`lib/nest-types.ts`](../lib/nest-types.ts)) and
> renders with the **existing** renderer ([`golden-nest-stage.tsx`](../components/nest/golden-nest-stage.tsx)).

## Responsibility

The Composer takes:

- one `CreatorNestProfile` (display name, creator/personality/interest tags, a
  preferred ambience, content sources, access level),
- the approved catalogs (one `NestTemplate`, `NestAsset[]`, `Interaction[]`),
- a typed `NestCompositionPolicy`,

and returns a `ComposeNestResult` = `{ nest, decisions, warnings }`, where `nest`
is a validated `ComposedNest` (slot → asset + content, ambience, avatar, quick
links), `decisions` is the per-slot audit trace, and `warnings` are soft issues.

It **selects and binds existing data**. It does **not**: call OpenAI/Gemini/any
provider, generate images, generate coordinates, edit artwork, move assets outside
Scene Slots, use randomness, persist to Supabase, build onboarding or drag-and-drop,
or change the locked Golden Nest art/camera. AI may *later* recommend profile tags
or content priorities — but the deterministic Composer remains the **final authority**
that produces a valid Nest.

## Inputs and outputs

```ts
composeNest({ profile, templates, assets, interactions, policy }): ComposeNestResult
// → { nest: ComposedNest, decisions: CompositionDecision[], warnings: string[] }
```

Hard failures throw `NestCompositionError` (never returned as a "successful" Nest):
a missing target template, an unfillable **required** slot, or a result that fails
`validateComposedNest`.

## Hard filters (eligibility)

An asset is eligible for a slot only when **all** hold:

1. `approvalStatus === "approved"` — humans approve; raw AI never ships.
2. `dnaVersion === template.dnaVersion` — DNA lineage matches.
3. `cameraContractVersion === template.cameraContractVersion` — camera contract matches.
4. `isSlotCompatible(slot, asset)` — the asset declares the slot's `slotType` **and**
   the slot accepts the asset's `category` (both directions must agree).
5. The slot is not in `policy.excludedSlotIds`.
6. The asset is not already placed (unless `policy.allowAssetReuse`).

An incompatible or unapproved asset is never placed. A required slot with zero
eligible assets is a hard error.

## Scoring (deterministic)

After hard filtering, each eligible asset is scored with stable integer weights:

| Signal | Weight |
|---|---|
| Slot/category match (base) | 10 |
| Asset default interaction == slot default | +4 |
| Creator-type tag overlap | +3 each |
| Interest tag overlap | +2 each |
| Personality tag overlap | +1 each |
| Variant accent/material echoes an interest/personality tag | +1 |
| Policy fallback for the slot | +1 |

No `Math.random`, no timestamps, no non-deterministic ordering.

## Stable tie-breaking

Candidates sort by **score descending, then asset id ascending**. The same profile
+ catalog therefore always yields the identical Nest (covered by the determinism and
tie-break tests).

## Required vs optional slots

- Every **required** slot must be filled (`policy.requiredSlotIds`); a missing one
  throws.
- **Optional** slots (`policy.optionalSlotIds`) are filled only when they have an
  eligible asset *and* there is headroom under `maxObjects` — never to pad the object
  count. For Golden Nest V2 the policy supplies a fallback asset for each optional
  slot (lamp/plant/books), an explicit curation decision that completes the locked
  seven-object room.
- **Excluded** slots (`policy.excludedSlotIds`) are never filled. Golden Nest V2
  excludes `slot-bookshelf` — the background's baked right-wall niche reads as the
  architectural storage.

## Content binding

For each filled slot that has a `SlotContentRule`, the engine binds the best
unconsumed creator content source by:

1. **content-type priority for the slot** (first type with any match wins),
2. **source `priority`** (lower = more important),
3. **source id** (ascending) — final stable tie-break.

Each source is consumed **at most once** (unless policy allows reuse). The binding
stamps the rule's `bindContentType` (e.g. media → `video`, frame → `gallery`, books
→ `article`, avatar → `intro`) onto a `NestContentBinding` carrying the source URL +
title.

Golden Nest V2 content rules (and why they deviate from the bible's *example*
priorities):

| Slot | Priority | Binds |
|---|---|---|
| `slot-media` | youtube → video → tiktok | `video` |
| `slot-frame` | gallery → instagram | `gallery` |
| `slot-books` | article | `article` |
| `slot-avatar` | bio | `intro` |
| `slot-desk` | *(none)* | — |
| `slot-lamp` / `slot-plant` | *(none)* | ambience / ambient only |

`slot-desk` is **non-interactive** in Golden Nest V2 (no interaction on the slot or
the desk asset), so it carries no creator content — a website surfaces as a quick
link instead. `slot-books` binds an `article` only (a website is not a book), so a
creator with no article keeps their website/portfolio as a quick link.

## Quick-link fallback

Every content source not bound to an object becomes a `NestQuickLink`, ordered by
`priority` then id. This preserves the mandatory flat, crawlable link list
(SEO/accessibility/"I just want the link").

## Ambience selection

- Use `profile.preferredAmbienceId` when it exists on the template.
- Otherwise use `policy.fallbackAmbienceId` (then the template's first preset).
- An invalid preference produces a **warning**, not a crash.

## Error / warning behaviour

- **Throws `NestCompositionError`**: missing target template; an unfillable required
  slot; a result that fails `validateComposedNest`.
- **Warnings (soft)**: an invalid ambience preference that fell back; any soft
  warnings surfaced by `validateComposedNest` (e.g. an unfilled primary slot).

## Demo profiles → outcomes

| Profile | Media | Frame | Books | Avatar | Quick links | Ambience |
|---|---|---|---|---|---|---|
| **Founder** | YouTube | gallery | article ("How we built it") | bio | website, 2nd article | golden evening |
| **Musician** | music video | Instagram | — (no article) | bio | Spotify, website | cozy night |
| **Photographer** | YouTube reel | gallery | — (no article) | bio | Instagram, portfolio | warm day |

All three fill the same seven slots (frame, media, lamp, desk, plant, books, avatar),
leave the bookshelf empty, and pass `validateComposedNest`.

## Current limitations

- Composes against **exactly one** template (Golden Nest V2). Multi-template / House
  selection is future work.
- No avatar or personal-object generation (the two runtime-generated kinds) — the
  avatar asset is selected from the approved catalog; `personalAssetIds` is empty.
- No persistence (no Supabase), no editor UI, no drag-and-drop, no onboarding.
- Scoring weights are hand-tuned and intentionally simple; for the current catalog
  each slot has a single eligible asset, so scoring mainly documents *why* and powers
  deterministic tie-breaking when catalogs grow.

## What belongs in the later AI recommendation layer

> **AI may recommend profile tags or content priorities later. The deterministic
> Composer remains the final authority that produces a valid Nest.**

A future AI layer can *suggest* personality/interest tags from a creator's links,
*propose* per-slot content priorities, or *rank* candidate templates — but its output
feeds the Composer as plain profile/policy data. The Composer still applies the hard
filters, deterministic scoring, stable tie-breaking, and `validateComposedNest` gate,
so the final Nest is always reproducible and valid regardless of what the AI proposed.
