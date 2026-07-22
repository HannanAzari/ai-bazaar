"use client";

import type { NestSpec } from "@/lib/nest-factory/translator";
import { scoreNestDna } from "@/lib/nest-factory/nest-dna";
import { founderHeaders } from "@/lib/founder-token";

// ── Founder publish: NestSpec → nest_backgrounds payload → gated route ────────
//
// Mirrors lib/nest/founder-publish.ts (assets), but targets the DEDICATED Nest
// Library (nest_backgrounds). Descriptive DNA travels in `metadata`; `style` +
// `tags` fill the columns the editor/library reads.

export type NestId = `nest-${string}-v1`;

export function specToNestId(spec: NestSpec): NestId {
  const slug = spec.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "nest";
  return `nest-${slug}-v1`;
}

export type PublishNestResult =
  | { ok: true; id: string; imageUrl: string; status: string }
  | { ok: false; error: string; status?: number };

export async function publishFounderNest(input: {
  spec: NestSpec;
  finalDataUrl: string; // room PNG
}): Promise<PublishNestResult> {
  const { spec, finalDataUrl } = input;
  const id = specToNestId(spec);
  const dna = scoreNestDna(spec);
  try {
    const res = await fetch("/api/founder/publish-nest", {
      method: "POST",
      headers: founderHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        id,
        title: spec.name,
        imageDataUrl: finalDataUrl,
        style: spec.architecturalStyle,
        cameraDnaVersion: spec.compatibilityVersion,
        tags: spec.recommendedAssetTags,
        metadata: {
          category: spec.category,
          mood: spec.mood,
          lighting: spec.lighting,
          timeOfDay: spec.timeOfDay,
          palette: spec.palette,
          walls: spec.walls,
          floorMaterial: spec.floorMaterial,
          ceiling: spec.ceiling,
          windows: spec.windows,
          architecturalDetails: spec.architecturalDetails,
          dnaScore: dna.score,
          compatibilityVersion: spec.compatibilityVersion,
        },
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
