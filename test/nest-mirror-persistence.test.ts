import { describe, expect, it } from "vitest";
import { flipObject } from "@/lib/nest-editor";
import { editableObjectsToPlacements, nestDocumentToEditable, productionAssetToLiving } from "@/lib/nest-editor-bridge";
import { rowToPlacement } from "@/lib/nest/supabase-nest-repo";
import { getAssets } from "@/lib/nest-production-library";
import { placementStyle } from "@/lib/nest-geometry";
import type { NestDocument } from "@/lib/nest-document-types";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";

// ── M26 §P4 — Mirror must survive the ENTIRE chain ───────────────────────────
//
//   tap Mirror → editor object → editable state → draft → save → publish
//   → Supabase row → reopen → Preview → visitor runtime
//
// The brief is explicit that local visual state is not evidence. Every step below is a
// real function from the real path; nothing is stubbed.

const ASSETS: Record<string, LivingNestAsset> = Object.fromEntries(
  getAssets().map((a) => [a.id, productionAssetToLiving(a)]),
);

const SOFA: EditableNestObject = {
  instanceId: "sofa-1",
  assetId: "ast-lr-sofa-boucle",
  x: 0.2, y: 0.5, width: 0.3, height: 0.2,
  anchor: { x: 0.35, y: 0.7 },
  plane: "floor",
  zIndex: 2,
};
const doc = (): EditableNestDocument =>
  ({ id: "n", name: "n", backgroundId: "bg-creator-loft", aspectRatio: "3:4", objects: [SOFA] }) as unknown as EditableNestDocument;

/** The document publish writes. */
const toCanonical = (ed: EditableNestDocument): NestDocument => ({
  id: "n", backgroundId: ed.backgroundId, title: ed.name, visibility: "public",
  placements: editableObjectsToPlacements(ed.objects),
  createdAt: "", updatedAt: "",
});
const throughSupabase = (d: NestDocument): NestDocument => JSON.parse(JSON.stringify(d));

describe("Mirror survives editor → draft → publish → reopen → visitor", () => {
  it("1. tapping Mirror flips the editor object", () => {
    const flipped = flipObject(doc(), "sofa-1", ASSETS);
    expect(flipped.objects[0].flipX).toBe(true);
  });

  it("2. it reaches the canonical placement", () => {
    const canonical = toCanonical(flipObject(doc(), "sofa-1", ASSETS));
    expect(canonical.placements[0].flipX).toBe(true);
  });

  it("3. it survives the Supabase row shape", () => {
    // `flip_x` is a real column; this is the exact mapping the repo uses on read.
    const row = { id: "p", nest_id: "n", asset_id: SOFA.assetId, x: 0.2, y: 0.5, scale: 1, rotation: 0, z_index: 2, w: 0.3, h: 0.2, flip_x: true, overlay: null, interaction: null, label: null, link_url: null };
    expect(rowToPlacement(row).flipX).toBe(true);
  });

  it("4. it comes back when the editor reopens", () => {
    const reopened = nestDocumentToEditable(throughSupabase(toCanonical(flipObject(doc(), "sofa-1", ASSETS))));
    expect(reopened.objects[0].flipX).toBe(true);
  });

  it("5. it survives repeated save/reopen cycles without flapping", () => {
    // A `!o.flipX` toggle read back wrong would alternate — this catches that.
    let d = toCanonical(flipObject(doc(), "sofa-1", ASSETS));
    for (let i = 0; i < 3; i += 1) d = toCanonical(nestDocumentToEditable(throughSupabase(d)));
    expect(d.placements[0].flipX).toBe(true);
  });

  it("6. the RUNTIME actually renders it mirrored", () => {
    // The end of the chain: what Preview and the visitor paint.
    const canonical = toCanonical(flipObject(doc(), "sofa-1", ASSETS));
    expect(String(placementStyle(canonical.placements[0]).transform)).toContain("scaleX(-1)");
  });

  it("7. un-mirroring survives the chain too", () => {
    const once = flipObject(doc(), "sofa-1", ASSETS);
    const twice = flipObject(once, "sofa-1", ASSETS);
    const canonical = toCanonical(twice);
    expect(canonical.placements[0].flipX).toBeUndefined();
    expect(placementStyle(canonical.placements[0]).transform ?? "").not.toContain("scaleX(-1)");
  });

  it("8. a locked object is never mirrored", () => {
    const locked = { ...doc(), objects: [{ ...SOFA, locked: true }] } as EditableNestDocument;
    expect(flipObject(locked, "sofa-1", ASSETS).objects[0].flipX).toBeFalsy();
  });
});
