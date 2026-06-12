# AI Bazaar — visual redesign plan: "Lantern Hollow"

Status: approved direction pending review · No code in this document · 2026-06-10

The goal: move from "AI-generated prototype" to a hand-painted miniature village
people screenshot and share. References: Hobbiton, Animal Crossing, Tiny Glade,
Studio Ghibli backgrounds, premium mobile-game maps (Clash Royale world map).

---

## 1. Visual diagnosis — why it reads "childish and flat"

Diagnosed from live screenshots of the map (`/`), street (`/bazaar/saffron-yard`),
and interior (`/shop/saffron.tiny.lantern`).

**No light model (the #1 flatness cause).** Every surface is a flat fill or a
2-stop gradient. There is no consistent sun direction, no ambient occlusion,
no cast shadows. Tiny Glade and AC look "premium" almost entirely because every
object has a lit face, a shaded face, and a soft contact shadow.

**Icons used as illustrations (the #1 childish cause).** Lucide `TreePine`,
`Flower2`, `Heart`, `Sparkles` are UI glyphs. Placed inside a scene they read
as clip-art stickers. A drawn tree and an icon tree are different species.

**Primitive geometry.** Houses are CSS rectangles with pasted-on features:
roofs have no overhang, no thickness, no eaves shadow; the balcony renders as a
comb; the stepped roof reads as a rendering glitch. Doors sit flush with walls
(real doors are recessed). Windows have no sills or depth.

**Gumdrop plots.** Each garden is a floating rounded green blob on a polka-dot
road. Real streets have continuous ground with boundaries (hedges, fences),
not islands.

**Nursery pastels at uniform value.** Lavender, mint, peach walls at similar
lightness as the sky — nothing recedes, nothing advances. Premium cosy palettes
keep large surfaces desaturated and spend saturation only on focal points
(lit windows, flowers, doors).

**Diagram geometry on the map.** Ten perfect circles of identical size, houses
spaced at exact equal angles, roads of uniform width. Geometric perfection reads
as a chart. Hand-feel requires jitter: rotation, spacing, size variance.

**Template typography.** Georgia display + Arial body are system defaults, and
nearly every micro-label is 900-weight letterspaced uppercase — a SaaS dashboard
habit. Storybooks don't shout in caps.

**UI chrome floating in the world.** White capsule arrows, a white heart chip,
backdrop-blur cards sit on top of scenes like a Figma layer that didn't merge.

**Mixed projection in the interior.** Front-on window and frames vs. a
perspective-tilted floor; caption text floats on the floor with no surface to
sit on; objects have no contact shadows so everything hovers.

**Scale drift.** Mailbox vs. door vs. flowers vs. pebbles have arbitrary
relative sizes; pebbles read as blobs.

---

## 2. New art direction — "Lantern Hollow"

A hand-painted miniature diorama at golden hour. Six pillars; every future
visual decision should be testable against them.

1. **One sun.** Global warm light from the top-left. All shadows fall
   bottom-right, slightly cool (plum, not grey). Every asset ships with three
   values — lit, mid, shade — plus a soft contact shadow. No exceptions.
2. **Clay-and-felt forms.** Chunky silhouettes, soft corners, slight
   irregularity. Nothing perfectly straight or parallel; 1–2° of wonk is the
   signature. Roofs are oversized relative to walls (AC proportions).
3. **Quiet ground, glowing life.** Big surfaces (meadow, parchment, walls) stay
   desaturated. Saturation is budgeted for what should pull the eye: window
   light, doors, flowers, lanterns, water.
4. **Depth through air.** Minimum three parallax planes per scene; distant
   layers get lighter and hazier (atmospheric perspective); edges vignette
   gently.
5. **Drawn, not assembled.** Every object visible inside a scene is an authored
   SVG illustration. UI icons (lucide) survive only in chrome (header, buttons),
   never inside the world.
6. **Motion is weather.** Slow ambient loops — smoke, swaying canopy, water
   ripple, drifting cloud shadows. Nothing bounces or pulses for attention,
   with one exception: the soft glow on a claimable door.

Reference mapping: Hobbiton → organic ground lines, round doors, garden
density. Animal Crossing → silhouette readability, big-roof proportions.
Tiny Glade → lighting, AO, material softness. Clash Royale map → terrain
patches, props between points of interest, the map-as-physical-object framing
(cartouche, vignette, edge).

---

## 3. Colour palette

Cool shadows + warm lights is the single highest-leverage change.

### Paper & ink (app surfaces)
| Token | Hex | Use |
|---|---|---|
| parchment-light | `#FAF1DC` | app background |
| parchment | `#F2E4C4` | panels, cards |
| parchment-deep | `#E3CFA3` | recessed areas, dividers |
| ink-soft | `#6B5847` | secondary text |
| ink | `#38291D` | primary text (warm espresso, never near-black) |

### Nature
| Token | Hex | Use |
|---|---|---|
| meadow-light | `#B5C77D` | sunlit grass |
| meadow | `#93AC5F` | base grass (less minty than current) |
| meadow-shade | `#6E8A47` | grass shadow side |
| canopy | `#4E6B3A` | tree mass |
| water | `#8FC4D6` / `#5D93AC` | ponds, stream |

### Built world
| Token | Hex | Use |
|---|---|---|
| plaster-warm | `#F0DFBC` | default wall |
| stone | `#C7B393` / `#A18B6B` | paths, walls, wells |
| timber | `#8A5C3B` / `#5C3E26` | frames, signs, furniture |
| roof-terracotta | `#A65B3F` | roof family A |
| roof-slate | `#5B6B73` | roof family B |

### Light & shadow
| Token | Hex | Use |
|---|---|---|
| lantern | `#FFC55C` | window glow, lamps |
| ember | `#E08F3F` | accents, CTA |
| dusk | `#F6D8A8` | sky warm band |
| shadow-cool | `#46365A` @ 10–30% | ALL shadows (never grey/black) |

### Village accents — normalized
Keep ten hues, but pull every accent into one saturation/value band
(HSV S 45–60, V 55–70) so no village looks like it belongs to a different game:
Moon `#5F7E9E` · Saffron `#D9913C` · Rose `#C16A74` · Cedar `#6F9268` ·
Cobalt `#7C7BB8` · Honey `#C99A4B` · Lantern `#C77950` · Velvet `#97729F` ·
Paper `#7E997F` · Blue `#6691AC`.

### Usage rules
- 60/30/10: parchment+meadow ≈ 60%, built materials ≈ 30%, glow+accents ≈ 10%.
- Value plan: sky/background L 80–95, midground L 55–75, focal contrast
  (dark door + bright window) reserved for interaction targets.
- Shadows always `shadow-cool` at alpha; highlights always warm.

---

## 4. Typography

- **Display: Fraunces** (Google, variable). Optical size + SOFT axis high.
  Weights 500–600 only. Used for: page titles, village names, house names,
  modal headings. It has the storybook warmth Georgia is faking.
- **UI/body: Nunito Sans** (Google). 400 body, 600 emphasis, 700 buttons.
  Gently rounded, adult. (Paid upgrades later: Recoleta/Gelica display.)
- Kill ~90% of uppercase tracked eyebrows. Replace with Fraunces italic
  (e.g. *Saffron Yard · house 14*) or 600-weight sentence case.
- In-scene text (plaques, signs, deed modal) is always Fraunces on a drawn
  wood/parchment surface — never raw UI text floating in a scene.
- Implementation: `next/font` (self-hosted, no CLS), tabular numerals for stats,
  weight 900 removed app-wide.

---

## 5. House design system

One component, one source of truth, three levels of detail:
`<House lod="street | card | map" seed palette state />` used by street view,
discover cards, the map (tiny), and the studio exterior preview.

### Anatomy (paint order)
ground contact shadow → stone plinth → wall (lit + shade faces) → eaves shadow
band on wall → roof with visible overhang, thickness edge, and ridge highlight →
chimney (cap + pot) → recessed door (frame, step, hardware) → windows (frame,
sill, mullions, inner glow layer) → trim/beams → name shingle → garden props →
glow bloom (lived-in only).

### Parameters (deterministic from address/slot — SSR-safe, no Math.random)
| Axis | Variants |
|---|---|
| Roof shape | gable · hip · round (hobbit) · dutch gable |
| Roof material | thatch · terracotta · slate · green shingle |
| Wall plaster | 5 tints derived from village accent × plaster-warm |
| Floors | 1 · 1.5 (dormer) · 2 |
| Door | round hobbit · arched timber · planked square |
| Windows | 2–4, arched/round/square, shutters on/off |
| Garden recipe | wildflower · herb rows · small tree · lawn+stones |

### Proportion rules (the AC trick)
Roof ≥ 45% of total silhouette height. Door ≈ 55–60% of wall height (human
scale). No window larger than the door. Chimney clears the ridge. Width >
height for 1-floor cottages.

### States
- **Open**: muted wall, closed shutters, drawn wooden "open" sign, slow warm
  pulse on the door only.
- **Lived-in**: lit windows (lantern glow + bloom), chimney smoke, mature
  garden, name shingle.
- **Yours**: brass lantern by the door + slightly warmer rim light.
- **Hover**: 4px lift, shadow softens/grows, window bloom +20%.

---

## 6. Village map design system

The map becomes an object — an illustrated map someone drew — not a viewport.

- **Terrain**: parchment-toned meadow (desaturate current mint), painted
  patches: striped crop fields, forest clusters (overlapping canopy blobs with
  shared shadow), a stream crossing the roads with two bridges, rock outcrops.
  Slow cloud shadows drift across the ground (4% opacity dark blobs).
- **Map-as-object framing**: deckled/burned edge vignette, a cartouche title
  block ("Lantern Hollow — ten villages, one growing town") with a small
  compass rose. The current floating white cards and pills are removed; hints
  live in the cartouche.
- **Villages**: irregular clearing blob (not a perfect circle); ring road with
  varying width; houses are map-LOD sprites with jitter (±6° rotation, ±3%
  radius, ±10% size). Central features become real illustrations: pond with
  lily pads and a tiny dock, oak with a swing, fountain with animated ripple.
- **Naming**: village name on a hung wooden plaque (rope + nail), open count as
  a small carved door-icon + number on the plaque, not a floating stat.
- **Atmosphere per village**: clearing tint + one signature prop set (Moon
  Court: pale blue lanterns; Saffron Yard: marigold beds; Cedar Ring: extra
  pines; Velvet Square: bunting; etc.).
- **Interaction**: hover lifts the village (shadow grows) and brightens its
  connecting roads; click does a brief zoom-toward transition, then navigates.

---

## 7. Street view design system

- **Parallax planes** (scroll-driven `transform`, cheap): sky with sun and
  clouds (0.2×) → far hazy hills (0.4×) → tree line (0.6×) → house row (1×) →
  foreground verge with grass-blade and lamppost silhouettes (1.3×).
- **Continuous ground**: one lawn band with subtle mow stripes; plots separated
  by drawn boundaries — hedge, picket fence, or low stone wall (rotates per
  village). Road is a winding strip of irregular drawn cobbles/dirt — the
  polka-dot pattern goes.
- **Houses**: street-LOD `<House>` from §5, including all states.
- **Street furniture** every 3–5 plots: well, bench (with cat), lit lamppost,
  village notice board, hay cart — breaks repetition, gives walk rhythm.
- **Lighting pass**: golden-hour sky gradient per village accent; rim light on
  roof ridges; bloom behind lit windows; long soft shadows to the right.
  Optional magic: sky tint follows the visitor's local time of day.
- **UI inside the scene**: navigation arrows become carved wooden signposts at
  the rail edges; the walk hint becomes a small path sign. The claim modal is
  redrawn as a parchment property deed with a wax-seal confirm button.

---

## 8. Interior room design system

- **True one-point perspective box**: back wall + two visible trapezoid side
  walls (same wallpaper, stepped darker) + ceiling sliver + floorboards
  converging to the vanishing point. Baseboard and picture rail mouldings give
  hung objects a believable height. This fixes the mixed-projection problem.
- **Materials per village**: wallpaper pattern (stripe / sprig / lattice /
  plain) tinted by village accent; two wood floor tones; three rug shapes.
- **Light**: layered window beam (two translucent wedges), lamp pools, corner
  vignette, a few drifting dust motes in the beam.
- **Objects replace cards** (decoration types map to furniture):
  - `link` → bookshelf; each link is a book spine, hover slides it out.
  - `image` / `ai-image` → framed canvas on wall hooks or an easel.
  - `text` → writing desk with an open notebook (or pinned note above it).
  - media placeholder → wooden-cased TV / easel.
  - social proof (later) → guestbook on a side table.
  - life signals: plant, fireplace, sleeping cat (one idle animation max).
- **Anchor-point layout** instead of a CSS grid: fixed slots (6 wall hooks,
  2 shelf rows, 5 floor spots). Existing `zone` data maps onto anchor groups,
  so stored decorations keep working. The grid is the last "profile page" tell.
- Owner/profile column stays outside the room and stays slim.

---

## 9. Asset list (all hand-authored SVG React components — no PNGs, no Three.js)

**Tier 1 — required for the new look (~30 assets)**
- House kit: 5 wall plasters, 4 roof shapes × materials, 4 doors, 3 windows
  (+shutters), 2 chimneys, name shingle, open sign, smoke, glow bloom.
- Ground kit: lawn band, mow-stripe texture, cobble road strip, dirt path,
  hedge, picket fence, stone wall, contact-shadow primitives.
- Map kit: map-LOD house (×6 variants), pond, oak, fountain, field patch ×2,
  forest clump ×3, stream tile + bridge, plaque, cartouche, compass rose.
- Room kit: room shell (walls/floor/ceiling), 4 wallpapers, 2 floors, window,
  beam, lamp, rug ×3.

**Tier 2 — objects & furniture (~20)**
- Interior: bookshelf, frame ×3, desk + notebook, TV/easel, plant ×2,
  fireplace, side table, guestbook.
- Street/map props: well, bench, cat, lamppost, notice board, hay cart,
  signpost, rocks ×2, flowers ×4, trees ×3, bushes ×2.

**Tier 3 — ambience (~10)**
- Clouds + cloud shadows, birds (2-frame), dust motes, fireflies (redrawn),
  ripples, falling leaf, deed-modal parchment + wax seal, onboarding letter.

**Other**: Fraunces + Nunito Sans via `next/font`; paper-grain via inline SVG
turbulence (no image files).

---

## 10. Implementation plan (phased; each phase ships looking better)

**Phase 0 — Foundations (small).** Fonts via `next/font`, palette tokens as CSS
variables + Tailwind theme, shadow/glow tokens, remove weight-900 habit,
restyle buttons/panels to parchment/timber language.
Files: `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`,
`components/ui/button.tsx`, `components/site-header.tsx`, `components/footer.tsx`.

**Phase 1 — House kit (the unlock).** Build `components/scene/house/*`
(Wall, Roof, Door, Window, Garden, House with LODs, seeded variation from
address — deterministic for SSR). Verify on a scratch route, then swap into
the street.

**Phase 2 — Street scene.** Parallax layers, continuous ground, boundaries,
street furniture, lighting pass, signpost navigation, deed modal.
Files: `components/street-walk.tsx` + new `components/scene/street/*`.

**Phase 3 — Village map.** Terrain painting, map-as-object framing, irregular
villages with jittered map-LOD houses, plaques, hover/zoom interactions.
Files: `components/village-world.tsx` + new `components/scene/map/*`.

**Phase 4 — Interior.** Perspective room shell, materials, anchor-point layout,
object library mapped to decoration types (zone data preserved), studio editor
preview reuses the same components.
Files: `components/shop-room.tsx`, `app/studio/page.tsx` (preview only) +
new `components/scene/room/*`.

**Phase 5 — Cards, copy, chrome.** Discover cards use card-LOD House; restyle
onboarding as an arriving letter; sweep remaining capsule chrome out of scenes.

**Phase 6 — Ambience & QA.** Cloud shadows, birds, dust motes, time-of-day sky;
reduced-motion audit; DOM budget check on the map (240 map-LOD houses ≈ ~2k
nodes — memoize, `content-visibility`); mobile pass; lint/typecheck/build;
screenshot review desktop + mobile per view.

**Order rationale**: the house kit (Phase 1) unlocks street, map, and cards at
once; the street is the most-visited scene so it converts first.

**Per-phase exit test**: lint/typecheck/build green + fresh screenshots + the
share test — "would someone post this screenshot unprompted?"

**Risks**
- SSR determinism: all variation must derive from stable ids (learned: the
  hydration bug from float serialization).
- Map performance: animate transforms/opacity only; no layout-triggering hovers.
- Scope creep into logic: claim/like/follow/storage code is untouched —
  presentation swaps only.
- Tailwind arbitrary-value sprawl: scene visuals move into SVG attributes,
  Tailwind stays for layout/chrome.

**Constraints honoured**: no Three.js, no payments/ads, no real AI image
generation, no multi-room, responsive, CSS/SVG only.
