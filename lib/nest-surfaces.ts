// ── Nestudio V2 — editable surface resolution + mutation (M8) ────────────────
//
// Pure glue between the catalog (surface DEFS per asset type) and an object INSTANCE's
// stored content. `resolveObjectSurfaces` merges them into the Phase-2 `EditableSurface`
// shape used by the renderer and the surface editor. Mutations are content-only — geometry
// and acceptance are governed by the catalog, so a surface can never move or accept a
// content type it doesn't allow. No React/DOM, no I/O, no randomness.

import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import type { EditableSurface, EditableSurfaceDef, ObjectSurfaceContent, SurfaceContent, SurfaceContentType } from "@/lib/nest-surface-types";
import { predefinedSurfacesForAsset } from "@/lib/nest-surface-catalog";

type SurfaceCarrier = Pick<EditableNestObject, "assetId" | "surfaces">;

/** The object's surfaces (catalog defs merged with the instance's stored content). */
export function resolveObjectSurfaces(obj: SurfaceCarrier): EditableSurface[] {
  const content = obj.surfaces ?? {};
  return predefinedSurfacesForAsset(obj.assetId).map((d) => ({ ...d, content: content[d.id] }));
}

/** Only the object's surfaces that currently have content (what the renderer draws). */
export function objectSurfacesWithContent(obj: SurfaceCarrier): EditableSurface[] {
  return resolveObjectSurfaces(obj).filter((s) => s.content);
}

/** Whether the asset declares any editable surface. */
export function objectHasSurfaces(obj: Pick<EditableNestObject, "assetId">): boolean {
  return predefinedSurfacesForAsset(obj.assetId).length > 0;
}

/** The content-type key for a content value (for acceptance checks). */
export function contentTypeOf(content: SurfaceContent): SurfaceContentType {
  if (content.kind === "text") return "text";
  if (content.kind === "sticker") return "emoji";
  return content.source === "url" ? "url_thumbnail" : "uploaded_image";
}

/** Whether a surface def accepts a content value (by kind). */
export function surfaceAccepts(def: EditableSurfaceDef, content: SurfaceContent): boolean {
  const a = def.acceptedContentTypes;
  if (content.kind === "text") return a.includes("text");
  if (content.kind === "sticker") return a.includes("emoji") || a.includes("sticker_asset");
  return a.includes("uploaded_image") || a.includes("url_thumbnail");
}

/** Validate a content value has the data it needs. */
export function validateSurfaceContent(content: SurfaceContent): string[] {
  const errors: string[] = [];
  if (content.kind === "image") {
    if (!content.src || typeof content.src !== "string") errors.push("image surface needs a src");
  } else if (content.kind === "text") {
    if (!content.text || !content.text.trim()) errors.push("text surface needs text");
  } else if (content.kind === "sticker") {
    if (!content.emoji) errors.push("sticker surface needs an emoji");
  }
  return errors;
}

/**
 * Set (or clear, when `content` is undefined) a surface's content on ONE object, keyed by
 * the catalog def id. No-op when the def is unknown or the content is not accepted. Returns
 * a new object (never mutates); drops the `surfaces` field entirely when it becomes empty.
 */
export function setSurfaceContentOnObject(obj: EditableNestObject, surfaceId: string, content: SurfaceContent | undefined): EditableNestObject {
  const def = predefinedSurfacesForAsset(obj.assetId).find((d) => d.id === surfaceId);
  if (!def) return obj;
  if (content && !surfaceAccepts(def, content)) return obj;
  const next: ObjectSurfaceContent = { ...(obj.surfaces ?? {}) };
  if (content) next[surfaceId] = content;
  else delete next[surfaceId];
  const copy: EditableNestObject = { ...obj };
  if (Object.keys(next).length > 0) copy.surfaces = next;
  else delete copy.surfaces;
  return copy;
}

/** Doc-level content set/clear for one object (works on a Main or scene-scoped document). */
export function setObjectSurfaceContent(
  doc: EditableNestDocument,
  instanceId: string,
  surfaceId: string,
  content: SurfaceContent | undefined,
): EditableNestDocument {
  return { ...doc, objects: doc.objects.map((o) => (o.instanceId === instanceId ? setSurfaceContentOnObject(o, surfaceId, content) : o)) };
}
