# M26A — Nest Stage + Rooms-Style Editor Foundation

**Branch** `m12-nest-platform` · **Commits** `0ade25a` → `373e738` → `56aa6f3`
**Gates at `56aa6f3`:** typecheck ✅ · eslint 0 errors ✅ · **1156 tests / 101 files** ✅ · `next build` ✅ (133 pages)
**Deployed:** ❌ — see §1. Not claimed.

---

## 1. The Vercel question, settled

This ran for seven sprints on a wrong assumption. The evidence, gathered directly:

| URL | Result |
|---|---|
| `hannanazaris-projects.vercel.app` | **404** `DEPLOYMENT_NOT_FOUND` |
| `ai-bazaar-git-m12-nest-platform-hannanazaris-projects.vercel.app` | **410** `GONE` — "The deployment has been removed" |
| `ai-bazaar-git-main-hannanazaris-projects.vercel.app` | 404 |
| `ai-bazaar.vercel.app` | **402** `DEPLOYMENT_DISABLED` |

**There is ONE project — `ai-bazaar`, team `hannanazaris-projects` — and it is disabled.**

- The bare team host is a **scope suffix**, not an app URL. Nothing is ever served there.
- The **410** is the decisive one. That hostname pattern is correct, a deployment for this
  branch *did* exist, and Vercel has since **removed** it — which is what happens to preview
  deployments when a project is disabled.

So both prior statements were true at once: the founder really was testing a real
deployment, and it really has not been reachable since.

**My error:** earlier probes used the team slug `hannans-projects`, which 404s and hid the
410 that would have revealed the project existed. That cost several sprints of wrong framing
and is worth remembering: *a 404 on a guessed Vercel hostname proves nothing.*

**What an agent cannot do here:** there is no `.vercel/project.json`, no linked CLI and no
token in this repo, so deployment hashes cannot be enumerated and a deploy cannot be
triggered.

**`/api/build-info`** now answers "which build am I looking at?" from the phone:

```json
{ "commit": "…", "commitShort": "…", "branch": "…", "vercelProject": "…",
  "vercelEnv": "…", "deploymentUrl": "…", "supabaseProjectRef": "…",
  "supabaseConfiguredAtBuild": true }
```

No secrets — only the Supabase project *ref*, never key material.

---

## 2. NestStage architecture

```
<NestStage>                     app environment — NOT in the Nest document
  <NestViewport>                the clipping box; the camera attaches here
    <camera stage>              the canonical 3:4 scene, transformed
      <Background /> <Objects />
  <ScreenSpaceChrome>           never a descendant of the transform
```

One deep neutral stage with **exactly two variants** (`dark` / `light`), chosen explicitly.

The previous surround derived a hue from the background id, so every Nest sat on a different
colour — green behind one room, beige behind another, near-black behind a third. That is
what read as unrelated bands. A gallery does not repaint its walls per painting.

Because the Stage is not in the document, it can be redesigned without touching a single
published Nest. No blurred duplicate, no stretched room, no crop: object geometry is
untouched.

**Verified:** the visitor page at 375×812 shows one uniform `#141317` surround above and
below the room; the stage colour is byte-identical across `bg-creator-loft`,
`bg-minimal-zen` and `bg-gamer-cave`; viewport aspect stays **0.750**.

---

## 3. Gesture-dispatch architecture

`lib/nest-gesture.ts` — pure, no React, no DOM types.

```
two pointers      → camera-pinch      (wherever they land)
resize handle     → object-resize
rotate handle     → object-rotate
selected object   → object-move
another object    → select
empty + zoomed    → camera-pan
empty at 1×       → none
```

Assigned once at pointer-down, stored in `ownerRef`, and every move gated on it
(`if (!gestureAllows(owner, wanted)) return`). The only escalation is a second finger
becoming a pinch, which **abandons the object exactly where it is** — not resized, not
rotated, not snapped back.

### Root cause — the camera stealing object drags

The editor canvas and the camera hook were **two independent listeners on the same bubbling
events**, each deciding on every move. Worse, the camera's pan filter asked only *"is this
inside `[data-editor-object]`?"* — and resize/rotation handles render **outside** the object
element, because they belong to the selection frame. So every handle drag passed the filter
and panned the room instead of resizing.

### The deleted gesture

The object `pinch` gesture is **gone**. It used to resize *and* rotate the selected object
from two fingers, so pinching to look closer silently rewrote the creator's geometry — the
worst class of bug in this project: a destructive edit the creator never asked for and
cannot see.

---

## 4. Screen space vs world space

**World space** (inside the camera transform): background, objects, stickers, text, object
hit areas.

**Screen space** (sibling of the viewport, never a descendant):
`components/nest/editor/screen-space-selection.tsx` — selection frame, resize handles,
rotation handle, object toolbar; plus Reset view, the instructional banner and the editor
tabs.

The frame carries **no transform of any kind**. Its position and size are written in screen
pixels from `sceneToScreen()` on every camera frame, inside the camera's own rAF, straight
to the DOM — so it tracks the object pixel-for-pixel while zooming and panning without a
single React render. Handles carry constant pixel dimensions. An object panned entirely out
of view hides its controls rather than leaving them floating.

### Root cause — controls scaling with the room

The selection frame rendered inside the element the camera transforms. At 5× a 40px touch
target became 200px and a 14px dot became 70px — the handles covered the object they were
resizing. They were also clipped by the scene's `overflow-hidden`, so a handle on an object
near the edge simply vanished.

### A bug I introduced, and caught by measuring

M26A's first pass counter-scaled chrome with `--nest-inv-scale`. When the frame later became
real screen space, the **toolbar's counter-scale became a double negative** and shrank it —
measured **40×9px at 5×** where it should have been 198×46. It is now a child of the frame,
inheriting screen-pixel positioning, with no transform. Reading the code would not have
found this.

---

## 5. Screen ⇄ scene

One conversion, in `lib/nest-camera.ts`, used by movement, resize, rotation, new-asset
placement and sticker/text placement:

```
screenToScene       client point   → canonical 0..1
sceneToScreen       canonical      → client point
screenDeltaToScene  drag delta     → scene delta   (shrinks as you zoom in)
visibleSceneRect    what the creator can currently see
visibleSceneCentre  where a new asset goes
```

Round-trip is exact at 1×, 2× and 5×. A 50px drag at 1×, 100px at 2× and 250px at 5× all
land the object at the same canonical coordinate. Rotation is an angle, so it has no scale
term at all.

**The camera never reaches storage.** No camera value appears in a placement, a draft or a
published document — asserted by test.

---

## 6. Edit | Preview

One `ModeSwitch`, rendered in **both** modes, in the top toolbar. The duplicate Preview
entry is gone from the bottom bar — two controls for one state is how a creator ends up
unsure which mode they are in.

Preview mounts the real visitor runtime (`<NestRuntime mode="editor-preview">`) from the
same canonical document. Switching saves nothing, publishes nothing, touches no geometry,
and creates no second renderer.

---

## 7. Adding assets while zoomed

`visibleSceneCentre(camera, viewport, base)` → `addObject(doc, asset, at)` centres the new
object there. A creator zoomed onto a shelf gets the book on the shelf, not at the centre of
the unzoomed room (off-screen, which reads as "nothing happened"). The camera is not reset,
and the new object is selected immediately.

---

## 8. Measured results

Editor, object selected, 14 wheel steps to 5×:

| | 1× | 5× |
|---|---|---|
| scene width (714×863) | 670px | 3350px (**5.00×**) |
| resize handle | 40×40 | **40×40** |
| object toolbar | 198×46 | **198×46** |
| scene width (375×667) | 345px | 1723px (**4.99×**) |
| resize handle | 40×40 | **40×40** |

Selection frame confirmed **outside** `.will-change-transform`. Reset view appears only once
zoomed. Mode switch present in both modes. No console errors.

Screenshots captured at 375×667: 1× showing the Edit|Preview switch, the bottom bar without
a duplicate Preview, and the selection frame with four handles; 5× showing the room zoomed
to individual books with every piece of chrome at unchanged size.

---

## 9. Files

**New** — `components/nest/nest-stage.tsx`, `components/nest/editor/screen-space-selection.tsx`,
`lib/nest-gesture.ts`, `app/api/build-info/route.ts`,
`test/nest-stage-gestures.test.ts`, `test/nest-editor-dispatch.test.ts`.

**Changed** — `lib/nest-camera.ts` (screen⇄scene + `resolveTapTarget`), `lib/nest-editor.ts`
(`addObject(…, at)`), `components/nest/app-shell/use-scene-camera.ts` (`subscribe`,
`canPanFrom`), `components/nest/app-shell/nest-runtime.tsx` (mounts `NestStage`),
`components/nest/editor/editor-canvas.tsx` (dispatcher + screen-space layer),
`components/nest/editor/nest-editor.tsx` (`ModeSwitch`), `app/globals.css`, three test files
updated for changed-but-correct behaviour.

**Decisions** — D-51…D-58.

---

## 10. NOT done — stated plainly

- **Mobile acceptance at 390×844 and 430×932 was not run.** Only 375×667 and 714×863.
  Synthetic pointer events repeatedly triggered navigation away from the editor.
- **The 17-step flow was not completed at any viewport.** Verified by driving: selection,
  zoom, handle/toolbar sizing, mode switch. *Not* verified by driving: drag, resize, rotate,
  add-from-library at 5×, Save Draft, reopen.
- **No Preview screenshot.**
- **Adding an asset while zoomed** is covered by unit tests through the real `addObject`
  path and the wired `visibleCentre` call — but not driven through the actual asset library
  UI.
- **Deployment.** Unchanged; see §1.

The dispatcher and the screen-space chrome are the parts to trust. The end-to-end creator
flow at three viewports is what remains owed.
