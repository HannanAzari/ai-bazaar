import { describe, expect, it } from "vitest";
import {
  CURRENT_NEST_DNA_VERSION,
  NEST_CAMERA_CONTRACT_VERSION,
  NEST_SLOT_TYPES,
  findSlot,
  isRuntimeGenerated,
  isSlotCompatible,
  primarySlots,
  resolveInteractionId,
  validateComposedNest,
} from "@/lib/nest-types";
import type { ComposedNest } from "@/lib/nest-types";
import {
  GOLDEN_NEST_ASSETS,
  GOLDEN_NEST_ASSETS_BY_ID,
  GOLDEN_NEST_COMPOSED,
  GOLDEN_NEST_INTERACTIONS,
  GOLDEN_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-nest";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("nest contract constants", () => {
  it("locks the front-facing camera (ADR-028) and exposes the 14-slot taxonomy", () => {
    expect(NEST_CAMERA_CONTRACT_VERSION).toBe("front-facing-v1");
    // 10 original + 4 Production Pack V1 additions (M9.1)
    expect(NEST_SLOT_TYPES).toHaveLength(14);
    expect(NEST_SLOT_TYPES).toContain("media");
    expect(NEST_SLOT_TYPES).toContain("avatar");
    expect(NEST_SLOT_TYPES).toEqual(expect.arrayContaining(["seat", "table", "rug", "pinboard"]));
    expect(new Set(NEST_SLOT_TYPES).size).toBe(NEST_SLOT_TYPES.length); // no dupes
  });
});

describe("golden nest template fixture", () => {
  const t = GOLDEN_NEST_TEMPLATE;

  it("is a front-facing, portrait, 8-slot template authored to the locked camera + DNA", () => {
    expect(t.slots).toHaveLength(8);
    expect(t.aspectRatio).toBe("3:4");
    expect(t.cameraContractVersion).toBe(NEST_CAMERA_CONTRACT_VERSION);
    expect(t.dnaVersion).toBe(CURRENT_NEST_DNA_VERSION);
    expect(t.approvalStatus).toBe("approved");
    expect(t.ambiencePresets.length).toBeGreaterThanOrEqual(3);
  });

  it("has a shallow stage-box with a gentle downward tilt (~5–10°)", () => {
    expect(t.sceneBox.cameraTiltDeg).toBeGreaterThanOrEqual(5);
    expect(t.sceneBox.cameraTiltDeg).toBeLessThanOrEqual(10);
    expect(t.sceneBox.floorSeamY).toBeGreaterThan(0.5);
    expect(t.sceneBox.floorSeamY).toBeLessThan(0.7);
  });

  it("has unique slot ids with normalized anchors and a valid plane", () => {
    const ids = new Set(t.slots.map((s) => s.id));
    expect(ids.size).toBe(t.slots.length);
    const planes = ["front_wall", "left_sliver", "right_sliver", "floor", "foreground"];
    for (const s of t.slots) {
      expect(s.anchorPoint.x).toBeGreaterThanOrEqual(0);
      expect(s.anchorPoint.x).toBeLessThanOrEqual(1);
      expect(s.anchorPoint.y).toBeGreaterThanOrEqual(0);
      expect(s.anchorPoint.y).toBeLessThanOrEqual(1);
      expect(planes).toContain(s.plane);
      expect(s.acceptedAssetCategories.length).toBeGreaterThan(0);
    }
  });

  it("every default slot assignment targets a real slot + a real asset", () => {
    for (const a of t.defaultSlotAssignments) {
      expect(findSlot(t, a.slotId)).toBeTruthy();
      expect(GOLDEN_NEST_ASSETS_BY_ID[a.assetId]).toBeTruthy();
    }
  });

  it("reports its primary slots", () => {
    const primary = primarySlots(t).map((s) => s.id).sort();
    expect(primary).toEqual(["slot-avatar", "slot-desk", "slot-frame", "slot-media"]);
  });
});

describe("golden nest assets + interactions fixtures", () => {
  it("has 8 unique, approved, camera-matched assets", () => {
    expect(GOLDEN_NEST_ASSETS).toHaveLength(8);
    const ids = new Set(GOLDEN_NEST_ASSETS.map((a) => a.id));
    expect(ids.size).toBe(8);
    for (const a of GOLDEN_NEST_ASSETS) {
      expect(a.approvalStatus).toBe("approved");
      expect(a.cameraContractVersion).toBe(NEST_CAMERA_CONTRACT_VERSION);
      expect(a.compatibleSlotTypes.length).toBeGreaterThan(0);
    }
  });

  it("flags only the avatar as runtime-generated", () => {
    const generated = GOLDEN_NEST_ASSETS.filter(isRuntimeGenerated).map((a) => a.id);
    expect(generated).toEqual(["ast-avatar"]);
  });

  it("has 5 interactions, each with a reduced-motion fallback", () => {
    expect(GOLDEN_NEST_INTERACTIONS).toHaveLength(5);
    for (const i of GOLDEN_NEST_INTERACTIONS) {
      expect(i.reducedMotionFallback).toBeTruthy();
      expect(i.id).toBeTruthy();
    }
  });
});

describe("isSlotCompatible", () => {
  const t = GOLDEN_NEST_TEMPLATE;
  it("accepts an asset whose type + category match the slot", () => {
    const media = findSlot(t, "slot-media")!;
    expect(isSlotCompatible(media, GOLDEN_NEST_ASSETS_BY_ID["ast-tv"])).toBe(true);
  });
  it("rejects an asset that does not declare the slot type", () => {
    const frame = findSlot(t, "slot-frame")!;
    expect(isSlotCompatible(frame, GOLDEN_NEST_ASSETS_BY_ID["ast-tv"])).toBe(false);
  });
});

describe("resolveInteractionId precedence", () => {
  const t = GOLDEN_NEST_TEMPLATE;
  const slot = findSlot(t, "slot-media")!; // slot default: tv_glow_open_youtube
  const tv = GOLDEN_NEST_ASSETS_BY_ID["ast-tv"]; // asset default: tv_glow_open_youtube
  const desk = GOLDEN_NEST_ASSETS_BY_ID["ast-desk"]; // no asset default

  it("prefers the assignment override", () => {
    expect(resolveInteractionId(slot, tv, { slotId: slot.id, assetId: tv.id, interactionId: "x" })).toBe("x");
  });
  it("falls back to the asset default, then the slot default", () => {
    expect(resolveInteractionId(slot, tv)).toBe("tv_glow_open_youtube");
    expect(resolveInteractionId(slot, desk)).toBe("tv_glow_open_youtube"); // slot default
  });
  it("is undefined when nothing supplies one", () => {
    const deskSlot = findSlot(t, "slot-desk")!; // no slot default
    expect(resolveInteractionId(deskSlot, desk)).toBeUndefined();
  });
});

describe("validateComposedNest", () => {
  const t = GOLDEN_NEST_TEMPLATE;

  it("passes the self-consistent golden nest with no errors or warnings", () => {
    const r = validateComposedNest(GOLDEN_NEST_COMPOSED, t, GOLDEN_NEST_ASSETS_BY_ID);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("flags a template id mismatch", () => {
    const n = clone(GOLDEN_NEST_COMPOSED);
    n.templateId = "other";
    const r = validateComposedNest(n, t, GOLDEN_NEST_ASSETS_BY_ID);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("does not match template");
  });

  it("flags an unknown slot, unknown asset, and incompatible asset", () => {
    const n = clone(GOLDEN_NEST_COMPOSED);
    n.slotAssignments = [
      { slotId: "slot-missing", assetId: "ast-tv" },
      { slotId: "slot-desk", assetId: "ast-missing" },
      { slotId: "slot-frame", assetId: "ast-tv" }, // tv not valid in a frame slot
    ];
    const r = validateComposedNest(n, t, GOLDEN_NEST_ASSETS_BY_ID);
    expect(r.ok).toBe(false);
    const joined = r.errors.join(" ");
    expect(joined).toContain('slot "slot-missing" does not exist');
    expect(joined).toContain('asset "ast-missing"');
    expect(joined).toContain("not compatible with slot");
  });

  it("flags a bad variant, a bad ambience preset, and a non-avatar avatar", () => {
    const n = clone(GOLDEN_NEST_COMPOSED);
    n.ambiencePresetId = "nope";
    n.avatarAssetId = "ast-desk"; // not an avatar
    n.slotAssignments = [{ slotId: "slot-media", assetId: "ast-tv", variantId: "ghost" }];
    const r = validateComposedNest(n, t, GOLDEN_NEST_ASSETS_BY_ID);
    expect(r.ok).toBe(false);
    const joined = r.errors.join(" ");
    expect(joined).toContain('ambiencePresetId "nope"');
    expect(joined).toContain("is not an avatar asset");
    expect(joined).toContain('variant "ghost"');
  });

  it("rejects an unapproved asset", () => {
    const assets = clone(GOLDEN_NEST_ASSETS_BY_ID);
    assets["ast-tv"].approvalStatus = "pending_review";
    const r = validateComposedNest(GOLDEN_NEST_COMPOSED, t, assets);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("is not approved");
  });

  it("flags a duplicate slot assignment", () => {
    const n = clone(GOLDEN_NEST_COMPOSED);
    n.slotAssignments = [
      { slotId: "slot-desk", assetId: "ast-desk" },
      { slotId: "slot-desk", assetId: "ast-desk" },
    ];
    const r = validateComposedNest(n, t, GOLDEN_NEST_ASSETS_BY_ID);
    expect(r.errors.join(" ")).toContain("assigned more than once");
  });

  it("warns (not errors) when a primary slot is unfilled", () => {
    const n: ComposedNest = clone(GOLDEN_NEST_COMPOSED);
    // Keep only the avatar; media/frame/desk primaries become unfilled.
    n.slotAssignments = [{ slotId: "slot-avatar", assetId: "ast-avatar" }];
    const r = validateComposedNest(n, t, GOLDEN_NEST_ASSETS_BY_ID);
    expect(r.ok).toBe(true); // unfilled primaries are warnings, not errors
    expect(r.warnings.join(" ")).toContain("slot-media");
    expect(r.warnings.join(" ")).toContain("slot-desk");
  });
});
