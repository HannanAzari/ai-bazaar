import { describe, expect, it } from "vitest";
import {
  aspectRatioCss,
  aspectRatioValue,
  interactionActionLabel,
  interactionEffect,
  isInteractivePiece,
  resolveRenderPieces,
  slotBoxStyle,
} from "@/lib/nest-render";
import {
  GOLDEN_NEST_ASSETS_BY_ID,
  GOLDEN_NEST_COMPOSED,
  GOLDEN_NEST_INTERACTIONS_BY_ID,
  GOLDEN_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-nest";
import type { ComposedNest } from "@/lib/nest-types";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("aspect ratio helpers", () => {
  it("converts ratios to numbers and css", () => {
    expect(aspectRatioValue("3:4")).toBeCloseTo(0.75);
    expect(aspectRatioValue("16:9")).toBeCloseTo(16 / 9);
    expect(aspectRatioCss("3:4")).toBe("3 / 4");
  });
});

describe("slotBoxStyle", () => {
  it("maps normalized bounds to percentage box values", () => {
    const slot = GOLDEN_NEST_TEMPLATE.slots.find((s) => s.id === "slot-media")!;
    const box = slotBoxStyle(slot);
    expect(box.left).toBe("16%");
    expect(box.top).toBe("12%");
    expect(box.width).toBe("34%");
    expect(box.height).toBe("24%");
  });
});

describe("resolveRenderPieces", () => {
  it("renders every assigned slot from the fixture", () => {
    const pieces = resolveRenderPieces(
      GOLDEN_NEST_COMPOSED,
      GOLDEN_NEST_TEMPLATE,
      GOLDEN_NEST_ASSETS_BY_ID,
      GOLDEN_NEST_INTERACTIONS_BY_ID,
    );
    expect(pieces).toHaveLength(GOLDEN_NEST_COMPOSED.slotAssignments.length);
    expect(pieces.every((p) => !p.missing)).toBe(true);
  });

  it("orders pieces back-to-front by slot z-index", () => {
    const pieces = resolveRenderPieces(
      GOLDEN_NEST_COMPOSED,
      GOLDEN_NEST_TEMPLATE,
      GOLDEN_NEST_ASSETS_BY_ID,
      GOLDEN_NEST_INTERACTIONS_BY_ID,
    );
    const z = pieces.map((p) => p.slot.zIndex);
    expect(z).toEqual([...z].sort((a, b) => a - b));
  });

  it("resolves the interaction + variant for an assignment", () => {
    const pieces = resolveRenderPieces(
      GOLDEN_NEST_COMPOSED,
      GOLDEN_NEST_TEMPLATE,
      GOLDEN_NEST_ASSETS_BY_ID,
      GOLDEN_NEST_INTERACTIONS_BY_ID,
    );
    const tv = pieces.find((p) => p.slot.id === "slot-media")!;
    expect(tv.interactionId).toBe("tv_glow_open_youtube");
    expect(tv.interaction?.animation).toBe("glow");
    expect(tv.variant?.id).toBe("tv-walnut");
    expect(isInteractivePiece(tv)).toBe(true);
  });

  it("keeps a missing asset as a flagged fallback (does not crash)", () => {
    const nest: ComposedNest = clone(GOLDEN_NEST_COMPOSED);
    nest.slotAssignments = [{ slotId: "slot-media", assetId: "ast-ghost" }];
    const pieces = resolveRenderPieces(
      nest,
      GOLDEN_NEST_TEMPLATE,
      GOLDEN_NEST_ASSETS_BY_ID,
      GOLDEN_NEST_INTERACTIONS_BY_ID,
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0].missing).toBe(true);
    expect(pieces[0].asset).toBeUndefined();
    // slot still supplies its default interaction even with no asset
    expect(pieces[0].interactionId).toBe("tv_glow_open_youtube");
  });

  it("drops assignments whose slot does not exist", () => {
    const nest: ComposedNest = clone(GOLDEN_NEST_COMPOSED);
    nest.slotAssignments = [
      { slotId: "slot-ghost", assetId: "ast-tv" },
      { slotId: "slot-desk", assetId: "ast-desk" },
    ];
    const pieces = resolveRenderPieces(
      nest,
      GOLDEN_NEST_TEMPLATE,
      GOLDEN_NEST_ASSETS_BY_ID,
      GOLDEN_NEST_INTERACTIONS_BY_ID,
    );
    expect(pieces.map((p) => p.slot.id)).toEqual(["slot-desk"]);
  });

  it("marks a non-interactive piece (no resolved interaction)", () => {
    const pieces = resolveRenderPieces(
      GOLDEN_NEST_COMPOSED,
      GOLDEN_NEST_TEMPLATE,
      GOLDEN_NEST_ASSETS_BY_ID,
      GOLDEN_NEST_INTERACTIONS_BY_ID,
    );
    const desk = pieces.find((p) => p.slot.id === "slot-desk")!;
    expect(desk.interaction).toBeUndefined();
    expect(isInteractivePiece(desk)).toBe(false);
  });
});

describe("interactionEffect", () => {
  it("maps each fixture interaction to its placeholder effect", () => {
    const i = GOLDEN_NEST_INTERACTIONS_BY_ID;
    expect(interactionEffect(i["tv_glow_open_youtube"])).toBe("glow");
    expect(interactionEffect(i["book_open_article"])).toBe("open");
    expect(interactionEffect(i["lamp_toggle_ambience"])).toBe("ambience");
    expect(interactionEffect(i["frame_zoom_gallery"])).toBe("zoom");
    expect(interactionEffect(i["plant_wiggle"])).toBe("wiggle");
    expect(interactionEffect(undefined)).toBe("none");
  });
});

describe("interactionActionLabel", () => {
  it("derives the CTA from the content type", () => {
    const i = GOLDEN_NEST_INTERACTIONS_BY_ID;
    expect(interactionActionLabel(i["tv_glow_open_youtube"])).toBe("Open YouTube");
    expect(interactionActionLabel(i["book_open_article"])).toBe("Open Article");
    expect(interactionActionLabel(i["frame_zoom_gallery"])).toBe("Open Gallery");
    expect(interactionActionLabel(i["lamp_toggle_ambience"])).toBe("Toggle Ambience");
    expect(interactionActionLabel(i["plant_wiggle"])).toBe(""); // contentType none
    expect(interactionActionLabel(undefined)).toBe("");
  });
});
