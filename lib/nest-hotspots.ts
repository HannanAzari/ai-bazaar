// ── Nestudio V2 — pure hotspot operations + URL safety (M7B) ────────────────
//
// Framework-free, deterministic helpers for editing and resolving asset hotspots.
// All geometry is asset-local normalized 0..1, clamped to stay inside the asset and
// above the minimum size. No randomness, no Date.now, no I/O. URL bindings are
// validated against a safe protocol allowlist (no javascript:/data:/etc.).

import type {
  NestAssetHotspot,
  NestHotspotContentBinding,
  NestHotspotSemantic,
  NestHotspotShape,
} from "@/lib/nest-hotspot-types";
import { isInternalSemantic, MIN_HOTSPOT_SIZE, NEST_HOTSPOT_SEMANTICS } from "@/lib/nest-hotspot-types";
import type { NormalizedRect } from "@/lib/nest-types";

const round = (n: number, p = 4): number => +n.toFixed(p);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

// ── URL safety ───────────────────────────────────────────────────────────────

/** Protocols a creator link may use. Everything else (javascript:, data:, …) is rejected. */
export const SAFE_URL_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

export interface UrlCheck {
  ok: boolean;
  error?: string;
}

/** Validate a binding URL: must parse as an absolute URL with a safe protocol. */
export function validateBindingUrl(url: string | undefined): UrlCheck {
  const raw = (url ?? "").trim();
  if (!raw) return { ok: false, error: "A URL is required." };
  // Catch obfuscated dangerous schemes even before parsing.
  if (/^\s*(javascript|data|vbscript|file):/i.test(raw)) {
    return { ok: false, error: "That link type is not allowed." };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "Enter a full URL, e.g. https://example.com" };
  }
  if (!SAFE_URL_PROTOCOLS.includes(parsed.protocol.toLowerCase())) {
    return { ok: false, error: `“${parsed.protocol}” links are not allowed.` };
  }
  return { ok: true };
}

/** Validate a content binding (internal semantics may omit a URL). */
export function validateBinding(binding: NestHotspotContentBinding | undefined): string[] {
  if (!binding) return [];
  const errors: string[] = [];
  if (!NEST_HOTSPOT_SEMANTICS.includes(binding.type)) errors.push(`unknown semantic "${binding.type}"`);
  if (!isInternalSemantic(binding.type)) {
    const u = validateBindingUrl(binding.url);
    if (!u.ok) errors.push(u.error!);
  } else if (binding.url) {
    // An internal action may carry an optional URL, but if present it must be safe.
    const u = validateBindingUrl(binding.url);
    if (!u.ok) errors.push(u.error!);
  }
  return errors;
}

// ── Geometry ───────────────────────────────────────────────────────────────

/** Clamp a shape to stay within [0,1] and at/above the minimum size. */
export function clampShape(shape: NestHotspotShape): NestHotspotShape {
  const width = clamp(shape.width, MIN_HOTSPOT_SIZE, 1);
  const height = clamp(shape.height, MIN_HOTSPOT_SIZE, 1);
  const x = clamp(shape.x, 0, 1 - width);
  const y = clamp(shape.y, 0, 1 - height);
  return { type: shape.type, x: round(x), y: round(y), width: round(width), height: round(height) };
}

/** Whether an asset-local point lies inside a shape (rect or ellipse). */
export function shapeContainsPoint(shape: NestHotspotShape, x: number, y: number): boolean {
  if (x < shape.x || x > shape.x + shape.width || y < shape.y || y > shape.y + shape.height) return false;
  if (shape.type === "rect") return true;
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = shape.width / 2;
  const ry = shape.height / 2;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * Map an asset-local rect into Nest-normalized coordinates within the object's box.
 * Flip/rotation are applied by the renderer's CSS transform on the asset container,
 * so this returns the un-transformed local→nest mapping.
 */
export function assetHotspotToCanvasRect(shape: NestHotspotShape, objectBox: NormalizedRect): NormalizedRect {
  return {
    x: objectBox.x + shape.x * objectBox.width,
    y: objectBox.y + shape.y * objectBox.height,
    width: shape.width * objectBox.width,
    height: shape.height * objectBox.height,
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateHotspot(h: NestAssetHotspot, index = 0): string[] {
  const errors: string[] = [];
  const at = `hotspot[${index}]${h?.id ? ` (${h.id})` : ""}`;
  if (!h || typeof h !== "object") return [`${at}: not an object`];
  if (!h.id) errors.push(`${at}: missing id`);
  if (!h.name) errors.push(`${at}: missing name`);
  if (!NEST_HOTSPOT_SEMANTICS.includes(h.semantic)) errors.push(`${at}: invalid semantic "${h.semantic}"`);
  if (typeof h.enabled !== "boolean") errors.push(`${at}: enabled must be a boolean`);
  const s = h.shape;
  if (!s || (s.type !== "rect" && s.type !== "ellipse")) {
    errors.push(`${at}: invalid shape type`);
  } else {
    for (const k of ["x", "y", "width", "height"] as const) {
      if (typeof s[k] !== "number" || !Number.isFinite(s[k])) errors.push(`${at}: shape.${k} is not finite`);
    }
    if (Number.isFinite(s.width) && s.width < MIN_HOTSPOT_SIZE - 1e-6) errors.push(`${at}: shape smaller than minimum`);
    if (Number.isFinite(s.height) && s.height < MIN_HOTSPOT_SIZE - 1e-6) errors.push(`${at}: shape smaller than minimum`);
    if (s.x < -1e-6 || s.y < -1e-6 || s.x + s.width > 1 + 1e-6 || s.y + s.height > 1 + 1e-6) {
      errors.push(`${at}: shape leaves the asset bounds`);
    }
  }
  errors.push(...validateBinding(h.binding).map((e) => `${at}: ${e}`));
  return errors;
}

export function validateHotspots(hotspots: NestAssetHotspot[] | undefined): string[] {
  if (!hotspots) return [];
  if (!Array.isArray(hotspots)) return ["hotspots must be an array"];
  const errors: string[] = [];
  const seen = new Set<string>();
  hotspots.forEach((h, i) => {
    errors.push(...validateHotspot(h, i));
    if (h?.id) {
      if (seen.has(h.id)) errors.push(`duplicate hotspot id "${h.id}"`);
      seen.add(h.id);
    }
  });
  return errors;
}

// ── Mutations (pure; locked hotspots reject geometry edits) ──────────────────

const find = (hs: NestAssetHotspot[], id: string) => hs.find((h) => h.id === id);
const replace = (hs: NestAssetHotspot[], next: NestAssetHotspot) => hs.map((h) => (h.id === next.id ? next : h));

/** A deterministic unique hotspot id within a set (no randomness). */
export function nextHotspotId(hotspots: NestAssetHotspot[], base: string): string {
  const ids = new Set(hotspots.map((h) => h.id));
  let n = 1;
  while (ids.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function addHotspot(
  hotspots: NestAssetHotspot[],
  spec: { name: string; semantic: NestHotspotSemantic; shape: NestHotspotShape; idBase?: string } & Partial<NestAssetHotspot>,
): { hotspots: NestAssetHotspot[]; id: string } {
  const id = spec.id && !find(hotspots, spec.id) ? spec.id : nextHotspotId(hotspots, spec.idBase ?? `hs-${spec.semantic}`);
  const hotspot: NestAssetHotspot = {
    enabled: true,
    authoringMode: "custom",
    ...spec,
    id,
    shape: clampShape(spec.shape),
  };
  return { hotspots: [...hotspots, hotspot], id };
}

export function removeHotspot(hotspots: NestAssetHotspot[], id: string): NestAssetHotspot[] {
  return hotspots.filter((h) => h.id !== id);
}

export function updateHotspot(hotspots: NestAssetHotspot[], id: string, patch: Partial<NestAssetHotspot>): NestAssetHotspot[] {
  const h = find(hotspots, id);
  if (!h) return hotspots;
  const merged: NestAssetHotspot = { ...h, ...patch };
  // Locked hotspots reject geometry edits but allow content/state edits.
  if (h.locked && patch.shape) merged.shape = h.shape;
  if (merged.shape) merged.shape = clampShape(merged.shape);
  return replace(hotspots, merged);
}

export function duplicateHotspot(hotspots: NestAssetHotspot[], id: string): { hotspots: NestAssetHotspot[]; id?: string } {
  const h = find(hotspots, id);
  if (!h) return { hotspots };
  const base = h.id.replace(/-\d+$/, "");
  const newId = nextHotspotId(hotspots, base);
  const copy: NestAssetHotspot = {
    ...h,
    id: newId,
    name: `${h.name} copy`,
    locked: false,
    shape: clampShape({ ...h.shape, x: h.shape.x + 0.04, y: h.shape.y + 0.04 }),
  };
  return { hotspots: [...hotspots, copy], id: newId };
}

export function moveHotspot(hotspots: NestAssetHotspot[], id: string, dx: number, dy: number): NestAssetHotspot[] {
  const h = find(hotspots, id);
  if (!h || h.locked) return hotspots;
  return replace(hotspots, { ...h, shape: clampShape({ ...h.shape, x: h.shape.x + dx, y: h.shape.y + dy }) });
}

export function resizeHotspot(hotspots: NestAssetHotspot[], id: string, width: number, height: number): NestAssetHotspot[] {
  const h = find(hotspots, id);
  if (!h || h.locked) return hotspots;
  return replace(hotspots, { ...h, shape: clampShape({ ...h.shape, width, height }) });
}

export function setHotspotBinding(hotspots: NestAssetHotspot[], id: string, binding: NestHotspotContentBinding): NestAssetHotspot[] {
  const h = find(hotspots, id);
  if (!h) return hotspots;
  return replace(hotspots, { ...h, binding, semantic: binding.type });
}

export function clearHotspotBinding(hotspots: NestAssetHotspot[], id: string): NestAssetHotspot[] {
  const h = find(hotspots, id);
  if (!h) return hotspots;
  const next = { ...h };
  delete next.binding;
  return replace(hotspots, next);
}

/**
 * The topmost enabled hotspot containing an asset-local point, or undefined. Paint
 * order is array order (later = on top), so we scan from the end for determinism.
 */
export function findHotspotAtPoint(hotspots: NestAssetHotspot[], x: number, y: number): NestAssetHotspot | undefined {
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const h = hotspots[i];
    if (h.enabled && shapeContainsPoint(h.shape, x, y)) return h;
  }
  return undefined;
}

/** Regenerate every hotspot id deterministically (used when duplicating an asset). */
export function regenerateHotspotIds(hotspots: NestAssetHotspot[] | undefined, instanceId: string): NestAssetHotspot[] | undefined {
  if (!hotspots?.length) return hotspots;
  return hotspots.map((h, i) => ({ ...h, id: `${instanceId}-hs${i + 1}` }));
}
