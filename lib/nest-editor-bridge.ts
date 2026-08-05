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
import type { NestDocument, NestPlacement, NestPlacementInteraction, NestSceneExtras } from "@/lib/nest-document-types";
import { NEST_SCENE_VERSION } from "@/lib/nest-document-types";
import type { ProductionAsset, ProductionHotspot } from "@/lib/nest-production-types";
import type { NestEditableSurface } from "@/lib/nest-types";
import { getAssets, getBackgrounds, getTemplates, resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { createEditorDocumentFromTemplate } from "@/lib/nest-editor";
import { hasExplicitBox, placementBox, scaleFromWidth } from "@/lib/nest-geometry";
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
export function productionEditorCatalog(extraAssets: LivingNestAsset[] = []): EditorCatalog {
  const all = getAssets(); // every status
  const assetsById: Record<string, LivingNestAsset> = {};
  for (const a of all) {
    assetsById[a.id] = productionAssetToLiving(a);
    // Register any asset-declared editable surfaces so Surface mode resolves them even
    // for assets outside the static surface catalog (Task 4A). Static catalog wins.
    if (a.editableSurfaces?.length) registerAssetSurfaces(a.id, a.editableSurfaces.map(nestEditableSurfaceToDef));
  }
  const assets = getAssets({ onlyVisible: true }).map(productionAssetToLiving);
  // M20: merge caller-supplied assets (the user's approved AI inventory). They lead
  // the tray so they're easy to find, and go into assetsById so placements resolve.
  for (const e of extraAssets) assetsById[e.id] = e;
  return { assets: [...extraAssets, ...assets], assetsById };
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
      plane: p.interaction?.plane ?? "foreground",
      zIndex: p.zIndex ?? index + 1,
      ...(p.rotation ? { rotation: p.rotation } : {}),
      ...(p.flipX ? { flipX: true } : {}),
      ...interactionToObject(p.interaction),
      overlay: p.overlay,
    };
  }
  const prod = resolveAsset(p.assetId);
  // M23A — geometry comes from lib/nest-geometry (the ONE canonical formula, shared with
  // NestPreview). This used to be a second, slightly different copy of the same maths.
  const box = placementBox(p, index);
  const { x, y, w: width, h: height } = box;
  // M24 — with an explicit box, `p.x/p.y` are the box top-left, so the base anchor is
  // derived from the box. Legacy rows still carry the anchor directly in `p.x/p.y`.
  const explicit = hasExplicitBox(p);
  const cx = explicit ? x + width / 2 : p.x;
  const baseY = explicit ? y + height : p.y;
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
    plane: p.interaction?.plane ?? planeForAsset(prod),
    zIndex: p.zIndex ?? index + 1,
    ...(p.rotation ? { rotation: p.rotation } : {}),
    ...(p.flipX ? { flipX: true } : {}),
    // Seeded hotspots are the catalog default; anything the creator actually configured
    // and saved wins over them.
    ...(hotspots.length ? { hotspots } : {}),
    ...interactionToObject(p.interaction),
  };
}

/** The stored `interaction` bag → the fields it came from on EditableNestObject. */
function interactionToObject(i?: NestPlacementInteraction): Partial<EditableNestObject> {
  if (!i) return {};
  return {
    ...(i.interactionId ? { interactionId: i.interactionId } : {}),
    ...(i.contentBinding ? { contentBinding: i.contentBinding } : {}),
    ...(i.hotspots?.length ? { hotspots: i.hotspots } : {}),
    ...(i.surfaces ? { surfaces: i.surfaces } : {}),
    ...(i.locked ? { locked: true } : {}),
    ...(i.hidden ? { hidden: true } : {}),
    ...(i.contactShadow != null ? { contactShadow: i.contactShadow } : {}),
    ...(i.variantId ? { variantId: i.variantId } : {}),
    // M25 §P2 — the object interaction config travels both ways or it does not exist.
    ...(i.asset ? { assetInteraction: i.asset } : {}),
  };
}

/**
 * M23B — the editor-only state a placement must carry with it.
 *
 * M23A unified geometry but left this behind: hotspots, surface content, the interaction
 * id, lock/hide and the depth plane lived only on `EditableNestObject`, so a visitor
 * opening a published Nest got the right-looking room with none of the behaviour the
 * creator configured. `interaction` is a passthrough bag persisted as one jsonb column.
 */
function objectInteraction(o: EditableNestObject): NestPlacementInteraction | undefined {
  const bag: NestPlacementInteraction = {
    ...(o.interactionId ? { interactionId: o.interactionId } : {}),
    ...(o.contentBinding ? { contentBinding: o.contentBinding } : {}),
    ...(o.hotspots?.length ? { hotspots: o.hotspots } : {}),
    ...(o.surfaces ? { surfaces: o.surfaces } : {}),
    ...(o.plane ? { plane: o.plane } : {}),
    ...(o.locked ? { locked: true } : {}),
    ...(o.hidden ? { hidden: true } : {}),
    ...(o.contactShadow != null ? { contactShadow: o.contactShadow } : {}),
    ...(o.variantId ? { variantId: o.variantId } : {}),
    ...(o.assetInteraction ? { asset: o.assetInteraction } : {}),
  };
  return Object.keys(bag).length ? bag : undefined;
}

/** Reverse: editor objects → production placements (to save edits before publish). */
export function editableObjectsToPlacements(objects: EditableNestObject[]): NestPlacement[] {
  return objects.map((o, i) => {
    const extras = objectInteraction(o);
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
        ...(o.flipX ? { flipX: true } : {}),
        ...(extras ? { interaction: extras } : {}),
        overlay: o.overlay,
      };
    }
    // M24 — persist the creator's ACTUAL box, not just a scale to re-derive it from.
    //
    // `x, y` are the box top-left (matching overlays) and `w, h` are the box, so
    // `placementBox()` replays exactly what the editor drew. `scale` is still written for
    // backwards compatibility with anything reading the old shape, but it is no longer
    // what geometry is rebuilt from.
    return {
      id: o.instanceId || `pl-${i}`,
      assetId: o.assetId,
      x: clamp01(o.x),
      y: clamp01(o.y),
      w: o.width,
      h: o.height,
      scale: scaleFromWidth(o.width),
      zIndex: o.zIndex ?? i + 1,
      ...(o.rotation ? { rotation: o.rotation } : {}),
      ...(o.flipX ? { flipX: true } : {}),
      ...(extras ? { interaction: extras } : {}),
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
    name: doc.title || base.name,
    // ── M24C §4 — THE BACKGROUND BUG ──────────────────────────────────────────
    //
    // This set `backgroundImageUrl` but NOT `backgroundId`, so a reopened editor kept
    // the golden-living fixture's id from `base`. Preview builds its document from
    // `doc.backgroundId`, `resolveBackground()` then found nothing, and the room rendered
    // as a plain beige field. Worse: saving or publishing from a reopened editor wrote
    // that wrong id back, so the background could be lost permanently.
    backgroundId: doc.backgroundId || base.backgroundId,
    backgroundImageUrl: bg?.variants?.standard ?? bg?.imageUrl ?? base.backgroundImageUrl,
    objects: doc.placements.map(placementToObject),
    // ── M24C §1 — focus regions and their child scenes come BACK ──────────────
    ...(doc.scene?.focusAreas ? { focusAreas: doc.scene.focusAreas } : {}),
    ...(doc.scene?.detailScenes ? { detailScenes: doc.scene.detailScenes } : {}),
  };
}

/**
 * M24C §1 — capture the scene state that is not a root placement.
 *
 * Pair this with `editableObjectsToPlacements()` on every save/publish: together they are
 * the complete canonical document. Using only the placements is what lost the plant.
 */
export function editableSceneExtras(doc: EditableNestDocument): NestSceneExtras {
  return {
    version: NEST_SCENE_VERSION,
    ...(doc.focusAreas?.length ? { focusAreas: doc.focusAreas } : {}),
    ...(doc.detailScenes?.length ? { detailScenes: doc.detailScenes } : {}),
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
