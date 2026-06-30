# Nest Connect & Multi-Hotspot Interactions V1 (M7B)

> This sprint adds the **interaction-authoring layer**: a visible asset may contain
> multiple independently interactive **hotspots**, each bound to content or an action.
> Internal route: `/design/nest-editor` (noindex).
>
> **Hotspots are interaction regions attached to an asset instance. They are not
> independent visual assets.**

## Asset vs hotspot

An **asset** is a reusable visual object (art + a placement instance). A **hotspot** is
a sub-region of one asset instance that opens or controls something — it has no art of
its own. One asset may carry many hotspots (a desk's laptop/notebook, a media unit's
screen). The creator interacts with the precise sub-region, never the whole image.

## Predefined vs custom hotspots

- **Predefined** (`lib/nest-hotspot-catalog.ts`) — art-aligned regions that ship with
  approved assets. Normal creators never draw them; they only choose what each opens.
- **Custom** — author-drawn rectangle/ellipse regions added in Advanced mode for new or
  bespoke assets.

## Asset-local normalized geometry

Hotspot geometry is normalized **0..1 inside the asset's own box** (not the whole Nest),
so a hotspot stays attached and scales/rotates/flips automatically with its asset — no
re-authoring when the asset moves or resizes. The renderer maps a hotspot into Nest
coordinates within the asset's transformed container, so CSS rotation/flip apply for free.

## Modes: Arrange / Connect / Preview

The editor mode bar is now **Arrange · Assets · Connect · Preview**.

- **Arrange** — move/resize/rotate/duplicate/layer/remove assets.
- **Connect** — tap an asset to select it; its predefined hotspots appear as subtle teal
  overlays; tap a region (or its chip) to bind content. Arrange gestures are disabled so
  a drag never repositions an asset.
- **Preview** — experience the Nest as a visitor; hotspot overlays are hidden but their
  hit areas are live. An internal **Hotspots** toggle reveals the regions for testing
  (off in normal Preview).
- **Connect (sub-)flow:** Connect → tap desk → choose Laptop/Notebook/Desk lamp → choose
  what it opens → enter a safe link (or an internal action) → Save → Preview.

## Supported hotspot shapes

**Rectangle** and **ellipse** (asset-local). Polygon hotspots are deferred.

## Semantic types

`video · music · podcast · website · article · gallery · shop · profile · ambience ·
animation · custom_link`. `ambience`, `animation`, and `profile` are **internal actions**
that run in the Nest and need no URL.

## Content bindings (normal creator)

When a hotspot is selected, the sheet shows its name, what it opens, the current
connection, and Connect / Change / Remove. URL-based semantics take a link + optional
label; internal semantics need no link. Bindings are validated before they are saved;
errors show inline. **No provider API integrations** this sprint — plain links suffice.

## Visitor interaction resolution

On a visitor tap:
1. If the asset has hotspots, **only the precise hotspot** under the tap fires (the
   topmost/last enabled hotspot when regions overlap — deterministic).
2. The hotspot's binding (not the whole-asset binding) drives the bottom interaction
   drawer and its CTA.
3. The owning asset's generic whole-object interaction **does not also fire** (the
   whole-object button is suppressed when hotspots exist, and hotspot clicks stop
   propagation).
4. Only **enabled** hotspots respond; disabled ones are inert and invisible in Preview.
5. Hotspots are focusable buttons with ARIA labels (keyboard accessible).

## Whole-object fallback

If an asset has **no** hotspots, its existing whole-object interaction is preserved
(backward-compatible). This is why the locked Golden Living Nest and Golden Nest routes
render and behave exactly as before — their fixtures set no hotspots.

## Transformation mapping

Hotspots are stored in asset-local coordinates, so **move** and **resize** of the asset
change nothing in the hotspot data — the regions follow automatically. **Rotation** and
**horizontal flip** are applied by the same CSS transform on the asset's container, so
hotspots rotate/mirror with the art. (Advanced hotspot move/resize math is computed in
the asset's un-rotated local frame; it is most precise on un-rotated assets.)

## Predefined catalog (current core assets)

| Asset | Hotspot(s) → semantic |
|---|---|
| Media unit (`ast-tv`) | **TV Screen** → video (the screen only, never the console) |
| Frame (`ast-framed-photo`) | **Photo** → gallery (inner image) |
| Floor lamp (`ast-floor-lamp`) | **Lamp shade** → ambience |
| Plant (`ast-side-plant`) | **Leaves** → animation (excludes the pot) |
| Avatar (`ast-avatar`) | **Avatar** → profile |
| Writing desk (`ast-desk`) | **Laptop** → website · **Notebook** → article · **Desk lamp** → ambience |
| Stacked books (`ast-stacked-books`) | **Books** → article |

> **Honesty note (desk):** the current `desk-v2` art shows a laptop, a notebook, and a
> small desk lamp — so those three genuine regions are defined. A **Microphone** and
> **Speaker** region (in the sprint's example) are intentionally **not invented**, since
> they are not in the current art; they are reserved for a future composite-desk asset
> state.

## Persistence

Hotspots + bindings persist through localStorage Save/Load, JSON Export/Import,
Undo/Redo, asset duplicate (ids regenerated deterministically for the new instance),
document reset, and parse/validation. Deleting an asset removes its hotspots; hiding an
asset excludes it (and its hotspots) entirely. Invalid imported hotspot data rejects the
document with a clear error. **No Supabase.**

## Validation & URL safety

Hotspot shapes are clamped inside the asset and to a minimum size; duplicate ids and
malformed bindings are rejected. URLs must parse as absolute links with a **safe
protocol** (`http`, `https`, `mailto`, `tel`); `javascript:`, `data:`, `vbscript:`, and
`file:` are rejected.

## Accessibility

Hotspots are real `<button>`s with `aria-label`s (keyboard focus + activation). Visible
regions are small but the hit target is the region; reduced-motion neutralizes the
hotspot pulse and asset effects.

## Workflows

- **Normal creator:** Connect → tap asset → tap region/chip → enter a link or pick an
  internal action → Save. No region drawing, no interaction ids, no JSON.
- **Internal author:** More → Advanced (in Connect) → add rectangle/ellipse, rename,
  choose semantic, lock/enable/disable, delete; drag on the canvas to move, corner
  handles to resize.

## Intentionally deferred

- **Focus Areas** and **Detail Scenes** (zoom into an asset) — not built.
- **Provider API integrations** (Spotify/YouTube SDKs) — plain links only for now.
- **Polygon hotspots** — rectangles and ellipses only in V1.

## Known limitations

- Small predefined regions (e.g. the desk laptop on a small desk box) are tight tap
  targets; the hit area equals the visible region (no invisible padding yet).
- Advanced hotspot drag math assumes an un-rotated asset; on a rotated asset the drag
  tracks approximately.
- Viewport zoom in the editor has no pan (carried from M7A).
