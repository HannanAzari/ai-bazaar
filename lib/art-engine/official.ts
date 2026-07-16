/**
 * lib/art-engine/official.ts — the reference fingerprint, MEASURED from the official
 * Nestudio library (Phase 1). The DNA isn't guessed; it's the average of the real
 * handcrafted assets. Computed once in the browser and cached for the session.
 */

import { loadImage, makeCanvas } from "@/lib/ai/canvas";
import { computeFingerprint, averageFingerprints, buildProfile, type StyleFingerprint, type StyleProfile } from "./fingerprint";

/** The canonical handcrafted objects the world is built from (transparent PNGs). */
export const OFFICIAL_ASSET_URLS = [
  "/nests/golden-nest-v1/sofa.png",
  "/nests/golden-nest-v1/bookshelf2.png",
  "/nests/golden-nest-v1/lamp.png",
  "/nests/golden-nest-v1/desk.png",
  "/nests/golden-nest-v1/plant.png",
  "/nests/golden-nest-v1/books.png",
  "/nests/golden-nest-v1/frame.png",
  "/nests/golden-nest-v1/tv.png",
];

/** The five family anchors the brief compares against (Phase 5). */
export const FAMILY_ANCHOR_URLS = [
  "/nests/golden-nest-v1/sofa.png",
  "/nests/golden-nest-v1/bookshelf2.png",
  "/nests/golden-nest-v1/lamp.png",
  "/nests/golden-nest-v1/desk.png",
  "/nests/golden-nest-v1/plant.png",
];

/**
 * A safe static reference derived from RENDERING_DNA — used when the official images
 * can't be loaded (SSR, offline, tests). Runtime measurement overrides it.
 */
export const FALLBACK_FINGERPRINT: StyleFingerprint = {
  saturation: 0.42,
  warmth: 0.07,
  value: 0.6,
  matteness: 0.97,
  edgeSoftness: 0.5,
  coverage: 0.4,
  contrast: 0.34,
  purity: 0.99,
  palette: [
    [242, 228, 196], [227, 207, 163], [199, 179, 147], [138, 92, 59], [70, 54, 90],
  ],
};

async function urlToFingerprint(url: string, sample = 256): Promise<StyleFingerprint> {
  const img = await loadImage(url);
  const scale = Math.min(1, sample / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = makeCanvas(w, h);
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const id = c.getContext("2d")!.getImageData(0, 0, w, h);
  return computeFingerprint({ data: id.data, width: w, height: h });
}

/** The style TARGET: the official mean + tolerances derived from the official spread. */
export const FALLBACK_PROFILE: StyleProfile = buildProfile([FALLBACK_FINGERPRINT]);

let cacheFp: StyleFingerprint | null = null;
let cacheProfile: StyleProfile | null = null;

async function officialFingerprints(): Promise<StyleFingerprint[]> {
  const fps: StyleFingerprint[] = [];
  for (const url of OFFICIAL_ASSET_URLS) {
    try { fps.push(await urlToFingerprint(url)); } catch { /* skip a missing asset */ }
  }
  return fps;
}

/** Measured average fingerprint of the official library (cached). */
export async function getOfficialFingerprint(): Promise<StyleFingerprint> {
  if (cacheFp) return cacheFp;
  const fps = await officialFingerprints();
  cacheFp = fps.length ? averageFingerprints(fps) : FALLBACK_FINGERPRINT;
  return cacheFp;
}

/** Measured style profile (mean + variance-based tolerances) of the official library. */
export async function getOfficialProfile(): Promise<StyleProfile> {
  if (cacheProfile) return cacheProfile;
  const fps = await officialFingerprints();
  cacheProfile = fps.length ? buildProfile(fps) : FALLBACK_PROFILE;
  cacheFp = cacheProfile.mean;
  return cacheProfile;
}

/** Per-asset fingerprints (for the dev benchmark / family board). */
export async function getOfficialFingerprints(urls = OFFICIAL_ASSET_URLS): Promise<{ url: string; fingerprint: StyleFingerprint }[]> {
  const out: { url: string; fingerprint: StyleFingerprint }[] = [];
  for (const url of urls) {
    try { out.push({ url, fingerprint: await urlToFingerprint(url) }); } catch { /* skip */ }
  }
  return out;
}
