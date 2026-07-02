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
import type { ProductionAsset, ProductionHotspot } from "@/lib/nest-production-types";
import type { NestEditableSurface } from "@/lib/nest-types";
import { getAssets, getBackgrounds, getTemplates, resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { createEditorDocumentFromTemplate } from "@/lib/nest-editor";
import { predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import { registerAssetSurfaces } from "@/lib/nest-surface-catalog";
import type { EditableSurfaceDef, SurfaceContentType, SurfaceType } from "@/lib/nest-surface-types";
import { NEST_HOTSPOT_SEMANTICS, type NestAssetHotspot, type NestHotspotSemantic } from "@/lib/nest-hotspot-types";
import { GOLDEN_LIVING_NEST_COMPOSED, GOLDEN_LIVING_NEST_TEMPLATE } from "@/lib/fixtures/golden-living-nest";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function statusToApproval(status: ProductionAsset["status"]): NestApprovalStatus {
  if (status === "approved" || status === "featured") return "approved";
  if (status === "draft") return "draft";
  return "retired"; // hidden / archived — still resolvable by id, but out of the tray
}

const SEMANTIC_SET = new Set<string>(NEST_HOTSPOT_SEMANTICS);
const toSemantic = (action: string): NestHotspotSemantic =>
  SEMANTIC_SET.has(action) ? (action as NestHotspotSemantic) : "custom_link";

/** A production connect region → an editor hotspot (asset-local geometry preserved). */
function productionHotspotToNest(h: ProductionHotspot): NestAssetHotspot {
  return {
    id: h.id,
    name: h.label,
    semantic: toSemantic(h.action),
    shape: { type: "rect", x: h.bounds.x, y: h.bounds.y, width: h.bounds.width, height: h.bounds.height },
    enabled: true,
    authoringMode: "predefined",
    ariaLabel: h.label,
  };
}

/** A production editable surface → the editor's surface def (region + accepted content). */
function nestEditableSurfaceToDef(s: NestEditableSurface): EditableSurfaceDef {
  const type: SurfaceType = s.kind === "note-board" ? "collage" : "image";
  const accepted: SurfaceContentType[] =
    s.contentType === "video" || s.contentType === "website" || s.contentType === "podcast" || s.contentType === "music"
      ? ["uploaded_image", "url_thumbnail"]
      : s.contentType === "gallery"
        ? ["uploaded_image", "url_thumbnail", "text", "emoji"]
        : ["uploaded_image", "text"];
  return { id: s.id, name: s.label, type, bounds: s.bounds, acceptedContentTypes: accepted };
}

/** ProductionAsset → LivingNestAsset (the editor's catalog contract). */
export function productionAssetToLiving(a: ProductionAsset): LivingNestAsset {
  const img = a.cutoutUrl ?? a.imageUrl ?? a.variants?.standard ?? "";
  const predefinedHotspots = a.hotspots?.length ? a.hotspots.map(productionHotspotToNest) : undefined;
  return {
    ...(predefinedHotspots ? { predefinedHotspots } : {}),
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
  for (const a of all) {
    assetsById[a.id] = productionAssetToLiving(a);
    // Register any asset-declared editable surfaces so Surface mode resolves them even
    // for assets outside the static surface catalog (Task 4A). Static catalog wins.
    if (a.editableSurfaces?.length) registerAssetSurfaces(a.id, a.editableSurfaces.map(nestEditableSurfaceToDef));
  }
  const assets = getAssets({ onlyVisible: true }).map(productionAssetToLiving);
  return { assets, assetsById };
}

function planeForAsset(a?: ProductionAsset): EditorPlane {
  const slots = a?.compatibleSlotTypes ?? [];
  // Frames/pinboards/windows mount on the wall; media consoles are floor-standing.
  if (slots.some((s) => s === "frame" || s === "pinboard" || s === "window")) return "front_wall";
  return "floor";
}

/**
 * Connect hotspots for a seeded instance: the id-keyed predefined catalog first (the
 * restored golden assets are keyed there), else the production asset's own declared
 * hotspots (re-scoped to this instance). Empty when neither exists.
 */
function seedHotspots(assetId: string, instanceId: string, prod?: ProductionAsset): NestAssetHotspot[] {
  const predefined = predefinedHotspotsForInstance(assetId, instanceId);
  if (predefined.length) return predefined;
  if (prod?.hotspots?.length) {
    return prod.hotspots.map((h) => ({ ...productionHotspotToNest(h), id: `${instanceId}-${h.id}` }));
  }
  return [];
}

/** One production placement → an EditableNestObject (box + anchor + plane). */
function placementToObject(p: NestPlacement, index: number): EditableNestObject {
  // Overlay placements (Task 4B) carry their own box + content; rebuild directly.
  if (p.overlay) {
    const width = clamp(p.w ?? 0.3, 0.05, 1);
    const height = clamp(p.h ?? 0.3, 0.04, 1);
    const x = clamp01(p.x);
    const y = clamp01(p.y);
    return {
      instanceId: p.id || `${p.assetId}-${index}`,
      assetId: p.assetId,
      x,
      y,
      width,
      height,
      anchor: { x: clamp01(x + width / 2), y: clamp01(y + height / 2) },
      plane: "foreground",
      zIndex: p.zIndex ?? index + 1,
      ...(p.rotation ? { rotation: p.rotation } : {}),
      overlay: p.overlay,
    };
  }
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
  const instanceId = p.id || `${p.assetId}-${index}`;
  const hotspots = seedHotspots(p.assetId, instanceId, prod);
  return {
    instanceId,
    assetId: p.assetId,
    x,
    y,
    width,
    height,
    anchor: { x: clamp01(cx), y: clamp01(baseY) },
    plane: planeForAsset(prod),
    zIndex: p.zIndex ?? index + 1,
    ...(p.rotation ? { rotation: p.rotation } : {}),
    ...(hotspots.length ? { hotspots } : {}),
  };
}

/** Reverse: editor objects → production placements (to save edits before publish). */
export function editableObjectsToPlacements(objects: EditableNestObject[]): NestPlacement[] {
  return objects.map((o, i) => {
    // Overlays store their box top-left + size + content (no asset/scale semantics).
    if (o.overlay) {
      return {
        id: o.instanceId || `pl-${i}`,
        assetId: o.assetId,
        x: clamp01(o.x),
        y: clamp01(o.y),
        w: o.width,
        h: o.height,
        zIndex: o.zIndex ?? i + 1,
        ...(o.rotation ? { rotation: o.rotation } : {}),
        overlay: o.overlay,
      };
    }
    return {
      id: o.instanceId || `pl-${i}`,
      assetId: o.assetId,
      x: clamp01(o.anchor?.x ?? o.x + o.width / 2),
      y: clamp01(o.anchor?.y ?? o.y + o.height),
      scale: clamp((o.width ?? 0.2) / 0.5, 0.05, 1.4),
      zIndex: o.zIndex ?? i + 1,
      ...(o.rotation ? { rotation: o.rotation } : {}),
    };
  });
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

/**
 * M14 (Phase 2): a clean **production** starter document for the editor's default (direct
 * `/nest-editor` with no `?document=`). Built entirely from the curated library — a featured
 * template's background + placements — so there are **no fallback boxes / missing asset ids**
 * (the old Golden Living fixture default referenced non-production ids). Falls back to a
 * featured background (empty) if no template is visible, then to the base fixture if the
 * library is empty. Pure + synchronous (safe for a `useState` initializer).
 */
export function productionStarterDocument(): EditableNestDocument {
  const base = createEditorDocumentFromTemplate({
    template: GOLDEN_LIVING_NEST_TEMPLATE,
    composed: GOLDEN_LIVING_NEST_COMPOSED,
  });
  const templates = getTemplates({ onlyVisible: true });
  const tpl = templates.find((t) => t.status === "featured") ?? templates[0];
  if (tpl) {
    const bg = resolveBackground(tpl.backgroundId);
    return {
      ...base,
      id: "nest-starter",
      name: tpl.name,
      backgroundId: tpl.backgroundId,
      backgroundImageUrl: bg?.variants?.standard ?? bg?.imageUrl ?? base.backgroundImageUrl,
      objects: tpl.objectPlacements.map((p, i) =>
        placementToObject({ id: `${p.assetId}-${i}`, assetId: p.assetId, x: p.x, y: p.y, scale: p.scale, zIndex: p.zIndex }, i),
      ),
    };
  }
  const bg = getBackgrounds({ onlyVisible: true })[0];
  return {
    ...base,
    id: "nest-starter",
    name: bg?.name ?? base.name,
    backgroundId: bg?.id ?? base.backgroundId,
    backgroundImageUrl: bg?.variants?.standard ?? bg?.imageUrl ?? base.backgroundImageUrl,
    objects: [],
  };
}
