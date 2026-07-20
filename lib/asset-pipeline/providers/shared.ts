/**
 * lib/asset-pipeline/providers/shared.ts — client helpers every hosted adapter uses.
 * The API key never touches the browser; adapters POST to /api/ai/generate with a
 * `provider` discriminator and the server routes to the right model.
 */

import type { RasterImage } from "@/lib/ai/types";
import { rasterFromDataUrl } from "@/lib/ai/canvas";
import type { ResolvedRequest } from "@/lib/asset-pipeline/types";

/** One generation call for a specific hosted provider. Returns the RAW image. */
export async function callGenerateRoute(providerId: string, req: ResolvedRequest): Promise<RasterImage> {
  // Identity Lock: never send only the cutout — the original photo + mask carry
  // information the cutout loses. The server appends them as reference images.
  const extraImages = [req.original?.dataUrl, req.mask?.dataUrl].filter(Boolean) as string[];
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: providerId,
      imageDataUrl: req.cutout.dataUrl,
      extraImages,
      positive: req.prompt.positive,
      negative: req.prompt.negative,
      size: req.size,
    }),
    signal: req.signal,
  });
  if (res.status === 501) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${providerId} is not configured (no API key).`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${providerId} generation failed (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as { imageDataUrl: string };
  return rasterFromDataUrl(json.imageDataUrl);
}

/** Generate N raw candidates by calling the route N times (models are nondeterministic). */
export async function generateN(providerId: string, req: ResolvedRequest): Promise<RasterImage[]> {
  const out: RasterImage[] = [];
  for (let i = 0; i < req.variants; i++) {
    out.push(await callGenerateRoute(providerId, req));
  }
  return out;
}

/* ── availability (server-truth, cached) ─────────────────────────────────────── */

let cache: Record<string, boolean> | null = null;

/** Fetch which providers are actually configured (keys present) server-side. Cached
 *  for the session. On the server or on error, returns an empty map (unknown). */
export async function fetchAvailability(): Promise<Record<string, boolean>> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    const res = await fetch("/api/ai/providers");
    if (!res.ok) return {};
    cache = (await res.json()) as Record<string, boolean>;
    return cache;
  } catch {
    return {};
  }
}

/** Availability of a single provider id (false if unknown/unconfigured). */
export async function providerAvailable(id: string): Promise<boolean> {
  const map = await fetchAvailability();
  return map[id] === true;
}
