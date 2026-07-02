// ── Nestudio — Nest Document store (M11) ─────────────────────────────────────
//
// localStorage-backed store for NestDocuments + a published registry (slug → doc).
// Public/unlisted publishes produce a SELF-CONTAINED shareable URL (the doc is
// encoded into the link) so a published Nest opens in any browser with no backend;
// private/followers publishes produce an owner-only URL that resolves only from the
// owner's local store. Server persistence (Supabase) is a later sprint.

import type { NestDocument, NestPlacement, NestVisibility } from "@/lib/nest-document-types";
import { isShareable } from "@/lib/nest-document-types";
import { resolveTemplate } from "@/lib/nest-production-library";

const DOCS_KEY = "nestudio-nest-documents"; // Record<id, NestDocument>
const PUB_KEY = "nestudio-published"; // Record<slug, PublishedRef>
export const NEST_DOCS_CHANGED = "nestudio-docs-changed";

const isBrowser = () => typeof window !== "undefined";
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export type PublishedRef = { slug: string; docId: string; visibility: NestVisibility; ownerId?: string };

function read<T>(key: string, fb: T): T {
  if (!isBrowser()) return fb;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch {
    return fb;
  }
}
function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(NEST_DOCS_CHANGED));
  } catch {
    /* ignore */
  }
}

// ── Documents ────────────────────────────────────────────────────────────────
function allDocs(): Record<string, NestDocument> {
  return read<Record<string, NestDocument>>(DOCS_KEY, {});
}

export function getDoc(id: string): NestDocument | undefined {
  return allDocs()[id];
}

/** Every locally-stored doc (used by the M12 localStorage→Supabase migration). */
export function getAllLocalDocs(): NestDocument[] {
  return Object.values(allDocs());
}

export function saveDoc(doc: NestDocument): NestDocument {
  const docs = allDocs();
  const next = { ...doc, updatedAt: now() };
  docs[doc.id] = next;
  write(DOCS_KEY, docs);
  return next;
}

function withPlacementIds(placements: Omit<NestPlacement, "id">[]): NestPlacement[] {
  return placements.map((p, i) => ({ ...p, id: `pl-${i}-${Math.random().toString(36).slice(2, 7)}` }));
}

/** Create a draft doc pre-populated from a template (templates are just docs). */
export function createDocFromTemplate(templateId: string): NestDocument | undefined {
  const tpl = resolveTemplate(templateId);
  if (!tpl) return undefined;
  const doc: NestDocument = {
    id: rid("nest"),
    backgroundId: tpl.backgroundId,
    placements: withPlacementIds(tpl.objectPlacements),
    title: tpl.name,
    visibility: "draft",
    createdAt: now(),
    updatedAt: now(),
    sourceTemplateId: tpl.id,
  };
  return saveDoc(doc);
}

/** Create an empty draft doc on a chosen background. */
export function createDocFromBackground(backgroundId: string, title = "My Nest"): NestDocument {
  const doc: NestDocument = {
    id: rid("nest"),
    backgroundId,
    placements: [],
    title,
    visibility: "draft",
    createdAt: now(),
    updatedAt: now(),
  };
  return saveDoc(doc);
}

// ── Publishing ─────────────────────────────────────────────────────────────--
function published(): Record<string, PublishedRef> {
  return read<Record<string, PublishedRef>>(PUB_KEY, {});
}

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "nest";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export type PublishResult = { slug: string; url: string; visibility: NestVisibility };

/**
 * Publish a doc at a visibility. Returns the public URL. Public/unlisted URLs embed
 * the doc (shareable anywhere); private/followers URLs are owner-only.
 */
export function publishDoc(id: string, visibility: NestVisibility, ownerId: string): PublishResult | undefined {
  const doc = getDoc(id);
  if (!doc) return undefined;
  const saved = saveDoc({ ...doc, visibility, ownerId });
  const slug = slugify(saved.title);
  const refs = published();
  refs[slug] = { slug, docId: id, visibility, ownerId };
  write(PUB_KEY, refs);
  const url = isShareable(visibility)
    ? `/nest/${slug}?c=${encodeDoc(saved)}`
    : `/nest/${slug}`;
  return { slug, url, visibility };
}

/** Resolve a published nest by slug from the LOCAL store (owner's browser). */
export function resolvePublishedBySlug(slug: string): { doc: NestDocument; ref: PublishedRef } | undefined {
  const ref = published()[slug];
  if (!ref) return undefined;
  const doc = getDoc(ref.docId);
  if (!doc) return undefined;
  return { doc, ref };
}

// ── Encoding (self-contained shareable links) ────────────────────────────────
function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Compact-encode a doc for a URL (only what the renderer needs). */
export function encodeDoc(doc: NestDocument): string {
  const compact = {
    b: doc.backgroundId,
    t: doc.title,
    v: doc.visibility,
    p: doc.placements.map((p) => [p.assetId, +p.x.toFixed(4), +p.y.toFixed(4), p.scale ?? null, p.zIndex ?? null]),
  };
  return b64urlEncode(JSON.stringify(compact));
}

/** Decode a shareable doc payload back into a NestDocument (renderer-ready). */
export function decodeDoc(encoded: string): NestDocument | undefined {
  try {
    const c = JSON.parse(b64urlDecode(encoded)) as {
      b: string; t: string; v: NestVisibility; p: [string, number, number, number | null, number | null][];
    };
    return {
      id: "shared", backgroundId: c.b, title: c.t, visibility: c.v,
      placements: c.p.map((a, i) => ({ id: `pl-${i}`, assetId: a[0], x: a[1], y: a[2], scale: a[3] ?? undefined, zIndex: a[4] ?? undefined })),
      createdAt: "", updatedAt: "",
    };
  } catch {
    return undefined;
  }
}

export function onDocsChanged(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  const h = () => cb();
  window.addEventListener(NEST_DOCS_CHANGED, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(NEST_DOCS_CHANGED, h);
    window.removeEventListener("storage", h);
  };
}
