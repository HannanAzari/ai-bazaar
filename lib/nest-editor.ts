// ── Nestudio V2 — Nest Editor core operations (M6) ──────────────────────────
//
// Pure, framework-free adapter + state operations for the visual Nest Editor. It
// converts the Golden Living Nest fixture into an EditableNestDocument, serializes /
// parses / validates it, and applies move / resize / add / remove / reorder / prop
// edits — every one a pure function returning a NEW document (no mutation, no I/O,
// no Math.random, no Date.now). It also converts an editable document back into the
// `{ template, composed }` pair the EXISTING Golden Living Nest stage renders, so
// Preview reuses the locked renderer (no second engine).
//
// Catalog assets are never mutated: an EditableNestObject owns placement + overrides
// and only references an asset by id. Edits this file edits nothing existing.

import type { ComposedNest, NestAspectRatio, SlotAssignment } from "@/lib/nest-types";
import type {
  LivingNestAsset,
  LivingNestSlot,
  LivingNestSlotType,
  LivingNestTemplate,
} from "@/lib/nest-visual-types";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { NEST_EDITOR_VERSION, validateEditorDocument } from "@/lib/nest-editor-types";
import {
  canFlipX,
  canRotate,
  clampObject,
  clampRotation,
  DEFAULT_GUARDRAIL,
  guardrailForAsset,
  slotTypeForAsset,
  type EditorGuardrail,
} from "@/lib/nest-editor-policy";

/** Fixed deterministic timestamp for created documents (no Date.now in the core). */
const EDITOR_T = "2026-06-29T00:00:00.000Z";

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const round = (n: number, p = 4): number => +n.toFixed(p);

// ── Adapter: fixture → editable document ─────────────────────────────────────

/**
 * Build an EditableNestDocument from a Living Nest template + a composed Nest. Each
 * composed slot assignment becomes one object instance using the template slot's
 * bounds / anchor / plane / z-index, plus the assignment's interaction + content.
 * Deterministic: same inputs ⇒ identical document (instance ids = slot ids).
 */
export function createEditorDocumentFromTemplate(opts: {
  template: LivingNestTemplate;
  composed: ComposedNest;
  id?: string;
  name?: string;
}): EditableNestDocument {
  const { template, composed } = opts;
  const slotById = new Map(template.slots.map((s) => [s.id, s]));

  const objects: EditableNestObject[] = [];
  for (const a of composed.slotAssignments) {
    const slot = slotById.get(a.slotId);
    if (!slot) continue;
    objects.push({
      instanceId: slot.id,
      assetId: a.assetId,
      x: round(slot.bounds.x),
      y: round(slot.bounds.y),
      width: round(slot.bounds.width),
      height: round(slot.bounds.height),
      anchor: { x: round(slot.anchorPoint.x), y: round(slot.anchorPoint.y) },
      plane: slot.plane,
      zIndex: slot.zIndex,
      interactionId: a.interactionId ?? slot.defaultInteractionId,
      contentBinding: a.content,
      variantId: a.variantId,
      scaleRef: slot.scaleRef,
      contactShadow: slot.contactShadow,
    });
  }
  objects.sort((p, q) => p.zIndex - q.zIndex);

  return {
    version: NEST_EDITOR_VERSION,
    id: opts.id ?? `editor-${template.id}`,
    name: opts.name ?? template.name,
    backgroundId: template.id,
    backgroundImageUrl: template.backgroundImageUrl,
    aspectRatio: template.aspectRatio,
    objects,
    ambiencePresetId: composed.ambiencePresetId,
    createdAt: EDITOR_T,
    updatedAt: EDITOR_T,
  };
}

// ── Serialize / parse ────────────────────────────────────────────────────────

export function serializeEditorDocument(doc: EditableNestDocument): string {
  return JSON.stringify(doc, null, 2);
}

export interface ParseResult {
  ok: boolean;
  doc?: EditableNestDocument;
  errors: string[];
}

/** Parse + validate JSON into a document. Never throws; returns clear errors. */
export function parseEditorDocument(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`invalid JSON: ${(e as Error).message}`] };
  }
  const v = validateEditorDocument(raw);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ok: true, doc: raw as EditableNestDocument, errors: [] };
}

export { validateEditorDocument };

// ── Object helpers ───────────────────────────────────────────────────────────

const findObj = (doc: EditableNestDocument, id: string): EditableNestObject | undefined =>
  doc.objects.find((o) => o.instanceId === id);

const replaceObj = (doc: EditableNestDocument, next: EditableNestObject): EditableNestDocument => ({
  ...doc,
  objects: doc.objects.map((o) => (o.instanceId === next.instanceId ? next : o)),
});

/** A deterministic unique instance id for an asset within a document. */
export function nextInstanceId(doc: EditableNestDocument, assetId: string): string {
  let n = 1;
  const ids = new Set(doc.objects.map((o) => o.instanceId));
  while (ids.has(`${assetId}-${n}`)) n += 1;
  return `${assetId}-${n}`;
}

// ── Operations (pure; locked objects ignore geometry edits) ──────────────────

/** Translate an object's box + anchor by a normalized delta, then clamp. */
export function moveObject(
  doc: EditableNestDocument,
  instanceId: string,
  dx: number,
  dy: number,
  assetsById: Record<string, LivingNestAsset> = {},
): EditableNestDocument {
  const o = findObj(doc, instanceId);
  if (!o || o.locked) return doc;
  const g = guardrailForAsset(assetsById[o.assetId]);
  const moved: EditableNestObject = {
    ...o,
    x: o.x + dx,
    y: o.y + dy,
    anchor: { x: o.anchor.x + dx, y: o.anchor.y + dy },
  };
  return replaceObj(doc, normalize(clampObject(moved, g)));
}

/**
 * Proportionally resize an object to a new normalized width (aspect preserved,
 * clamped to the guardrail min/max and canvas, anchor's relative position kept).
 */
export function resizeObject(
  doc: EditableNestDocument,
  instanceId: string,
  newWidth: number,
  assetsById: Record<string, LivingNestAsset> = {},
): EditableNestDocument {
  const o = findObj(doc, instanceId);
  if (!o || o.locked || o.width <= 0) return doc;
  const g = guardrailForAsset(assetsById[o.assetId]);
  const aspect = o.height / o.width; // preserve source aspect (no distortion)
  const w = Math.min(g.maxWidth, Math.max(g.minWidth, newWidth));
  const resized: EditableNestObject = { ...o, width: w, height: w * aspect };
  return replaceObj(doc, normalize(clampObject(resized, g)));
}

/** Default placement for a newly added asset — deterministic by plane (no random). */
function defaultPlacement(g: EditorGuardrail): { x: number; y: number; width: number; height: number; anchor: { x: number; y: number }; plane: EditorGuardrail["allowedPlanes"][number] } {
  const plane = g.allowedPlanes[0];
  const width = g.recommendedWidth;
  const height = width / g.boxAspect;
  // Centre horizontally; base on the plane's natural line.
  const baseY = plane === "front_wall" ? 0.22 : 0.86;
  const x = clamp01(0.5 - width / 2);
  const y = clamp01(baseY - height * g.defaultAnchor.y);
  const anchor = { x: x + width * g.defaultAnchor.x, y: y + height * g.defaultAnchor.y };
  return { x, y, width, height, anchor, plane };
}

/** Add a new instance of an asset at a deterministic default position. */
export function addObject(
  doc: EditableNestDocument,
  asset: LivingNestAsset,
): { doc: EditableNestDocument; instanceId: string } {
  const g = guardrailForAsset(asset);
  const place = defaultPlacement(g);
  const instanceId = nextInstanceId(doc, asset.id);
  const obj: EditableNestObject = normalize(
    clampObject(
      {
        instanceId,
        assetId: asset.id,
        ...place,
        plane: place.plane,
        zIndex: g.defaultZ,
        interactionId: asset.defaultInteractionId,
        scaleRef: g.recommendedWidth,
        contactShadow: g.contactShadow,
      },
      g,
    ),
  );
  return { doc: { ...doc, objects: [...doc.objects, obj] }, instanceId };
}

/** Remove exactly the requested instance. */
export function removeObject(doc: EditableNestDocument, instanceId: string): EditableNestDocument {
  return { ...doc, objects: doc.objects.filter((o) => o.instanceId !== instanceId) };
}

export type ReorderOp = "front" | "back" | "forward" | "backward";

/**
 * Reorder an object's z-index deterministically. After any op, z-indices are
 * re-packed to a stable ascending integer sequence in paint order.
 */
export function reorderObject(
  doc: EditableNestDocument,
  instanceId: string,
  op: ReorderOp,
): EditableNestDocument {
  const ordered = [...doc.objects].sort((a, b) => a.zIndex - b.zIndex || (a.instanceId < b.instanceId ? -1 : 1));
  const idx = ordered.findIndex((o) => o.instanceId === instanceId);
  if (idx === -1) return doc;
  const [item] = ordered.splice(idx, 1);
  let target = idx;
  if (op === "front") target = ordered.length;
  else if (op === "back") target = 0;
  else if (op === "forward") target = Math.min(ordered.length, idx + 1);
  else if (op === "backward") target = Math.max(0, idx - 1);
  ordered.splice(target, 0, item);
  // Re-pack to deterministic integer z-indices.
  const repacked = ordered.map((o, i) => ({ ...o, zIndex: i }));
  const byId = new Map(repacked.map((o) => [o.instanceId, o]));
  return { ...doc, objects: doc.objects.map((o) => byId.get(o.instanceId) ?? o) };
}

/** Patch arbitrary props of an instance (properties panel). Geometry is re-clamped. */
export function setObjectProps(
  doc: EditableNestDocument,
  instanceId: string,
  patch: Partial<EditableNestObject>,
  assetsById: Record<string, LivingNestAsset> = {},
): EditableNestDocument {
  const o = findObj(doc, instanceId);
  if (!o) return doc;
  const g = guardrailForAsset(assetsById[o.assetId]);
  const merged: EditableNestObject = { ...o, ...patch };
  // Keep rotation within the asset's policy even via the advanced precision form.
  if (patch.rotation != null) merged.rotation = clampRotation(assetsById[o.assetId], patch.rotation);
  if (patch.flipX === true && !canFlipX(assetsById[o.assetId])) merged.flipX = o.flipX;
  const geometryTouched =
    patch.x != null || patch.y != null || patch.width != null || patch.height != null || patch.plane != null || patch.anchor != null;
  return replaceObj(doc, normalize(geometryTouched ? clampObject(merged, g) : merged));
}

/** Set an object's rotation (deg), clamped to its policy. Locked/non-rotatable: no-op. */
export function rotateObject(
  doc: EditableNestDocument,
  instanceId: string,
  deg: number,
  assetsById: Record<string, LivingNestAsset> = {},
): EditableNestDocument {
  const o = findObj(doc, instanceId);
  if (!o || o.locked) return doc;
  const asset = assetsById[o.assetId];
  if (!canRotate(asset)) return doc; // disallowed rotation leaves the object unchanged
  return replaceObj(doc, normalize({ ...o, rotation: clampRotation(asset, deg) }));
}

/** Toggle horizontal flip when policy allows. Locked/non-flippable: no-op. */
export function flipObject(
  doc: EditableNestDocument,
  instanceId: string,
  assetsById: Record<string, LivingNestAsset> = {},
): EditableNestDocument {
  const o = findObj(doc, instanceId);
  if (!o || o.locked) return doc;
  if (!canFlipX(assetsById[o.assetId])) return doc;
  return replaceObj(doc, normalize({ ...o, flipX: !o.flipX }));
}

/** Deterministic diagonal offset (normalized) applied to a duplicated instance. */
export const DUPLICATE_OFFSET = 0.04;

/**
 * Duplicate an instance: a new stable id, the same asset + transform, nudged a fixed
 * diagonal step and re-clamped. Deterministic (no random). Returns the new id.
 */
export function duplicateObject(
  doc: EditableNestDocument,
  instanceId: string,
  assetsById: Record<string, LivingNestAsset> = {},
): { doc: EditableNestDocument; instanceId?: string } {
  const o = findObj(doc, instanceId);
  if (!o) return { doc };
  const g = guardrailForAsset(assetsById[o.assetId]);
  const newId = nextInstanceId(doc, o.assetId);
  const copy: EditableNestObject = normalize(
    clampObject(
      {
        ...o,
        instanceId: newId,
        locked: false,
        x: o.x + DUPLICATE_OFFSET,
        y: o.y + DUPLICATE_OFFSET,
        anchor: { x: o.anchor.x + DUPLICATE_OFFSET, y: o.anchor.y + DUPLICATE_OFFSET },
      },
      g,
    ),
  );
  return { doc: { ...doc, objects: [...doc.objects, copy] }, instanceId: newId };
}

/** Round geometry to stable precision so JSON stays clean + comparisons are exact. */
function normalize(o: EditableNestObject): EditableNestObject {
  return {
    ...o,
    x: round(o.x),
    y: round(o.y),
    width: round(o.width),
    height: round(o.height),
    anchor: { x: round(o.anchor.x), y: round(o.anchor.y) },
    zIndex: Math.round(o.zIndex),
    ...(o.rotation != null ? { rotation: round(o.rotation, 2) } : {}),
  };
}

// ── Reverse adapter: editable document → renderer inputs ─────────────────────

/**
 * Convert an editable document into the `{ template, composed }` pair the existing
 * Golden Living Nest stage renders. Hidden objects are excluded (so Preview omits
 * them). Each visible object becomes a one-off slot keyed by its instance id, so the
 * locked renderer (and its premium interactions) runs unchanged.
 */
export function editorDocumentToStage(
  doc: EditableNestDocument,
  assetsById: Record<string, LivingNestAsset>,
  baseTemplate: LivingNestTemplate,
): { template: LivingNestTemplate; composed: ComposedNest } {
  const visible = doc.objects.filter((o) => !o.hidden);

  const slots: LivingNestSlot[] = visible.map((o) => {
    const asset = assetsById[o.assetId];
    const slotType: LivingNestSlotType = (asset && slotTypeForAsset(asset)) || "product";
    return {
      id: o.instanceId,
      name: asset?.name ?? o.assetId,
      slotType,
      acceptedAssetCategories: asset ? [asset.category] : [],
      bounds: { x: o.x, y: o.y, width: o.width, height: o.height },
      anchorPoint: { x: o.anchor.x, y: o.anchor.y },
      zIndex: o.zIndex,
      plane: o.plane,
      importance: "optional",
      defaultInteractionId: o.interactionId,
      scaleRef: o.scaleRef,
      contactShadow: o.contactShadow,
      rotationDeg: o.rotation,
      flipX: o.flipX,
    };
  });

  const slotAssignments: SlotAssignment[] = visible.map((o) => ({
    slotId: o.instanceId,
    assetId: o.assetId,
    interactionId: o.interactionId,
    variantId: o.variantId,
    content: o.contentBinding,
  }));

  const avatar = visible.find((o) => assetsById[o.assetId]?.category === "avatar");

  const template: LivingNestTemplate = {
    ...baseTemplate,
    id: `${baseTemplate.id}--editor-preview`,
    backgroundImageUrl: doc.backgroundImageUrl,
    aspectRatio: doc.aspectRatio as NestAspectRatio,
    slots,
    defaultSlotAssignments: slotAssignments,
  };

  const composed: ComposedNest = {
    id: `composed-${doc.id}`,
    ownerId: doc.id,
    houseId: doc.backgroundId,
    templateId: template.id,
    slotAssignments,
    avatarAssetId: avatar?.assetId,
    personalAssetIds: [],
    ambiencePresetId: doc.ambiencePresetId ?? baseTemplate.ambiencePresets[0]?.id ?? "warm_day",
    accessLevel: "public",
    quickLinks: [],
    createdAt: EDITOR_T,
    updatedAt: EDITOR_T,
  };

  return { template, composed };
}

export { guardrailForAsset, DEFAULT_GUARDRAIL };
