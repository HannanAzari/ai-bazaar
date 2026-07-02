// ── M12 Phase 2 — bridge: production library ⇄ full Nest Editor ──────────────
//
// Adapts the M10/M12 production library (ProductionAsset/ProductionBackground) +
// onboarding NestDocument into the full editor's contracts (LivingNestAsset /
// EditableNestObject / EditableNestDocument), so the ONE canonical /nest-editor
// runs entirely on production art: the selected background, real placements, and an
// Assets tray of approved production assets. No duplicated editor logic — the editor
// components already take the catalog as props; this only supplies production data.

import type { NestApprovalStatus } from "@/lib/nest-types";
import { CURRENT_NEST_DNA_VERSION, NEST_CAMERA_CONTRACT_VERSION } from "@/lib/nest-types";
import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";
import type { EditableNestDocument, EditableNestObject, EditorPlane } from "@/lib/nest-editor-types";
import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";
import type { ProductionAsset } from "@/lib/nest-production-types";
import { getAssets, resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { createEditorDocumentFromTemplate } from "@/lib/nest-editor";
import { GOLDEN_LIVING_NEST_COMPOSED, GOLDEN_LIVING_NEST_TEMPLATE } from "@/lib/fixtures/golden-living-nest";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function statusToApproval(status: ProductionAsset["status"]): NestApprovalStatus {
  if (status === "approved" || status === "featured") return "approved";
  if (status === "draft") return "draft";
  return "retired"; // hidden / archived — still resolvable by id, but out of the tray
}

/** ProductionAsset → LivingNestAsset (the editor's catalog contract). */
export function productionAssetToLiving(a: ProductionAsset): LivingNestAsset {
  const img = a.cutoutUrl ?? a.imageUrl ?? a.variants?.standard ?? "";
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    tags: a.tags ?? [],
    dnaVersion: a.cameraDnaVersion ?? CURRENT_NEST_DNA_VERSION,
    cameraContractVersion: a.cameraDnaVersion ?? NEST_CAMERA_CONTRACT_VERSION,
    assetType: "standard",
    imageUrl: img,
    thumbnailUrl: a.variants?.standard ?? img,
    transparentPngUrl: a.cutoutUrl ?? img,
    compatibleSlotTypes: (a.compatibleSlotTypes ?? []) as LivingNestSlotType[],
    variants: [],
    states: [{ name: "idle" }],
    editableSurfaces: a.editableSurfaces,
    approvalStatus: statusToApproval(a.status),
    source: "curated",
    createdAt: "",
    updatedAt: "",
  };
}

export type EditorCatalog = { assets: LivingNestAsset[]; assetsById: Record<string, LivingNestAsset> };

/**
 * The editor catalog from the production library. `assets` (the Assets tray) is
 * approved/featured only; `assetsById` includes EVERY status so placements + already
 * published Nests still resolve archived/hidden assets by id.
 */
export function productionEditorCatalog(): EditorCatalog {
  const all = getAssets(); // every status
  const assetsById: Record<string, LivingNestAsset> = {};
  for (const a of all) assetsById[a.id] = productionAssetToLiving(a);
  const assets = getAssets({ onlyVisible: true }).map(productionAssetToLiving);
  return { assets, assetsById };
}

function planeForAsset(a?: ProductionAsset): EditorPlane {
  const slots = a?.compatibleSlotTypes ?? [];
  // Frames/pinboards/windows mount on the wall; media consoles are floor-standing.
  if (slots.some((s) => s === "frame" || s === "pinboard" || s === "window")) return "front_wall";
  return "floor";
}

/** One production placement → an EditableNestObject (box + anchor + plane). */
function placementToObject(p: NestPlacement, index: number): EditableNestObject {
  const prod = resolveAsset(p.assetId);
  const [aw, ah] = (prod?.visualBounds?.aspect ?? "1:1").split(":").map(Number);
  const ratio = aw && ah ? aw / ah : 1; // pixel w/h
  const width = clamp((p.scale ?? 0.4) * 0.5, 0.06, 0.7);
  // Convert pixel aspect to a normalized box height on the 3:4 (0.75) scene.
  const height = clamp((width / ratio) * 0.75, 0.04, 0.95);
  const cx = p.x;
  const baseY = p.y;
  const x = clamp01(cx - width / 2);
  const y = clamp01(baseY - height);
  return {
    instanceId: p.id || `${p.assetId}-${index}`,
    assetId: p.assetId,
    x,
    y,
    width,
    height,
    anchor: { x: clamp01(cx), y: clamp01(baseY) },
    plane: planeForAsset(prod),
    zIndex: p.zIndex ?? index + 1,
  };
}

/** Reverse: editor objects → production placements (to save edits before publish). */
export function editableObjectsToPlacements(objects: EditableNestObject[]): NestPlacement[] {
  return objects.map((o, i) => ({
    id: o.instanceId || `pl-${i}`,
    assetId: o.assetId,
    x: clamp01(o.anchor?.x ?? o.x + o.width / 2),
    y: clamp01(o.anchor?.y ?? o.y + o.height),
    scale: clamp((o.width ?? 0.2) / 0.5, 0.05, 1.4),
    zIndex: o.zIndex ?? i + 1,
  }));
}

/** Build a full editor document seeded from a production NestDocument. */
export function nestDocumentToEditable(doc: NestDocument): EditableNestDocument {
  const base = createEditorDocumentFromTemplate({
    template: GOLDEN_LIVING_NEST_TEMPLATE,
    composed: GOLDEN_LIVING_NEST_COMPOSED,
  });
  const bg = resolveBackground(doc.backgroundId);
  return {
    ...base,
    id: doc.id,
    backgroundImageUrl: bg?.variants?.standard ?? bg?.imageUrl ?? base.backgroundImageUrl,
    objects: doc.placements.map(placementToObject),
  };
}
