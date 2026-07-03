# M17 — Discovery Feed (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production
> deploy.** The first real discovery experience — makes Nestudio feel alive so a visitor
> wants to wander into another Nest. No villages / social graph / real likes / marketplace /
> AI. Canonical record; see [changelog.md](changelog.md) and [decision-log.md](decision-log.md)
> (ADR-036).

## Mission

> "I can wander through other people's Nests." Discovery is about **curiosity** — *who lives
> here? what does this Nest say about them? what else can I explore?* — not endless scrolling.

## Discovery architecture

One backend-free model unifies the two sources we already have, so Home + Explore + the
visitor page all speak the same shape:

```
sources                         lib/nest-discovery.ts (pure, tested)
  published Nests  ─┐            DiscoveryItem { id · title · creator · thumbnail ·
  curated examples ─┴─ assemble ▶   tags · category · visibility · source · href }
                                  search / filterByTag / collectTags / collectCategories
        │
        ▼  useDiscovery() (components/nest/app-shell/use-discovery.ts)
   live items: published (creator resolved from ownerId → M16 profile; tags/persona
   borrowed from the source template) ++ curated (templates)
        │
        ├─▶ Home  = DiscoveryFeed   (immersive vertical snap feed)
        ├─▶ Explore = DiscoveryNestCard grid/list + search + chips
        └─▶ /nest/[slug] = CreatorBadge + NestTags + "more Nests" CTA
```

- **`lib/nest-discovery.ts`** — the model + `templateToExample` (moved here; `curated.ts`
  re-exports it) + search/filter/tag/category helpers. Pure and unit-tested.
- **Reusable UI** (`components/nest/app-shell/discovery.tsx`): `DiscoveryFeed`,
  `DiscoveryNestCard` (grid | row), `CreatorBadge`, `NestTags`, `VisitNestButton`.
- **Published Nests borrow tags + persona from their `sourceTemplateId` template**, so they're
  searchable by theme even though `NestDocument` has no tags field yet.

## What changed (by phase)

| Phase | Change | Key files |
|---|---|---|
| **1 — Model** | `DiscoveryItem` + builders (`curatedItems`, `publishedItem`) + `searchDiscovery` / `filterByTag` / `collectTags` / `collectCategories` / `creatorLabel`. | [`nest-discovery.ts`](../lib/nest-discovery.ts) |
| **2 — Home feed** | `/home` is now a mobile-first **vertical snap feed** of near-full-screen Nest previews: creator badge · title · tags · Visit + Create CTAs · disabled Save (coming-soon). Cozy warm gradient — not TikTok-black, not Rooms.xyz. | [`app/home/*`](../app/home), `discovery.tsx` (`DiscoveryFeed`) |
| **3 — Components** | `DiscoveryFeed` · `DiscoveryNestCard` · `CreatorBadge` · `NestTags` · `VisitNestButton`, shared by Home + Explore + visitor. | [`discovery.tsx`](../components/nest/app-shell/discovery.tsx) |
| **4 — Explore** | search by **title / creator / tags**, **category (persona) chips**, trending tag chips, **grid/list toggle**. | [`app/explore/*`](../app/explore) |
| **5 — Visitor UX** | `/nest/[slug]` leads with the **real creator badge** (→ `/@username`), title, tags, and **"Wander more Nests"** + "Create your own" — entering someone's identity space, not a static page. Follow/likes hidden. | [`app/nest/[slug]/visitor-client.tsx`](../app/nest/[slug]/visitor-client.tsx) |
| **6 — Empty states** | Feed empty, no search results, guest, signed-in-no-nests, and broken/private/not-found Nest links all offer **Create a Nest** + **Explore**. | feed/explore/visitor + `profile-dashboard-client.tsx` |

## Verification (Phase 7 — iPhone 375×812, no console errors)

`/home` immersive feed → scroll/snap to next → Visit a Nest (creator badge · More Nests ·
Create) → back → `/explore` search + category "Gamer" (1 match) + list toggle → sign up
`@makerhannan` → create → **publish** → the published Nest **leads the Home feed as a LIVE card
with the real `@makerhannan` creator badge + `#creator #loft` tags** and appears in Explore.

## What was intentionally NOT changed

- Single editor `/nest-editor`, M16 identity/account **ownership**, and local draft **migration**
  are untouched. No follows / comments / real likes backend / villages / marketplace / AI. Auth
  is not rewritten. The Save/Like heart is present but **disabled** (coming-soon), per the rules.

## Known limitations

- **Curated / `?c=` links** decode a compact doc with no `ownerId` or `sourceTemplateId`, so a
  curated Nest opened via its share link shows the default creator ("A Nestudio creator") and no
  tags. Locally-published Nests (owner's browser) resolve both. Real cross-device creator/tags
  arrive with the Supabase cutover + a `nest_tags` column.
- Discovery is **local per browser** (like the rest of the M16 local backend); trending is
  frequency over the visible set, not global. No recommendation ranking — published lead, curated
  fill.

## Gates

`typecheck · lint · test (356) · build` — all green (Node 20). New tests:
[`nest-discovery.test.ts`](../test/nest-discovery.test.ts) — item generation, published inclusion,
search/filter, tags/categories, creator labels, empty-state safety.
