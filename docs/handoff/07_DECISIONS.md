# 07 · DECISIONS

> Permanent decision log. Append-only — never delete a decision, mark it superseded. No reasoning is ever lost.
> Status legend: 🔒 Never-change · 🔁 Can-change · ❌ Rejected · 🕓 Future-revisit

| # | Decision | Reason | Date | Status |
|---|---|---|---|---|
| D1 | Nestudio is a **digital home / visual language of digital identity** — not a feed, link page, catalogue, Sims, or metaverse | The whole thesis; the moat | 2026-07 | 🔒 |
| D2 | Objects are an **alphabet of identity**; a new object ships only if it adds a new "letter" | Coverage over quantity; prevents bloat | 2026-07 | 🔒 |
| D3 | Vocabulary capped at **~60 objects** (emoji principle) | Expressiveness beats quantity | 2026-07 | 🔒 |
| D4 | **Four object classes** (Story / Identity / Portal / Memory) + **five visual roles** (Hero/Supporting/Atmosphere/Memory/Background); class ⟂ role | The organising taxonomy of the grammar | 2026-07 | 🔒 |
| D5 | **Nest Grammar** (12 laws) governs all composition; coherence by construction | Beautiful before editing; the product promise | 2026-07 | 🔒 |
| D6 | **The editor is a stylist, not a blank canvas** — answer questions → composed room + variants → guardrailed fine-tune | A blank room produces clutter; guarantees coherence | 2026-07 | 🔒 |
| D7 | **Universal Object System** — objects are data referencing shared registries; objects ship no bespoke code | Scale 60→1000 with flat engineering cost | 2026-07 | 🔒 |
| D8 | **One camera, one interaction language, one sound language, one design language** | A single authored world | 2026-07 | 🔒 |
| D9 | **GPT Image (`gpt-image-1`)** is the generation engine; **Gemini deprecated** | GPT Image preserves identity far better; verified | 2026-07 | 🔒 (swap only on deprecation) |
| D10 | Generation is an **honest single pass** — no repair loops, no regenerate-until-acceptable | See the real model output; simpler; the founder rejected the repair-heavy path | 2026-07 | 🔒 |
| D11 | Identity extraction states **objective facts only** — no style/material-finish/geometry/lighting words | Style words fought the render engine's matte look → regressions | 2026-07 | 🔒 |
| D12 | **Keep premium brands** on Identity/Portal objects (Canon vs Sony, PS5 vs Xbox…) where the choice signals identity | The choice is the message | 2026-07 | 🔁 (legal-gated) |
| D13 | **Products become identity** in Business Nests — discovered by wandering, never ads; pull not push | Trust through atmosphere; the anti-Linktree | 2026-07 | 🔒 |
| D14 | **Memory objects accumulate life**; reveal is **internal only**, never an external link | Emotional retention no competitor has | 2026-07 | 🔒 |
| D15 | Backgrounds, village, business impl., AI composer, sound, memory system are **postponed** (designed-for, built later) | Focus; rooms before the village | 2026-07 | 🕓 |
| D16 | Work only on branch **`m12-nest-platform`**, preview only; **never merge `main` / deploy prod** | Safety during the design/build phase | 2026-07 | 🔒 |
| D17 | **Do not freeze / tag / commit / push a v1** until the vocabulary is approved **and** a calibration batch passes | The library *look* failed once; gate before scale | 2026-07 | 🔒 |
| D18 | `furniture@8` must become **material-aware + iconic** (authorised change to the "frozen" prompt) | It forced everything wooden/beige — the rejected look | 2026-07 | 🔁 (this sprint) |
| RJ1 | ❌ Generic 100-object **furniture catalogue** | Not identity; and it all rendered wooden/beige | 2026-07 | ❌ |
| RJ2 | ❌ **Neutralise all brands** to generic | Brands *are* identity signals for creators | 2026-07 | ❌ (reversed by D12) |
| RJ3 | ❌ **Photoreal** asset look | We want iconic emoji-like glyphs, not product replicas | 2026-07 | ❌ |
| RJ4 | ❌ **Gemini** as generation provider | Could not preserve object identity | 2026-07 | ❌ |
| RV1 | 🕓 **Legal review of branded assets** before shipping trademarks | It's an IP/counsel decision, not engineering | 2026-07 | 🕓 |
| RV2 | 🕓 **Input-photo pipeline** for a real 1000-object library (paid stock / founder set) | Free stock is ~60% usable | 2026-07 | 🕓 |
| D19 | Ship a **Founder Edition Creation Studio** and **deploy it to Vercel** (branch `m12-nest-platform`, auto-deploy). The founder personally generates/approves/publishes from a phone | Calibration by real founder use beats a synthetic batch gate; unblocks library growth now | 2026-07-22 | 🔒 |
| D20 | **Asset Factory is FROZEN** — the Create flow (translator, review/approval screen, DB model, founder workflow) is done. Founder owns testing + library growth. No more Create-flow redesign unless the founder reports a bug | Stop re-engineering a working flow; ship the next engines | 2026-07-22 | 🔒 |
| D21 | **Skip the "Unified Creation Studio" milestone.** Background Factory + Avatar Factory **reuse the exact Asset Factory shell** (same UX, translator pattern, review/approval screen, DB model, mobile founder workflow). **Only the generation engine changes** per type | One consistent, proven flow; no three-app divergence | 2026-07-22 | 🔒 |
| D22 | Founder capability gate = **server-side `FOUNDER_ACCESS_TOKEN`** (`x-founder-token`, constant-time, fails closed). Not user auth — Supabase Auth stays reserved for the future private-user ownership model (`scope: global\|private-user`, `ownerId`) | Smallest safe server-enforced gate; no OAuth build this phase | 2026-07-22 | 🔁 |
| D23 | Build order after the two factories: **Creator Generator** (compose a complete starter Nest) → **Interaction Engine** (UOS surfaces/animation/sound). Do **not** start either during the factory sprint | Founder-set sequencing | 2026-07-22 | 🔒 |
| D16b | 🔁 **Supersedes D16/D17 for the Founder Edition track:** deploying the founder-gated Studio to a Vercel preview is now authorised; global publishing is founder-gated, never anonymous | The design-phase "never deploy / don't push v1" posture no longer fits a founder-only, gated tool | 2026-07-22 | 🔁 |

> When you make a new major decision, add a row. When one changes, add a new row that supersedes the old and mark the old 🔁→superseded — never edit history.
