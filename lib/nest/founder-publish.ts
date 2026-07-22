"use client";

import type { NestudioSpec } from "@/lib/asset-pipeline/translator";
import { founderHeaders } from "@/lib/founder-token";

// ── Founder publish: NestudioSpec → nest_assets payload → gated route ─────────
//
// Maps the reviewed spec into the catalog's placement metadata and POSTs it to the
// founder-gated /api/founder/publish-asset. Placement/plane drive the editor's
// guardrail placement; editable surfaces are intentionally omitted in v1 (interactive
// surfaces belong to the Interaction Engine, out of scope this sprint) — the asset is
// fully placeable without them.

export type FounderAssetId = `ast-${string}-v1`;

export function specToAssetId(spec: NestudioSpec): FounderAssetId {
  const slug = spec.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "object";
  return `ast-${slug}-v1`;
}

function placementMeta(spec: NestudioSpec) {
  switch (spec.placement) {
    case "floor":
      return { plane: "floor", acceptedHosts: ["floor"], compatibleSlotTypes: ["floor"], defaultScale: 0.5, standsIndependently: true, wallMountable: false, physicalSize: "medium", category: "furniture" };
    case "wall":
      return { plane: "wall", acceptedHosts: ["wall"], compatibleSlotTypes: ["wall"], defaultScale: 0.4, standsIndependently: false, wallMountable: true, physicalSize: "medium", category: "wall-art" };
    case "floor-or-surface":
      return { plane: "floor-or-surface", acceptedHosts: ["floor", "desk", "table", "shelf"], compatibleSlotTypes: ["floor", "desk"], defaultScale: 0.4, standsIndependently: true, wallMountable: false, physicalSize: "small", category: "decor" };
    case "surface":
    default:
      return { plane: "surface", acceptedHosts: ["desk", "table", "shelf"], compatibleSlotTypes: ["desk"], defaultScale: 0.34, standsIndependently: false, wallMountable: false, physicalSize: "small", category: "decor" };
  }
}

export function specToVisualBounds(spec: NestudioSpec): Record<string, unknown> {
  const p = placementMeta(spec);
  return {
    aspect: "1:1",
    anchor: { x: 0.5, y: 1 },
    scope: "global",
    ownerId: null,
    version: 1,
    brand: null, // Founder assets are brand-neutral by policy.
    placement: {
      physicalSize: p.physicalSize,
      defaultScale: p.defaultScale,
      plane: p.plane,
      acceptedHosts: p.acceptedHosts,
      zIndexRange: [40, 60],
      contactShadow: true,
      wallMountable: p.wallMountable,
      standsIndependently: p.standsIndependently,
    },
  };
}

export type PublishResult =
  | { ok: true; id: string; imageUrl: string; status: string }
  | { ok: false; error: string; status?: number };

/**
 * Publish an approved asset to the global catalog through the founder-gated route.
 * Returns a discriminated result — never throws — so the UI can show a recoverable error.
 */
export async function publishFounderAsset(input: {
  spec: NestudioSpec;
  finalDataUrl: string; // transparent PNG
}): Promise<PublishResult> {
  const { spec, finalDataUrl } = input;
  const p = placementMeta(spec);
  const id = specToAssetId(spec);
  try {
    const res = await fetch("/api/founder/publish-asset", {
      method: "POST",
      headers: founderHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        id,
        title: spec.name,
        category: p.category,
        imageDataUrl: finalDataUrl,
        compatibleSlotTypes: p.compatibleSlotTypes,
        cameraDnaVersion: "front-facing-v1",
        tags: spec.tags,
        editableSurfaces: [],
        visualBounds: specToVisualBounds(spec),
        status: "approved",
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; imageUrl?: string; status?: string };
    if (!res.ok) return { ok: false, error: j.error || `Publish failed (HTTP ${res.status}).`, status: res.status };
    return { ok: true, id, imageUrl: j.imageUrl ?? "", status: j.status ?? "approved" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
