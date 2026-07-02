// ── Nest editor layer model (M7C.5) ─────────────────────────────────────────
//
// A single documented z-index map for the editor canvas so authoring overlays NEVER
// render above the bottom drawer (the M7C.4 bug: the focus overlay at z-40 painted over
// the sheet at z-10). Use these named constants instead of ad-hoc/huge z values.
//
// Ordering (low → high), all within the editor canvas-area stacking context:
//   scene  <  assets  <  focusRegions  <  selectedFocus  <  contextualActions
//          <  drawerBackdrop  <  drawer  <  topToolbar
//
// The drawer (and its backdrop) sit ABOVE every authoring overlay, so the part of the
// canvas the sheet covers visually masks the overlays and intercepts their pointers.

export const EDITOR_LAYERS = {
  scene: 0,
  assets: 10,
  focusRegions: 20,
  selectedFocus: 25,
  contextualActions: 30,
  drawerBackdrop: 40,
  drawer: 50,
  topToolbar: 60,
} as const;

export type EditorLayer = keyof typeof EDITOR_LAYERS;
