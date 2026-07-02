import { describe, expect, it } from "vitest";
import { productionEditorCatalog, productionStarterDocument } from "@/lib/nest-editor-bridge";
import { decodeDoc, encodeDoc } from "@/lib/nest-document-store";
import type { NestDocument } from "@/lib/nest-document-types";

describe("M14 · Phase 2 — direct-editor production starter", () => {
  it("opens on production assets only — no missing ids / fallback boxes", () => {
    const doc = productionStarterDocument();
    expect(doc.backgroundImageUrl).toBeTruthy();
    const byId = productionEditorCatalog().assetsById;
    // Every object resolves to a real production asset (the old Golden Living default
    // referenced ast-sofa/ast-coffee-table/ast-rug — not in the production library).
    for (const o of doc.objects) expect(byId[o.assetId], `unresolved asset ${o.assetId}`).toBeTruthy();
  });

  it("is deterministic and seeds a share-worthy starter with hotspots", () => {
    const a = productionStarterDocument();
    const b = productionStarterDocument();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // pure — safe for a useState initializer
    expect(a.objects.length).toBeGreaterThan(0); // featured template has placements
    // The featured Creator Loft includes the golden TV, which ships catalog Connect hotspots.
    const tv = a.objects.find((o) => o.assetId === "ast-tv");
    expect(tv).toBeTruthy();
    expect((tv?.hotspots ?? []).length).toBeGreaterThan(0);
  });
});

describe("M14 · Phase 5 — shareable link preserves stickers + rotation", () => {
  const doc: NestDocument = {
    id: "d", backgroundId: "bg-warm-studio", title: "My Nest", visibility: "public",
    placements: [
      { id: "a", assetId: "ast-tv", x: 0.5, y: 0.6, scale: 0.7, zIndex: 2, rotation: 12 },
      { id: "b", assetId: "overlay:text", x: 0.3, y: 0.2, w: 0.3, h: 0.12, zIndex: 20, overlay: { kind: "text", text: "Hi!", align: "center" } },
    ],
    createdAt: "", updatedAt: "",
  };

  it("round-trips a text overlay + rotation through the self-contained ?c= payload", () => {
    const back = decodeDoc(encodeDoc(doc));
    expect(back).toBeTruthy();
    const overlay = back!.placements.find((p) => p.assetId === "overlay:text");
    expect(overlay?.overlay).toMatchObject({ kind: "text", text: "Hi!" });
    expect(overlay?.w).toBeCloseTo(0.3, 5);
    const tv = back!.placements.find((p) => p.assetId === "ast-tv");
    expect(tv?.rotation).toBe(12);
  });

  it("stays backward-compatible with old 5-element payloads", () => {
    // An older link (no 6th extras element) still decodes to plain placements.
    const legacy = { b: "bg-warm-studio", t: "Old", v: "public", p: [["ast-tv", 0.5, 0.6, 0.7, 2]] };
    const enc = Buffer.from(JSON.stringify(legacy)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const back = decodeDoc(enc);
    expect(back?.placements[0]).toMatchObject({ assetId: "ast-tv", x: 0.5 });
    expect(back?.placements[0].overlay).toBeUndefined();
  });
});
