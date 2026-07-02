// ── Nestudio V2 — Nest Editor document contract (M6) ────────────────────────
//
// The additive, framework-free contract for the visual Nest Editor. An
// **EditableNestDocument** is the structured manifest the editor authors and saves —
// NEVER a baked screenshot. It is intentionally separate from the catalog
// (`NestAsset` / `LivingNestAsset`): a catalog asset is reusable and immutable; an
// **EditableNestObject** is one *instance* that owns placement + local overrides and
// references a catalog asset by id. Many instances may reference the same asset.
//
// Coordinates are normalized 0..1 on the scene (responsive by construction). No
// React / DOM / browser types appear here, and the model serializes cleanly to JSON.
// Pure validation helpers live at the bottom. This file edits nothing existing.

import type { NestContentBinding, NestPlane } from "@/lib/nest-types";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import { validateHotspots } from "@/lib/nest-hotspots";
import type { NestDetailScene, NestFocusArea } from "@/lib/nest-focus-types";

/** The current editor-document schema version. */
export const NEST_EDITOR_VERSION = 1 as const;

/**
 * M13 (Task 4B) — a generic creator overlay (a text or image "sticker") placed freely on
 * the scene. Unlike an asset, an overlay carries its own content and is not backed by a
 * catalog asset; it reuses the normal object move/resize/rotate machinery. `assetId` is a
 * synthetic `overlay:text` / `overlay:image` marker (see `OVERLAY_TEXT_ASSET_ID` etc.).
 */
export type NestOverlay =
  | { kind: "text"; text: string; color?: string; align?: "left" | "center" | "right" }
  | { kind: "image"; src: string; fit?: "cover" | "contain" };

/** Synthetic asset ids that mark an object as a generic overlay (no catalog asset). */
export const OVERLAY_TEXT_ASSET_ID = "overlay:text";
export const OVERLAY_IMAGE_ASSET_ID = "overlay:image";

// We reuse the locked `NestPlane` union (`front_wall | left_sliver | right_sliver |
// floor | foreground`) rather than the sprint's example `left_wall/right_wall`, so
// edited documents stay renderer-compatible with the Golden Living Nest stage.
export type EditorPlane = NestPlane;

export const EDITOR_PLANES: EditorPlane[] = [
  "front_wall",
  "left_sliver",
  "right_sliver",
  "floor",
  "foreground",
];

/**
 * One placed object instance in an editable Nest. Owns its normalized box
 * (`x,y,width,height` ∈ [0,1]), its scene-normalized base `anchor`, depth `plane` +
 * integer `zIndex`, and optional local overrides (lock/hide/interaction/content/
 * variant). It references a catalog asset by `assetId` and never mutates it.
 */
export interface EditableNestObject {
  /** Stable unique id for this instance (not the asset id). */
  instanceId: string;
  /** The catalog asset this instance shows. */
  assetId: string;

  /** Normalized box on the scene (top-left + size), each ∈ [0,1]. */
  x: number;
  y: number;
  width: number;
  height: number;

  /** Scene-normalized base anchor (e.g. bottom-centre for floor objects). */
  anchor: { x: number; y: number };

  plane: EditorPlane;
  /** Deterministic integer paint order (higher = nearer the viewer). */
  zIndex: number;

  /** Clockwise rotation in degrees (visual transform around the box centre). */
  rotation?: number;
  /** Mirror horizontally (visual scaleX(-1) — does not change the box bounds). */
  flipX?: boolean;

  /** Interaction hotspots (asset-local sub-regions). Optional + backward-compatible. */
  hotspots?: NestAssetHotspot[];

  locked?: boolean;
  hidden?: boolean;

  /** Semantic interaction id (TV→video, frame→gallery, …). Behaviour is predefined. */
  interactionId?: string;
  /** Reserved for a later sprint — content/link binding. */
  contentBinding?: NestContentBinding;

  variantId?: string;
  /** Authoring scale reference (× avatar height) — informational. */
  scaleRef?: number;
  contactShadow?: boolean;

  /**
   * M7C.8: when this object lives in a child Focus Scene, whether it is also rendered as a
   * read-only projection back in the Main Nest (at the matching small position inside the
   * Focus Area). Absent ⇒ treated as `{ showInParent: true }` (default-on for child assets,
   * so existing documents project with no migration). Ignored for Main/native objects.
   */
  projection?: ChildProjectionPolicy;

  /** M8: editable-surface CONTENT for this instance, keyed by the catalog surface def id
   *  (nest-surface-catalog.ts). Visual personalization only (photo/text/sticker), fully
   *  independent of hotspots/bindings. Optional + backward-compatible. */
  surfaces?: import("@/lib/nest-surface-types").ObjectSurfaceContent;

  /** M13 (Task 4B): a generic text/image overlay carried on this instance. Present only
   *  when `assetId` is an `overlay:*` marker; absent for asset-backed objects. */
  overlay?: NestOverlay;
}

/** M7C.8 — how a child Focus-Scene object projects back into its parent (Main) scene. */
export interface ChildProjectionPolicy {
  /** Render a read-only projection of this object in the parent scene. */
  showInParent: boolean;
  /** `always` (default) shows in both editor + visitor; `preview_only` shows only in the
   *  visitor experience (hidden from the Main authoring canvas). */
  parentVisibility?: "always" | "preview_only";
}

/**
 * One creator's editable Nest manifest. Carries the background + aspect, the ordered
 * object instances, and the ambience. This is what the editor saves, exports, and
 * (later) publishes as a template manifest — a lightweight structured document, not
 * an image.
 */
export interface EditableNestDocument {
  version: typeof NEST_EDITOR_VERSION;
  id: string;
  name: string;

  backgroundId: string;
  backgroundImageUrl: string;
  /** CSS-style aspect, e.g. "3:4". */
  aspectRatio: string;

  objects: EditableNestObject[];

  ambiencePresetId?: string;

  // ── M7C scene graph (additive, backward-compatible) ──
  // The Main scene's Focus Areas and the Detail Scenes this document owns. Absent ⇒
  // the document is a Main-only Nest (every pre-M7C document still validates + loads).
  // Rich cross-reference validation lives in `lib/nest-focus-scenes.ts`
  // (`validateSceneGraph`); this contract keeps only the structural shape.
  focusAreas?: NestFocusArea[];
  detailScenes?: NestDetailScene[];

  createdAt: string;
  updatedAt: string;
}

// ── Pure validation ──────────────────────────────────────────────────────────

export interface EditorValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const inUnit = (n: number): boolean => n >= -0.0001 && n <= 1.0001;

/** Validate one object's structural integrity (hard errors only). */
export function validateEditorObject(obj: EditableNestObject, index = 0): string[] {
  const errors: string[] = [];
  const at = `object[${index}]${obj?.instanceId ? ` (${obj.instanceId})` : ""}`;
  if (!obj || typeof obj !== "object") return [`${at}: not an object`];
  if (!obj.instanceId) errors.push(`${at}: missing instanceId`);
  if (!obj.assetId) errors.push(`${at}: missing assetId`);
  for (const k of ["x", "y", "width", "height"] as const) {
    if (!finite(obj[k])) errors.push(`${at}: ${k} is not a finite number`);
    else if (!inUnit(obj[k])) errors.push(`${at}: ${k}=${obj[k]} is outside [0,1]`);
  }
  if (finite(obj.width) && obj.width <= 0) errors.push(`${at}: width must be > 0`);
  if (finite(obj.height) && obj.height <= 0) errors.push(`${at}: height must be > 0`);
  if (!obj.anchor || !finite(obj.anchor.x) || !finite(obj.anchor.y)) {
    errors.push(`${at}: anchor must have finite x,y`);
  }
  if (!finite(obj.zIndex)) errors.push(`${at}: zIndex must be a finite number`);
  if (!EDITOR_PLANES.includes(obj.plane)) errors.push(`${at}: invalid plane "${obj.plane}"`);
  if (obj.rotation != null && !finite(obj.rotation)) errors.push(`${at}: rotation must be a finite number`);
  if (obj.flipX != null && typeof obj.flipX !== "boolean") errors.push(`${at}: flipX must be a boolean`);
  if (obj.hotspots != null) errors.push(...validateHotspots(obj.hotspots).map((e) => `${at}: ${e}`));
  if (obj.overlay != null) {
    const ov = obj.overlay;
    if (ov.kind === "text") {
      if (typeof ov.text !== "string" || !ov.text.trim()) errors.push(`${at}: text overlay needs non-empty text`);
    } else if (ov.kind === "image") {
      if (typeof ov.src !== "string" || !ov.src) errors.push(`${at}: image overlay needs a src`);
    } else {
      errors.push(`${at}: unknown overlay kind`);
    }
  }
  return errors;
}

/**
 * Validate a full editable document. Hard `errors` make a document unusable (bad
 * version, missing fields, duplicate instance ids, malformed objects); soft
 * `warnings` are advisory (e.g. an empty Nest). Pure and deterministic.
 */
export function validateEditorDocument(doc: unknown): EditorValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!doc || typeof doc !== "object") {
    return { ok: false, errors: ["document is not an object"], warnings };
  }
  const d = doc as Partial<EditableNestDocument>;
  if (d.version !== NEST_EDITOR_VERSION) errors.push(`unsupported version "${String(d.version)}" (expected ${NEST_EDITOR_VERSION})`);
  if (!d.id) errors.push("missing document id");
  if (!d.name) errors.push("missing document name");
  if (!d.backgroundImageUrl) errors.push("missing backgroundImageUrl");
  if (!d.aspectRatio) errors.push("missing aspectRatio");
  if (!Array.isArray(d.objects)) {
    errors.push("objects must be an array");
    return { ok: false, errors, warnings };
  }

  const seen = new Set<string>();
  d.objects.forEach((o, i) => {
    errors.push(...validateEditorObject(o, i));
    if (o?.instanceId) {
      if (seen.has(o.instanceId)) errors.push(`duplicate instanceId "${o.instanceId}"`);
      seen.add(o.instanceId);
    }
  });

  if (d.objects.length === 0) warnings.push("document has no objects");

  // Scene-graph fields are optional; only their structural shape is checked here so
  // pre-M7C documents stay valid. Deep cross-reference validation is `validateSceneGraph`.
  if (d.focusAreas != null && !Array.isArray(d.focusAreas)) errors.push("focusAreas must be an array");
  if (d.detailScenes != null && !Array.isArray(d.detailScenes)) errors.push("detailScenes must be an array");

  return { ok: errors.length === 0, errors, warnings };
}

/** Type guard: a parsed value is a structurally valid EditableNestDocument. */
export function isEditableNestDocument(doc: unknown): doc is EditableNestDocument {
  return validateEditorDocument(doc).ok;
}
