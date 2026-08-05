# M25 — Nest Interaction Runtime + Free Zoom System

**Branch** `m12-nest-platform`
**Gates:** typecheck ✅ · eslint 0 errors ✅ · **1030 tests / 98 files** ✅ · `next build` ✅ (133 pages)
**Deployed:** ❌ — Vercel still returns `402 DEPLOYMENT_DISABLED`. Not claimed. See §11.

---

## 1. Zoom architecture

Two files, one rule: **the camera is a viewport transform and never touches object geometry.**

**`lib/nest-camera.ts`** — pure, no React, no DOM. Clamping (1×–5×), focal-point pinch, pan
bounds, double-tap, tap-vs-drag classification, overlap resolution, and a source-resolution
warning. Everything is a function of `(camera, input, viewport)`, so it is unit-testable
without a browser and callable from a ref loop.

**`components/nest/app-shell/use-scene-camera.ts`** — the gesture layer. Pointer events →
camera → `stage.style.transform` inside a `requestAnimationFrame`. **The scene subtree does
not re-render while a finger is down** (D-43). React learns the camera moved only when the
gesture ends, and only so the Reset control can appear.

| Requirement | How |
|---|---|
| 1 → ~5× | `clampScale`, hard-clamped; verified live clamping at exactly 5 |
| pinch around the fingers | `zoomAround` keeps the focal pixel fixed; unit-tested by mapping the point back |
| one-finger pan **only while zoomed** | at 1× the offset is pinned to 0, so a drag on an unzoomed room stays a page gesture and the feed still scrolls |
| bounds | `clampOffset` allows exactly the overflow — an edge can reach the viewport edge, never past |
| double tap | 2× around the point; again → 1× |
| no page scroll / no Safari gesture conflict | `touch-action: none` on the viewport, `passive: false` listeners, `gesturestart`/`gesturechange` swallowed |
| no accidental activation while panning | interaction fires only from a gesture `isTap` classifies — max travel ≤ 10px, ≤ 500ms |
| honest sharpness | `resolutionWarning` reports the real limit in development. **No filter hides softness** — the fix is larger source art |

The stage stays the canonical 3:4 box at every scale, so object geometry is untouched and
Editor/Preview/visitor parity is preserved by construction.

## 2. Interaction architecture

**`lib/nest-asset-interaction.ts`** — a typed capability model:

```ts
type InteractionCapability =
  | "toggle" | "open-close" | "play-pause" | "screen" | "media" | "external-link" | "gallery";
```

The split that makes it safe: **capability comes from the catalogue, configuration comes
from the creator** (D-34, still in force). The catalogue says a TV can be on or off and
carries a screen; the creator's document says *this* TV starts off and plays *that* URL.
Nothing is inferred from an asset id.

A tap returns both a state change and an optional content action, because a TV does both at
once — turning on *and* opening what it is connected to. Turning something **off** never
reopens its media; that would reopen a modal the visitor just dismissed by switching the
object off.

`AssetInteractionConfig` rides in the **existing** `nest_objects.interaction` jsonb bag.

**Implemented and shipped:** TV (off/on + YouTube/website/image), laptop-on-desk
(closed/open + website), lamp (off/on, local glow, no URL possible), books (closed/open +
link), framed photo (gallery).

**Declared and unit-tested but NOT shippable: speaker, console, curtain, standalone laptop
— there is no art for them in the library.** They are in `AWAITING_ART` with a full
capability definition so the Asset Factory has a contract to build against. Putting a
placeholder box in the benchmark and calling it a speaker would be the kind of claim this
project has spent five sprints removing.

## 3. Legacy Focus compatibility

Nothing is destroyed. Specifically:

- `nests.scene_extras` is **untouched** — no column dropped, no migration reversed.
- `resolveFocusRegions` is still called by the runtime; legacy regions still open, still
  render their child objects at exact geometry, and still offer "Back to the room".
- The legacy focus camera is applied *inside* the free camera, so an old Nest's focus works
  even while zoomed.
- Focus regions now render as **invisible targets** rather than badged rectangles (D-41).
- `nestDocumentToEditable` still restores `focusAreas`/`detailScenes`, so an old Nest
  reopened in the editor keeps them.
- What is gone is **authoring**: Focus and Surface are off the toolbar (D-44). No new Nest
  needs one.

`LEGACY_FOCUS_NEST` in `lib/fixtures/interactive-nest.ts` keeps this path permanently
tested, and the dev bench has a toggle to view it.

## 4. Schema

**No migration is required, and none is provided.**

`nest_objects.interaction` is jsonb, already exists, and was verified lossless in M24E. The
M25 config is one more key in that bag. Rather than assert that, the test suite round-trips
the entire benchmark Nest — every geometry field, overlay, z-index and interaction config —
through `JSON.parse(JSON.stringify(...))` and back through the editor bridge.

The M24E guard still stands: if a document carries Focus regions and `scene_extras` is
missing, the save is **refused with a truthful message**, never silently dropped (D-37).

## 5. Files changed

**New** — `lib/nest-camera.ts`, `components/nest/app-shell/use-scene-camera.ts`,
`lib/nest-asset-interaction.ts`, `components/nest/editor/interaction-panel.tsx`,
`test/nest-zoom-interaction.test.ts`.

**Rewritten** — `components/nest/app-shell/nest-runtime.tsx`,
`lib/fixtures/interactive-nest.ts`, `app/dev/nest-runtime/nest-runtime-bench.tsx`.

**Changed** — `lib/nest-document-types.ts` + `lib/nest-editor-types.ts` +
`lib/nest-editor-bridge.ts` (the config round-trips), `components/nest/editor/nest-editor.tsx`
(one Interaction button), `app/globals.css` (the Hint pulse), two test files updated for
changed-but-correct behaviour.

## 6. Three bugs found by measuring, not by reading

Recorded because each would have shipped as "smooth zoom" and quietly not been.

1. **The camera froze after one gesture.** `setZoomed` re-rendered the host → the listener
   effect re-ran → its cleanup cancelled the pending rAF **and left `frame.current`
   non-null**, so `paint()` early-returned forever. Fixed by moving cancellation to an
   unmount-only effect and making the listener effect depend on nothing that changes per
   render.
2. **An unguarded `releasePointerCapture` swallowed taps.** It throws `NotFoundError` when
   the pointer is already gone, aborting the handler *before* tap classification. Both
   capture calls are now guarded — capture is an optimisation, the gesture must survive
   without it.
3. **The minimum touch target extended nothing.** It was `pointer-events-none`, so a 10px
   book stayed a 10px target. Now hittable, and paint order makes the higher-z object win.

## 7. Verification (measured in a real browser)

At the bench (`/dev/nest-runtime`) and on a real `/nest/<slug>` page.

| Check | Result |
|---|---|
| Tap targets | 6 interactive objects; scenery (sofa, table, shelf, plant, overlays) has none |
| Permanent icons in the scene | **1 SVG total** — the Hint button, outside the stage |
| Zoom clamp | 12 wheel steps → exactly `scale 5`; 80 more → still 5 |
| Pan bounds at 5× | `tx 732 ≤ max 836`, `ty 1114 ≤ max 1115` |
| Reset | returns to `{scale 1, tx 0, ty 0}`; control only visible when zoomed |
| Lamp | no glow → tap → glow present, no modal, no link |
| TV | tap → `youtube-nocookie.com/embed/aqz-KE-bpKQ`, room visible behind |
| TV again | turns off, does **not** reopen the video |
| Plant | not a target at all |
| Media + camera | zoom to 5× → open → close → camera restored to `{5, 236, 518}` exactly |
| Hint | pulses exactly the 6 interactive objects, 0 scenery, then clears |
| Mobile 375px | stage 341×455 at aspect 0.750; tiny books measure **12×11** and **10×10** and every target resolves to itself |
| Overlapping tiny books | a tap at book-a's centre opens **book-a's** link ("my diary"), not book-b's |
| Real visitor page | free zoom reaches 5×, Reset appears, aspect 0.750 |

Console: the only errors in the buffer are two React hot-reload hook-order warnings from
mid-session editing (hook #22 `useCallback` → `useRef`, exactly the ref refactor above).
They do not recur on a fresh module and the runtime demonstrably works after them.

## 8. Performance

Measured structurally rather than asserted: the transform never passes through React state,
the listener effect attaches once, and `NestRuntime` is memoised. What was **not** done:
no instrumented frame-rate measurement on a physical iPhone. Safari-specific smoothness is
therefore *unverified* — it needs a deployment, which is blocked.

## 9. Surround (§P8)

The four options were compared. **Kept: near-black room-derived tint + gradient + warm glow
+ vignette** (options 1 and 3 combined — the D-33 treatment). Reasons the others were
rejected: the *extended background* needs per-room art that does not exist; the *full-width
crop at 1×* changes what a visitor sees relative to the editor and would break the parity
this programme exists to protect; a *blurred duplicate* is the banding artefact M24D
already removed. The bench has a three-background switcher so this can be judged directly
rather than from a screenshot I chose.

## 10. Not done — stated plainly

- **The manual two-account acceptance run.** Blocked on deployment.
- **Speaker / console / curtain** — no art (§2).
- **Momentum panning** — deliberately omitted; uncontrolled inertia on a 3:4 stage felt
  worse than none, and the brief says "only if it feels controlled".
- **Editor canvas zoom/pan while arranging** (§Editor behaviour). The *Preview* inside the
  editor is the full runtime and zooms, and the Interaction panel is in place — but the
  arrange canvas itself still has no camera. This is the largest single gap in the sprint.
- **iPhone frame-rate measurement** (§8).

## 11. Founder actions

1. **Clear the Vercel `402 DEPLOYMENT_DISABLED` block** — still failing at this commit. No
   Preview URL is claimed.
2. Then run the manual acceptance list; `/dev/nest-runtime` reproduces the interaction model
   without needing an account.
