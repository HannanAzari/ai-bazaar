// ── M28.1 §2 — where a photo sits inside an aperture ─────────────────────────
//
// THE PROBLEM THIS FIXES.
//
// The aperture is drawn `object-fit: cover` (M27B-1), which is right — a photograph must
// reach the edges of its mount rather than sit letterboxed inside the moulding. But cover
// centres what it keeps, so a phone photo in a landscape frame loses the top and bottom of
// the subject, and the creator has no way to say "this part".
//
// So each image content item may carry a focal point and a zoom. Absent ⇒ nothing changes,
// which is what keeps every photo published before this sprint rendering exactly as it did.
//
// ── WHY THE MODEL IS CSS-ONLY ────────────────────────────────────────────────
//
// The runtime cannot measure a photo before drawing it. A visitor Nest renders on first
// paint, and an approach that needed the image's natural dimensions would have to wait for
// `onLoad`, in every surface, and would show an unpositioned frame until it arrived — a
// visible flash of the wrong crop on the feed. `object-fit: cover` already does the
// containment maths in the browser without anyone knowing the pixel size, and
// `object-position` + `transform` steer it. Both are pure style, so the same three numbers
// produce the same picture in the editor, in Preview, on a Home card and for a visitor,
// with no per-surface logic and no measurement anywhere. That is §4.
//
// The cropper DOES measure — it has the loaded image in front of the creator — which is why
// `panCrop` takes a natural size and `mediaCropStyle` does not.
//
// Pure: no React, no DOM.

/**
 * Where the photo sits in its aperture.
 *
 * `x`/`y` are a normalised focal position in 0..1 with CSS `object-position` semantics: the
 * point at fraction x across the IMAGE is placed at fraction x across the APERTURE. So 0.5
 * is centred (the legacy behaviour), 0 pins the left/top edge and 1 the right/bottom.
 *
 * `zoom` is relative to "just covers", never below 1 — below 1 the image would stop
 * covering and the mount would show through, which is a broken frame, not a crop.
 */
export type MediaCrop = { x: number; y: number; zoom: number };

/** Centred, unzoomed — identical to what an aperture with no crop has always drawn. */
export const DEFAULT_CROP: MediaCrop = { x: 0.5, y: 0.5, zoom: 1 };

/**
 * The ceiling on zoom.
 *
 * 4× of "just covers" is already well past the point where a phone photo turns to mush in a
 * frame a few hundred pixels wide. The cap exists so a runaway pinch cannot leave a creator
 * looking at four grey pixels with no obvious way back other than Reset.
 */
export const MAX_CROP_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * A stored crop made safe to render.
 *
 * Stored documents are jsonb a creator's browser wrote; a NaN, a string or a zoom of 0 must
 * clamp to something drawable rather than produce `transform: scale(NaN)` and a blank frame.
 * The clamp is also the covering invariant — see `mediaCropStyle`.
 */
export function normaliseCrop(crop: Partial<MediaCrop> | null | undefined): MediaCrop {
  if (!crop) return DEFAULT_CROP;
  return {
    x: clamp(finite(crop.x, DEFAULT_CROP.x), 0, 1),
    y: clamp(finite(crop.y, DEFAULT_CROP.y), 0, 1),
    zoom: clamp(finite(crop.zoom, DEFAULT_CROP.zoom), 1, MAX_CROP_ZOOM),
  };
}

/** Is this the same picture cover would have drawn on its own? */
export function isDefaultCrop(crop: Partial<MediaCrop> | null | undefined): boolean {
  const c = normaliseCrop(crop);
  return c.x === DEFAULT_CROP.x && c.y === DEFAULT_CROP.y && c.zoom === DEFAULT_CROP.zoom;
}

/** The style for an `object-fit: cover` image, or `{}` when there is nothing to say. */
export type MediaCropStyle = {
  objectPosition?: string;
  transform?: string;
  transformOrigin?: string;
};

/**
 * The CSS that puts a photo where the creator put it.
 *
 * THE COVERING INVARIANT. With `object-position: p` the content's left edge sits at
 * `-x · (coverWidth − apertureWidth)`; scaling by `z` about the SAME point moves it to
 * `-x · (z · coverWidth − apertureWidth)`. Both ends are therefore linear in `x`, and at
 * `x = 0` the left edge is flush while at `x = 1` the right edge is — so for any
 * `x, y ∈ [0,1]` and `z ≥ 1` the aperture is still completely covered. No combination of
 * clamped values can produce an empty gutter, which is why `normaliseCrop`'s clamp is the
 * whole safety argument and there is no separate validity check anywhere.
 *
 * Sharing `object-position` and `transform-origin` is also what makes a pinch feel right:
 * the anchored point of the photograph does not move while the zoom changes around it.
 *
 * Returns `{}` for an absent crop so an untouched photo's DOM is byte-identical to what it
 * was before this sprint — `object-position: 50% 50%` is the CSS default, but not writing
 * it at all is a stronger guarantee than writing something equivalent.
 */
export function mediaCropStyle(crop: Partial<MediaCrop> | null | undefined): MediaCropStyle {
  if (!crop) return {};
  const c = normaliseCrop(crop);
  const position = `${round(c.x * 100)}% ${round(c.y * 100)}%`;
  if (c.zoom === 1) return { objectPosition: position };
  return { objectPosition: position, transform: `scale(${round(c.zoom)})`, transformOrigin: position };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export type Size = { width: number; height: number };

/**
 * How big the photo is once `cover` has sized it to the aperture, before zoom.
 *
 * This is the browser's own rule, restated so the cropper can predict it: scale by whichever
 * axis needs the most, so neither axis falls short.
 */
export function coverSize(natural: Size, box: Size): Size {
  if (natural.width <= 0 || natural.height <= 0 || box.width <= 0 || box.height <= 0) {
    return { width: box.width, height: box.height };
  }
  const scale = Math.max(box.width / natural.width, box.height / natural.height);
  return { width: natural.width * scale, height: natural.height * scale };
}

/**
 * How many pixels of photo hang outside the aperture on each axis, at this zoom.
 *
 * Zero means that axis is pinned: an aperture the same shape as the photo has nothing to
 * slide at 1×, and dragging it must do nothing rather than drift.
 */
export function cropSlack(crop: MediaCrop, natural: Size, box: Size): Size {
  const cover = coverSize(natural, box);
  return {
    width: Math.max(0, cover.width * crop.zoom - box.width),
    height: Math.max(0, cover.height * crop.zoom - box.height),
  };
}

/**
 * Drag the photo under a fixed aperture: `dx`/`dy` are the finger's travel in px.
 *
 * Moving the photo RIGHT reveals more of its left side, which is a SMALLER `x` — the sign
 * flip is the whole reason this is a function and not an inline subtraction at the call
 * site. Travel is divided by the slack, so the same swipe moves a barely-overflowing photo
 * a little and a deeply zoomed one a lot; the photo tracks the finger either way.
 */
export function panCrop(crop: MediaCrop, dx: number, dy: number, natural: Size, box: Size): MediaCrop {
  const c = normaliseCrop(crop);
  const slack = cropSlack(c, natural, box);
  return {
    ...c,
    x: slack.width > 0 ? clamp(c.x - dx / slack.width, 0, 1) : c.x,
    y: slack.height > 0 ? clamp(c.y - dy / slack.height, 0, 1) : c.y,
  };
}

/** Pinch: multiply the zoom, keeping the focal point where it is. */
export function zoomCrop(crop: MediaCrop, factor: number): MediaCrop {
  const c = normaliseCrop(crop);
  const f = finite(factor, 1);
  return { ...c, zoom: clamp(c.zoom * (f > 0 ? f : 1), 1, MAX_CROP_ZOOM) };
}

/**
 * The real shape of an object's aperture, as a width/height ratio.
 *
 * The cropper must show the creator the frame they are actually filling, and that shape is
 * the product of three things: the scene's own 3:4, the object's box within it, and the
 * aperture's box within the object. Getting this wrong would show a square cropper for a
 * landscape frame and the creator would place the subject confidently in the wrong spot.
 *
 * `sceneAspect` is width/height of the scene — 3/4, and passed rather than imported so this
 * module stays free of the render layer.
 */
export function apertureAspectRatio(
  object: { width: number; height: number },
  bounds: { width: number; height: number },
  sceneAspect = 3 / 4,
): number {
  const w = object.width * bounds.width * sceneAspect;
  const h = object.height * bounds.height;
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w / h)) return 1;
  return w / h;
}
