import { describe, expect, it } from "vitest";
import {
  editableObjectsToPlacements,
  editableSceneExtras,
  nestDocumentToEditable,
} from "@/lib/nest-editor-bridge";
import { NEST_SCENE_VERSION, type NestDocument } from "@/lib/nest-document-types";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";

// ── M24C §1/§2/§4 — the canonical scene survives the round trip ──────────────
//
// Two founder-reported regressions, both data loss rather than rendering:
//
//   • "Editor Preview does not show the room background" — `nestDocumentToEditable` set
//     `backgroundImageUrl` but NOT `backgroundId`, so a reopened editor carried the
//     golden-living fixture's id. Preview resolved nothing and drew a beige field, and
//     saving from that editor wrote the wrong id back.
//
//   • "A plant placed inside a focused area disappeared completely" — focus regions and
//     their child scenes live on the editor document, but only `doc.objects` (the MAIN
//     scene) was ever serialised. The plant existed solely in React state.

const object = (over: Partial<EditableNestObject> = {}): EditableNestObject => ({
  instanceId: "obj-1",
  assetId: "ast-sofa-beta",
  x: 0.2, y: 0.4, width: 0.3, height: 0.25,
  anchor: { x: 0.35, y: 0.65 },
  plane: "floor",
  zIndex: 1,
  ...over,
});

const PLANT = object({ instanceId: "the-plant", assetId: "ast-plant-beta", x: 0.44, y: 0.31, width: 0.12, height: 0.18, zIndex: 4 });

const editorDoc = (over: Partial<EditableNestDocument> = {}) =>
  ({
    id: "nest-1",
    name: "My Living Room",
    backgroundId: "bg-creator-loft",
    backgroundImageUrl: "/nests/library-v1/bg-creator-loft.webp",
    aspectRatio: "3:4",
    objects: [object()],
    focusAreas: [
      { id: "focus-1", name: "The shelf", bounds: { x: 0.3, y: 0.2, width: 0.3, height: 0.3 }, shape: "rect", previewHint: "Explore the shelf" },
    ],
    detailScenes: [{ id: "scene-focus-1", name: "The shelf", objects: [PLANT], updatedAt: "" }],
    ...over,
  }) as unknown as EditableNestDocument;

/** The document publish actually writes. */
function toCanonical(ed: EditableNestDocument): NestDocument {
  return {
    id: "nest-1",
    backgroundId: ed.backgroundId,
    title: ed.name,
    visibility: "public",
    placements: editableObjectsToPlacements(ed.objects),
    scene: editableSceneExtras(ed),
    createdAt: "",
    updatedAt: "",
  };
}

describe("§4 the background survives Editor → Preview → Save → reopen", () => {
  it("captures the creator's chosen background id, not the fixture's", () => {
    expect(toCanonical(editorDoc()).backgroundId).toBe("bg-creator-loft");
  });

  it("restores it when the editor reopens — this is the beige-field bug", () => {
    const canonical = toCanonical(editorDoc());
    const reopened = nestDocumentToEditable(canonical);
    expect(reopened.backgroundId).toBe("bg-creator-loft");
  });

  it("survives an unlimited number of round trips without drifting", () => {
    let doc = toCanonical(editorDoc());
    for (let i = 0; i < 3; i += 1) doc = toCanonical(nestDocumentToEditable(doc));
    expect(doc.backgroundId).toBe("bg-creator-loft");
  });

  it("keeps the creator's title too", () => {
    expect(nestDocumentToEditable(toCanonical(editorDoc())).name).toBe("My Living Room");
  });
});

describe("§2 the focused plant survives Save → reopen → Publish", () => {
  it("is captured in the canonical document at all", () => {
    const scene = toCanonical(editorDoc()).scene;
    expect(scene?.version).toBe(NEST_SCENE_VERSION);
    expect(scene?.detailScenes?.[0].objects.map((o) => o.instanceId)).toContain("the-plant");
  });

  it("comes back when the editor reopens", () => {
    const reopened = nestDocumentToEditable(toCanonical(editorDoc()));
    const plant = reopened.detailScenes?.[0].objects.find((o) => o.instanceId === "the-plant");
    expect(plant).toBeDefined();
  });

  it("comes back at exactly the same position and size", () => {
    const reopened = nestDocumentToEditable(toCanonical(editorDoc()));
    const plant = reopened.detailScenes![0].objects.find((o) => o.instanceId === "the-plant")!;
    expect({ x: plant.x, y: plant.y, width: plant.width, height: plant.height }).toEqual({
      x: PLANT.x, y: PLANT.y, width: PLANT.width, height: PLANT.height,
    });
  });

  it("survives repeated save/reopen cycles — the reported failure mode", () => {
    let doc = toCanonical(editorDoc());
    for (let i = 0; i < 3; i += 1) doc = toCanonical(nestDocumentToEditable(doc));
    expect(doc.scene?.detailScenes?.[0].objects.some((o) => o.instanceId === "the-plant")).toBe(true);
  });

  it("stays INSIDE its focus scene — never promoted into the main scene", () => {
    // Compensating by duplicating it into the root placements was explicitly ruled out.
    const doc = toCanonical(editorDoc());
    expect(doc.placements.map((p) => p.id)).not.toContain("the-plant");
    expect(doc.scene?.detailScenes?.[0].objects.map((o) => o.instanceId)).toContain("the-plant");
  });
});

describe("§1 focus regions round-trip", () => {
  it("keeps the region and its geometry", () => {
    const reopened = nestDocumentToEditable(toCanonical(editorDoc()));
    expect(reopened.focusAreas).toHaveLength(1);
    expect(reopened.focusAreas![0].bounds).toEqual({ x: 0.3, y: 0.2, width: 0.3, height: 0.3 });
  });

  it("keeps the link between a region and its detail scene", () => {
    const doc = toCanonical(editorDoc());
    expect(doc.scene?.focusAreas?.[0].id).toBe("focus-1");
    expect(doc.scene?.detailScenes?.[0].id).toBe("scene-focus-1");
  });
});

describe("§11 legacy documents", () => {
  it("a pre-M24C document (no scene) still opens, with no invented state", () => {
    const legacy: NestDocument = {
      id: "old", backgroundId: "bg-creator-loft", title: "Old", visibility: "public",
      placements: [], createdAt: "", updatedAt: "",
    };
    const reopened = nestDocumentToEditable(legacy);
    expect(reopened.backgroundId).toBe("bg-creator-loft");
    // Nothing fabricated — absent stays absent until the creator authors it.
    expect(reopened.focusAreas ?? []).toHaveLength(0);
    expect(reopened.detailScenes ?? []).toHaveLength(0);
  });

  it("saving a legacy document upgrades it to the versioned scene", () => {
    const legacy: NestDocument = {
      id: "old", backgroundId: "bg-creator-loft", title: "Old", visibility: "public",
      placements: [], createdAt: "", updatedAt: "",
    };
    expect(toCanonical(nestDocumentToEditable(legacy)).scene?.version).toBe(NEST_SCENE_VERSION);
  });
});
