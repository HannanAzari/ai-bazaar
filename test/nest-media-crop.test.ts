import { describe, expect, it } from "vitest";
import {
  DEFAULT_CROP,
  MAX_CROP_ZOOM,
  apertureAspectRatio,
  coverSize,
  cropSlack,
  isDefaultCrop,
  mediaCropStyle,
  normaliseCrop,
  panCrop,
  zoomCrop,
} from "@/lib/nest-media-crop";

// M28.1 §2 — the crop model. These are the guarantees the three render surfaces and the
// cropper all lean on; none of them re-derives any of this.

describe("normaliseCrop", () => {
  it("defaults to centred and unzoomed when there is no crop", () => {
    expect(normaliseCrop(undefined)).toEqual(DEFAULT_CROP);
    expect(normaliseCrop(null)).toEqual(DEFAULT_CROP);
  });

  it("clamps a focal point into the aperture", () => {
    expect(normaliseCrop({ x: -3, y: 9, zoom: 1 })).toEqual({ x: 0, y: 1, zoom: 1 });
  });

  it("never lets zoom fall below 1 — the photo must keep covering the mount", () => {
    expect(normaliseCrop({ x: 0.5, y: 0.5, zoom: 0 }).zoom).toBe(1);
    expect(normaliseCrop({ x: 0.5, y: 0.5, zoom: -4 }).zoom).toBe(1);
  });

  it("caps zoom", () => {
    expect(normaliseCrop({ x: 0.5, y: 0.5, zoom: 99 }).zoom).toBe(MAX_CROP_ZOOM);
  });

  it("survives the junk a stored jsonb document can carry", () => {
    // A hand-edited or half-written document must never reach the DOM as `scale(NaN)` and
    // blank the frame. Note the rule: a value that is not a finite number carries no
    // information, so it falls back to the DEFAULT rather than being clamped to an
    // extreme — Infinity means "unknown", not "as far in as possible".
    const junk = { x: Number.NaN, y: "0.8", zoom: Number.POSITIVE_INFINITY } as unknown as { x: number; y: number; zoom: number };
    expect(normaliseCrop(junk)).toEqual(DEFAULT_CROP);
  });
});

describe("mediaCropStyle — legacy parity", () => {
  it("says NOTHING for a photo that was never adjusted", () => {
    // The whole legacy guarantee: no crop ⇒ no style ⇒ byte-identical markup to pre-M28.1.
    expect(mediaCropStyle(undefined)).toEqual({});
    expect(mediaCropStyle(null)).toEqual({});
  });

  it("writes only object-position while the zoom is 1", () => {
    expect(mediaCropStyle({ x: 0.25, y: 0.75, zoom: 1 })).toEqual({ objectPosition: "25% 75%" });
  });

  it("anchors the transform on the same point it positions", () => {
    // Sharing the point is what keeps the photo still under a pinch.
    const style = mediaCropStyle({ x: 0.2, y: 0.4, zoom: 2 });
    expect(style.objectPosition).toBe("20% 40%");
    expect(style.transformOrigin).toBe(style.objectPosition);
    expect(style.transform).toBe("scale(2)");
  });

  it("clamps before it renders, so a broken document still draws", () => {
    expect(mediaCropStyle({ x: 5, y: -5, zoom: 1 })).toEqual({ objectPosition: "100% 0%" });
  });
});

describe("coverSize / cropSlack", () => {
  const box = { width: 300, height: 400 }; // a portrait aperture

  it("scales by the axis that needs the most, so neither falls short", () => {
    // A landscape photo into a portrait aperture: height binds.
    expect(coverSize({ width: 1000, height: 500 }, box)).toEqual({ width: 800, height: 400 });
  });

  it("reports no slack on the bound axis at 1x", () => {
    const slack = cropSlack({ x: 0.5, y: 0.5, zoom: 1 }, { width: 1000, height: 500 }, box);
    expect(slack.height).toBe(0);   // pinned — cover made it exactly 400 tall
    expect(slack.width).toBe(500);  // 800 wide in a 300 box
  });

  it("zoom creates slack on both axes", () => {
    const slack = cropSlack({ x: 0.5, y: 0.5, zoom: 2 }, { width: 1000, height: 500 }, box);
    expect(slack.width).toBe(1300);
    expect(slack.height).toBe(400);
  });
});

describe("panCrop", () => {
  const box = { width: 300, height: 400 };
  const landscape = { width: 1000, height: 500 };

  it("moves the photo the way the finger went", () => {
    // Dragging RIGHT reveals more of the photo's left side, which is a SMALLER x.
    const moved = panCrop({ x: 0.5, y: 0.5, zoom: 1 }, 50, 0, landscape, box);
    expect(moved.x).toBeCloseTo(0.4, 5); // 50px of 500px slack
  });

  it("does nothing on an axis with no slack", () => {
    // The photo already fits exactly on this axis; dragging must not drift it into a gutter.
    const moved = panCrop({ x: 0.5, y: 0.5, zoom: 1 }, 0, 80, landscape, box);
    expect(moved.y).toBe(0.5);
  });

  it("clamps at the edges rather than running off", () => {
    const far = panCrop({ x: 0.5, y: 0.5, zoom: 1 }, 100000, 0, landscape, box);
    expect(far.x).toBe(0);
    const other = panCrop({ x: 0.5, y: 0.5, zoom: 1 }, -100000, 0, landscape, box);
    expect(other.x).toBe(1);
  });

  it("is more sensitive the further in you are zoomed", () => {
    const at1 = panCrop({ x: 0.5, y: 0.5, zoom: 1 }, 50, 0, landscape, box);
    const at3 = panCrop({ x: 0.5, y: 0.5, zoom: 3 }, 50, 0, landscape, box);
    // Same finger travel, less normalised movement — because the photo is bigger.
    expect(Math.abs(0.5 - at3.x)).toBeLessThan(Math.abs(0.5 - at1.x));
  });

  it("keeps the zoom it was given", () => {
    expect(panCrop({ x: 0.5, y: 0.5, zoom: 2.5 }, 10, 10, landscape, box).zoom).toBe(2.5);
  });
});

describe("zoomCrop", () => {
  it("multiplies and clamps", () => {
    expect(zoomCrop({ x: 0.5, y: 0.5, zoom: 1 }, 2).zoom).toBe(2);
    expect(zoomCrop({ x: 0.5, y: 0.5, zoom: 1 }, 0.5).zoom).toBe(1);
    expect(zoomCrop({ x: 0.5, y: 0.5, zoom: 3 }, 10).zoom).toBe(MAX_CROP_ZOOM);
  });

  it("leaves the focal point alone — a pinch zooms about what you framed", () => {
    const z = zoomCrop({ x: 0.2, y: 0.9, zoom: 1 }, 1.5);
    expect(z.x).toBe(0.2);
    expect(z.y).toBe(0.9);
  });
});

describe("isDefaultCrop", () => {
  it("treats an absent crop and a centred one as the same picture", () => {
    expect(isDefaultCrop(undefined)).toBe(true);
    expect(isDefaultCrop({ x: 0.5, y: 0.5, zoom: 1 })).toBe(true);
    expect(isDefaultCrop({ x: 0.5, y: 0.5, zoom: 1.2 })).toBe(false);
    expect(isDefaultCrop({ x: 0.51, y: 0.5, zoom: 1 })).toBe(false);
  });
});

describe("apertureAspectRatio", () => {
  it("accounts for the scene, the object box AND the aperture box", () => {
    // A square-in-its-own-box aperture on a square-in-the-scene object is NOT square on
    // screen: the scene is 3:4, so it comes out at 0.75.
    expect(apertureAspectRatio({ width: 0.4, height: 0.4 }, { width: 0.5, height: 0.5 })).toBeCloseTo(0.75, 6);
  });

  it("gives a landscape frame a landscape cropper", () => {
    const r = apertureAspectRatio({ width: 0.5, height: 0.2 }, { width: 0.9, height: 0.8 });
    expect(r).toBeGreaterThan(1);
  });

  it("falls back to a square rather than dividing by zero", () => {
    expect(apertureAspectRatio({ width: 0, height: 0.5 }, { width: 0.5, height: 0.5 })).toBe(1);
  });
});
