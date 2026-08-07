# NEXT SPRINT

> Read `CTO_HANDOFF.md` first. Two candidates below. **The founder chooses**, but if the
> Vercel block is still up, §A is the only one worth doing.

---

## §A — Finish the M26A acceptance (do this if Vercel is still blocked)

M26A's architecture is done and locally green. What is missing is *evidence that a creator
can actually complete the loop on a phone*. This is a short sprint and it needs no deploy.

### The gap, precisely

Driven and verified: selection, pinch to 5×, handle/toolbar physical size, the mode switch,
screen→scene round-trips, the stage.

**Not driven:** drag, resize, rotate, add-from-library at 5×, Save Draft, reopen — at any
viewport. And 390×844 / 430×932 were never opened at all.

### Why it stalled, and what to do differently

Synthetic `PointerEvent`s repeatedly triggered navigation away from the editor mid-run, and
the dev server intermittently renders the editor blank after several HMR cycles (restart it —
the hook-order warnings that accompany this are HMR artefacts, not real bugs).

Suggestions:
- Drive the editor from a **fresh dev server** and a fresh tab per viewport.
- Prefer `computer` (real clicks/drags in the browser pane) over synthetic
  `dispatchEvent` for the manipulation steps — synthetic pointers do not reproduce the
  editor's own selection-then-move sequence faithfully.
- Assert with `getBoundingClientRect()` on `[data-editor-object]` before and after each
  drag, not by eye.

### The run

At **375×667**, **390×844** and **430×932**:

1. Open Edit. 2. Select a small asset. 3. Pinch to 5×. 4. Drag the selected asset —
**only it moves**. 5. Drag empty floor — **only the camera pans**. 6. Resize it.
7. Rotate an object. 8. Add a new asset from the library while zoomed — it appears in the
visible area. 9. Reset view. 10. Geometry is unchanged. 11. Preview → test one interaction.
12. Back to Edit. 13. Save Draft. 14. Leave and reopen — geometry and interactions intact.

Capture three screenshots per viewport: **1×**, **5×**, **Preview**.

### Acceptance

- [ ] All three viewports complete all 14 steps.
- [ ] Handles and toolbar measured identical at 1× and 5× at every viewport.
- [ ] Object geometry byte-identical before zoom and after Reset.
- [ ] Nine screenshots attached.
- [ ] Gates green; commit; push.

---

## §B — M26B (only once §A passes AND the founder has tested on a phone)

The founder named M26B as parent-child placement: shelf slots, objects attaching to
surfaces, the Content/Appearance/Placement/Action inspector. **Do not start it speculatively.**
M26A deliberately left objects freely positioned so that M26B can introduce hierarchy against
a foundation that is known-good on a real device.

Prerequisites, all of them:
1. The Vercel block is cleared and the founder has tested `56aa6f3` (or later) on their phone.
2. §A passes at all three viewports.
3. The founder explicitly asks for M26B.

---

## Standing verification debt (needs a deployment, not a sprint)

These have been outstanding since M23B and cannot be closed locally:

- Two-account social testing (like, comment, follow, notification).
- Publish → visitor round-trip compared side by side.
- Views counted by a second account.
- Zoom smoothness frame-rate measured on a physical iPhone.

The moment a Preview URL responds, run these first — they are cheap and they close the
longest-standing gap in the project.

---

## Explicit non-goals

No new AI, asset-generation, avatar, Google/Apple auth, marketplace or discovery work. No
Village redesign. No analytics changes. No deletion of the legacy pre-pivot island (its own
sprint). No redesign of the Interaction inspector.
