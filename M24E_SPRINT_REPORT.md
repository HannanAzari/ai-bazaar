# M24E — Finish the Actual Interactive Nest Runtime

**Branch** `m12-nest-platform`
**Gates:** typecheck ✅ · eslint 0 errors ✅ · **948 tests / 97 files** ✅ · `next build` ✅ (133 pages)
**Verified in a real browser:** Focus opens and returns; a Surface tap plays the creator's
YouTube video — in **both** modes. Evidence in §6.

---

## 1. The trace, before any UI changed

The sprint's deterministic fixture (one main scene, one Focus region, two books inside it,
a TV with an image surface and a YouTube tap action) now lives in
[lib/fixtures/interactive-nest.ts](lib/fixtures/interactive-nest.ts). Every stage below was
checked against the code path and, for stages 5–7, against the **live database**.

| # | Stage | `focusAreas` | `detailScenes` | focus objects | surface defs | surface content | interaction type | payload / URL |
|---|---|---|---|---|---|---|---|---|
| 1 | Editor React state | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Editor bridge output | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Draft document (`draft_doc`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | Draft **reopened in the editor** | ❌ **C** | ❌ **C** | ❌ **C** | ✅ | ✅ | ✅ | ✅ |
| 5 | Saved / published Supabase row | ❌ **A** | ❌ **A** | ❌ **A** | ✅ | ✅ | ✅ | ✅ |
| 6 | Hydrated in Preview | ❌ **A** | ❌ **A** | ❌ **A** | ✅ | ✅ | ✅ | ✅ **D** |
| 7 | Hydrated in Home / visitor | ❌ **A** | ❌ **A** | ❌ **A** | ✅ | ✅ | ✅ | ✅ **D** |

Four independent causes, marked **A**–**D**. Note the pattern the table makes obvious: the
surface *data* was never the problem. It has round-tripped correctly since M23B.

### A — `nests.scene_extras` does not exist in the live database

The single largest cause. Live inspection of `srrmkdsvldlyllsxyhtq` (2026-08-05):

```
nests.draft_doc          EXISTS      nest_views          EXISTS
nests.draft_updated_at   EXISTS      nests.scene_extras  MISSING  ←
```

`m24b_provision.sql` was applied **before** M24C appended `scene_extras` to it. So the
founder correctly believes the migration was applied — and it was, the earlier version.
Every Focus region and every object inside one was discarded at the database boundary no
matter how correct the editor and the runtime were.

**Worse, it was silent.** D-30's "degrade, never break" was applied too broadly: the write
simply omitted the column, the save returned success, and the editor said *"Saved ✓"*.

**Fix:** [supabase/provision/m24e_provision.sql](supabase/provision/m24e_provision.sql)
(additive, idempotent), **and** D-37 — a write carrying Focus content is now refused
outright, naming the migration, instead of reporting a false success.

### B — the runtime never rendered hotspots at all

`nest_objects.interaction.hotspots` has carried the creator's regions *and their bindings*
since M23B; the live rows contain them. The runtime read only `placement.linkUrl`. So a TV
whose screen the creator had bound to a YouTube URL drew the assigned image and then
ignored every tap — *"Surface content renders, tapping does nothing"*, exactly.

**Fix:** `resolvePlacementHotspots()` in [lib/nest-scene.ts](lib/nest-scene.ts) plus the
typed contract in [lib/nest-interaction.ts](lib/nest-interaction.ts); the runtime renders
one real `<button>` per configured hotspot in the creator's own asset-local geometry.

### C — reopening a draft dropped its scene

[app/nest-editor/nest-editor-mount.tsx](app/nest-editor/nest-editor-mount.tsx) merged the
pending draft field by field — `title`, `backgroundId`, `placements` — and **not `scene`**.
Reopening a published Nest with unsaved work restored the *live* version's focus regions,
silently discarding every Focus region authored since the last publish. Saving then wrote
the loss back. Same shape as the M24C background-id bug: a document that should travel
whole, merged piecemeal.

### D — the crop came from the wrong rectangle

`NestFocusArea` carries two rectangles. `bounds` is the pre-M7C.4 legacy trigger box;
`focusBounds` is the V1 contract — the rectangle `focus-editor-overlay.tsx` actually lets
the creator drag. `resolveFocusRegions` read `bounds`, so even with the data present the
runtime framed a different region from the one the creator drew. It also matched child
scenes only by `targetSceneId`, missing every region linked through `childSceneId` — which
is what `ensureFocusChildScene` writes the moment a creator steps inside a region to place
something in it. **That is why the books were missing even in Preview.**

---

## 2. The canonical interaction schema

```ts
type NestInteraction =
  | { type: "open-url";     url: string;                    label?: string }
  | { type: "open-youtube"; url: string; videoId: string;   label?: string }
  | { type: "enter-focus";  focusId: string;                label?: string }
  | { type: "none" };
```

Resolved **only** from creator-authored data — `hotspot.binding`, `placement.linkUrl`, or a
Focus id. Never from an asset id or name (D-34). URLs are re-validated at render time, not
just at authoring time, because a document can reach the runtime from a legacy row or an
import our editor never checked; `javascript:`, `data:`, `vbscript:` and `file:` are
refused, and a YouTube id must be exactly 11 URL-safe characters before it reaches an
`<iframe src>`.

**Content and action are separate** (D-35): surfaces render `pointer-events-none`, the
hotspot is the tap target. A hotspot always beats a whole-object `linkUrl`, so a room never
becomes accidentally clickable underneath the region the creator drew.

---

## 3. One runtime

```tsx
<NestRuntime document={nestDocument} mode="editor-preview" | "visitor" | "card" />
```

`mode` decides **input and nothing else** — `const interactive = mode !== "card"`.
Composition, geometry and paint order are identical in all three, and a test asserts it.

- editor Preview → `mode="editor-preview"`
- full public Nest → `mode="visitor"`
- cards / grid / search → `mode="card"` via the `NestPreview` adapter, which now contains
  no rendering of its own

**Home stays `card`, deliberately.** In the feed the room *is* the "visit this Nest" tap
target (M24 §6); a hotspot inside it would steal that tap. It is the same component, and it
becomes fully interactive the moment the visitor opens the Nest.

---

## 4. Input handling

Verified in the browser at mobile 375×812, not assumed:

- Real `<button>` elements → keyboard activation and screen-reader semantics for free.
- `touch-action: manipulation` on every target (no 300ms tap delay).
- `onPointerUp` stops propagation so an ancestor drag/swipe handler cannot claim the tap.
- Decorative layers (`SceneSurround`, scrims, ambience, surface content) are all
  `pointer-events-none`.
- **Measured, not eyeballed:** `document.elementFromPoint` at the centre of each target
  returns the target itself. On the real `/nest/<slug>` page, a 5×5 probe grid across the
  room returns the room at all 25 points — no chrome intercepts anything.
- Target sizes at 375px wide: TV screen 90×52, Focus region 116×155 — both well over 44pt.

---

## 5. Files changed

**New**
- `lib/nest-interaction.ts` — the typed contract, URL/YouTube validation
- `components/nest/app-shell/nest-runtime.tsx` — the runtime
- `lib/fixtures/interactive-nest.ts` — the deterministic test Nest
- `app/dev/nest-runtime/` — the side-by-side bench
- `supabase/provision/m24e_provision.sql` — the migration
- `test/nest-interaction-runtime.test.ts` — 34 cases

**Changed**
- `lib/nest-scene.ts` — `focusBoundsOf` crop, `childSceneId` matching, hotspot resolution,
  camera delegates to the canonical `cinematicFocusTransformCss`
- `components/nest/app-shell/nest-preview.tsx` — now a passthrough adapter
- `components/nest/editor/nest-editor.tsx`, `app/nest/[slug]/visitor-client.tsx` — mount
  `NestRuntime` with an explicit mode
- `app/nest-editor/nest-editor-mount.tsx` — the draft's `scene` comes back
- `lib/nest/supabase-nest-repo.ts` — refuse rather than discard; removed a dead constant
  that interpolated a *function* into a column list
- `test/nest-scene-renderer.test.ts`, `test/nest-runtime-focus-surface.test.ts` — updated

## 6. Evidence

Reproduce at **`/dev/nest-runtime`** — Preview and visitor side by side on one document,
with the resolver output printed underneath.

| Check | Result |
|---|---|
| Document resolves | `focus-1 → scene-shelf · 2 object(s)`; `tv-1 · 1 surface · 1 hotspot → open-youtube` |
| Stage aspect, both modes | **0.750** |
| Tap the shelf | camera → `translate(-176.471%, -94.1176%) scale(2.94118)`, origin `0 0` (= 1/0.34) |
| Books in the focused view | **2** × `Stacked Books`, absent from the main scene |
| "Back to the room" | present; returns to `transform: (none)`, 0 books, **no reload** |
| Tap the TV screen | plays `youtube-nocookie.com/embed/aqz-KE-bpKQ`, dialog "Playing the film" |
| Same in editor-preview | identical player, identical dialog |
| Console errors | none |

## 7. Founder actions

1. **Apply [supabase/provision/m24e_provision.sql](supabase/provision/m24e_provision.sql).**
   Until then, saving a Nest that contains Focus regions is **refused with a clear
   message** — deliberately, so no work is lost. Everything else is unaffected.
2. **Clear the Vercel `402 DEPLOYMENT_DISABLED` block.** Still failing as of this commit.

## 8. Not verified — and why

The two-account acceptance walkthrough in the brief has **not** been run. It needs a
deployment (blocked) and the migration (blocked). What *is* proven is the full interaction
loop against the real components and the real catalogue art, in both modes, plus the live
schema state that explains every symptom. The moment both blockers clear, the walkthrough
in `NEXT_SPRINT.md` §4 is the acceptance script.
