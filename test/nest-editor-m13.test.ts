import { describe, expect, it } from "vitest";
import {
  addImageOverlay,
  addObject,
  addTextOverlay,
  parseEditorDocument,
  resizeObject,
  rotateObject,
  serializeEditorDocument,
} from "@/lib/nest-editor";
import { guardrailForAsset, isOverlayAssetId, planeBand } from "@/lib/nest-editor-policy";
import {
  editableObjectsToPlacements,
  nestDocumentToEditable,
  productionAssetToLiving,
  productionEditorCatalog,
} from "@/lib/nest-editor-bridge";
import { resolveObjectSurfaces } from "@/lib/nest-surfaces";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";
import type { NestDocument } from "@/lib/nest-document-types";

const baseDoc = (): EditableNestDocument => ({
  version: 1,
  id: "t",
  name: "Test",
  backgroundId: "bg",
  backgroundImageUrl: "/bg.webp",
  aspectRatio: "3:4",
  objects: [],
  createdAt: "",
  updatedAt: "",
});

const livingAsset = (slot: LivingNestSlotType): LivingNestAsset => ({
  id: `asset-${slot}`,
  name: slot,
  category: "furniture",
  tags: [],
  dnaVersion: "nestudio-v2-1.0",
  cameraContractVersion: "front-facing-v1",
  assetType: "standard",
  imageUrl: "/x.webp",
  thumbnailUrl: "/x.webp",
  transparentPngUrl: "/x.webp",
  compatibleSlotTypes: [slot],
  variants: [],
  states: [{ name: "idle" }],
  approvalStatus: "approved",
  source: "curated",
  createdAt: "",
  updatedAt: "",
});

describe("M13 · Task 2 — placement guardrails", () => {
  it("seat + desk are floor-only (no more wall-first fallback)", () => {
    for (const slot of ["seat", "desk"] as const) {
      expect(guardrailForAsset(livingAsset(slot)).allowedPlanes).toEqual(["floor"]);
    }
  });

  it("a newly added seat is born on the floor, inside the floor band", () => {
    const { doc } = addObject(baseDoc(), livingAsset("seat"));
    const o = doc.objects[0];
    expect(o.plane).toBe("floor");
    const band = planeBand("floor");
    expect(o.anchor.y).toBeGreaterThanOrEqual(band.minY);
    expect(o.anchor.y).toBeLessThanOrEqual(band.maxY);
  });
});

describe("M13 · Task 1 + 8 — tray restoration + hiding flawed oak", () => {
  it("restores golden assets to the tray and hides flawed oak (still resolvable by id)", () => {
    const cat = productionEditorCatalog();
    const trayIds = cat.assets.map((a) => a.id);
    // Restored golden assets are in the tray…
    expect(trayIds).toContain("ast-tv");
    expect(trayIds).toContain("ast-desk");
    // …the flawed oak assets are NOT in the tray…
    expect(trayIds).not.toContain("ast-lr-media-oak-console");
    expect(trayIds).not.toContain("ast-so-desk-oak");
    expect(trayIds).not.toContain("ast-so-chair-task");
    // …but remain resolvable by id so already-published Nests never break.
    expect(cat.assetsById["ast-lr-media-oak-console"]).toBeTruthy();
  });
});

describe("M13 · Task 3 — connect metadata", () => {
  it("carries a production asset's hotspots into the editor asset", () => {
    const living = productionAssetToLiving({
      id: "p",
      name: "P",
      category: "decor",
      imageUrl: "/x.webp",
      variants: {},
      compatibleSlotTypes: [],
      hotspots: [{ id: "h1", label: "Screen", bounds: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, action: "video" }],
      cameraDnaVersion: "front-facing-v1",
      status: "approved",
      tags: [],
    });
    expect(living.predefinedHotspots?.[0].semantic).toBe("video");
    expect(living.predefinedHotspots?.[0].shape).toMatchObject({ type: "rect", x: 0.1 });
  });
});

describe("M13 · Task 4A — surfaces on restored golden assets", () => {
  it("resolves the TV screen surface for the golden media unit by id", () => {
    expect(resolveObjectSurfaces({ assetId: "ast-tv" }).length).toBeGreaterThan(0);
  });
});

describe("M13 · Task 4B — generic overlays", () => {
  it("adds a text overlay that can rotate + resize (free-placement guardrail)", () => {
    const { doc, instanceId } = addTextOverlay(baseDoc());
    const o = doc.objects[0];
    expect(isOverlayAssetId(o.assetId)).toBe(true);
    expect(o.overlay).toEqual({ kind: "text", text: "Your text", align: "center" });

    // Rotation is allowed for overlays even with no catalog asset present.
    const rotated = rotateObject(doc, instanceId, 30, {});
    expect(rotated.objects[0].rotation).toBe(30);

    // Resize is not pinned to a narrow asset range.
    const resized = resizeObject(doc, instanceId, 0.6, {});
    expect(resized.objects[0].width).toBeCloseTo(0.6, 5);
  });

  it("survives a serialize → parse round-trip", () => {
    const { doc } = addImageOverlay(baseDoc(), "data:image/png;base64,AAAA");
    const parsed = parseEditorDocument(serializeEditorDocument(doc));
    expect(parsed.ok).toBe(true);
    expect(parsed.doc?.objects[0].overlay).toMatchObject({ kind: "image", src: "data:image/png;base64,AAAA" });
  });

  it("survives the publish round-trip (objects → placements → objects)", () => {
    const { doc } = addTextOverlay(baseDoc());
    const placements = editableObjectsToPlacements(doc.objects);
    expect(placements[0].overlay?.kind).toBe("text");
    const nestDoc: NestDocument = { id: "d", backgroundId: "bg-warm-studio", placements, title: "t", visibility: "draft", createdAt: "", updatedAt: "" };
    const back = nestDocumentToEditable(nestDoc);
    expect(back.objects[0].overlay).toMatchObject({ kind: "text", text: "Your text" });
  });
});
