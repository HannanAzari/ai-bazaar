// ── M23B — the one layering hierarchy ────────────────────────────────────────
//
// Before this file, stacking was decided per component: `z-20` here, `z-[60]` there,
// `z-[9999]` where someone lost an argument with a room asset. The founder screenshots
// show the result — the creator pill behind furniture, the bottom nav punching through
// a drawer, a modal backdrop under the engagement rail.
//
// Everything that stacks now names a layer from this list. The numbers are deliberately
// spaced so a future layer can be inserted without renumbering, and deliberately small:
// nothing in the app needs to be above `TOAST`.
//
//   room             the background plate
//   objects          placed assets (the artwork itself)
//   hotspots         interactive object targets, just above their asset
//   scrim            legibility gradients over the room
//   chrome           Nest identity pill + engagement rail + exit
//   nav              the app's bottom navigation
//   drawer           creator drawer / bottom sheets
//   modal            centred modals and their backdrop
//   toast            transient confirmations — always the last word
//   editor           the editor's own full-screen shell (see below)
//   player           the Nest media player (see below)
//
// Usage: `className={z.chrome}` for Tailwind, or `style={{ zIndex: LAYER.chrome }}`
// where a numeric value is needed (inline transforms, portals).
//
// ── M27B-3B — the last two layers, and why they are not 80 ───────────────────
//
// `toast` was described above as "always the last word", and for everything INSIDE a page
// it still is. The editor is not inside a page: it is a `fixed inset-0` shell that covers
// the app whole, and it carried a bare `z-[110]` that this file never knew about. So the
// documented hierarchy quietly stopped at the editor's front door.
//
// That was not theoretical. The media player portals to <body> at `modal`, and in the
// editor's Preview it rendered, laid out and hit-tested correctly while being painted over
// by the editor shell — visible in the DOM, invisible on screen. Found by measuring
// `elementsFromPoint`, not by reading the code.
//
// Both surfaces are named here rather than fixed with a local number, because the bug was
// never the value: it was that one of the two surfaces was not in the list. The player is
// above the editor because it is the one thing that must be reachable from every surface,
// the editor's Preview included.

export const LAYER = {
  room: 0,
  objects: 10,
  hotspots: 20,
  scrim: 30,
  chrome: 40,
  nav: 50,
  drawer: 60,
  modal: 70,
  toast: 80,
  /** The editor's full-screen shell. Everything the editor draws lives inside this. */
  editor: 110,
  /** The Nest media player. Portalled to <body>; must clear the editor shell. */
  player: 120,
} as const;

export type LayerName = keyof typeof LAYER;

/**
 * Tailwind classes for each layer. Written as complete literals (never
 * `` `z-[${n}]` ``) so Tailwind's scanner can actually see them.
 */
export const z: Record<LayerName, string> = {
  room: "z-0",
  objects: "z-10",
  hotspots: "z-20",
  scrim: "z-30",
  chrome: "z-40",
  nav: "z-50",
  drawer: "z-[60]",
  modal: "z-[70]",
  toast: "z-[80]",
  editor: "z-[110]",
  player: "z-[120]",
};

// ── Safe areas ───────────────────────────────────────────────────────────────
//
// iPhone Safari's bottom bar overlaps a `100dvh` layout, and the notch eats the top.
// These are the two paddings every full-bleed surface uses, so the fix is applied
// identically instead of being re-invented (or forgotten) per screen.

/** Top inset with a sensible minimum, for floating headers over a full-bleed room. */
export const safeTop = (min = "0.75rem") => `max(env(safe-area-inset-top), ${min})`;

/** Bottom inset with a sensible minimum, for anything anchored to the bottom edge. */
export const safeBottom = (min = "1.25rem") => `max(env(safe-area-inset-bottom), ${min})`;

/**
 * Clearance for the app's bottom navigation, including its own safe-area padding. The
 * nav is ~3.5rem tall, plus the raised centre Create button; 4.75rem clears both.
 *
 * Full-bleed surfaces that sit *inside* the app shell reserve this so their controls are
 * never hidden behind the nav — identically on a 375px iPhone SE, a 390px 14, and a
 * 430px Pro Max, because it is one constant rather than a number re-guessed per screen.
 */
export const BOTTOM_NAV_CLEARANCE = "calc(4.75rem + env(safe-area-inset-bottom))";
