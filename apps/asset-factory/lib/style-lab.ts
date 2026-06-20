import { type FactoryCategory, type StyleSample, type SampleScores, type AssetPlacement, type AssetCandidate, type AssetStatus, CATEGORY_META } from "@/lib/types";
import { buildStyledPrompt, STYLE_FAMILIES, DEFAULT_STYLE_FAMILY, type StyleFamilyId } from "@/lib/styles";
import { slugify } from "@/lib/slug";

// Style Lab (V3.1 → V3.4). Pure helpers to generate, decide, score, and note
// calibration variations for the ONE locked identity (`nestudio_v2`). The
// multi-style comparison (royal_match / modern_designer / clash) is retired; the
// focus is now provider-driven (OpenAI-first) calibration of a single style. No
// catalog writes; samples live in their own local store.

export type GoldenItem = {
  key: string;
  label: string;
  category: FactoryCategory;
  subject: string;
};

/**
 * The Golden Calibration Set (V3.4, Task 4) — the PERMANENT benchmark. These ten
 * items are the fixed set every calibration session generates and scores.
 */
export const GOLDEN_ITEMS: GoldenItem[] = [
  { key: "chair", label: "Accent Chair", category: "chair", subject: "accent chair" },
  { key: "sofa", label: "Sofa", category: "sofa", subject: "two-seat sofa" },
  { key: "desk", label: "Desk", category: "desk", subject: "writing desk" },
  { key: "bookshelf", label: "Bookshelf", category: "shelf", subject: "bookshelf" },
  { key: "tv", label: "TV", category: "tv_screen", subject: "flat-screen tv" },
  { key: "plant", label: "Plant", category: "plant", subject: "potted plant" },
  { key: "floor_lamp", label: "Floor Lamp", category: "lamp", subject: "floor lamp" },
  { key: "coffee_table", label: "Coffee Table", category: "table", subject: "coffee table" },
  { key: "guitar", label: "Guitar", category: "guitar", subject: "acoustic guitar" },
  { key: "computer", label: "Computer", category: "computer", subject: "computer monitor" },
];

export const VARIATIONS_PER_ITEM = 5;

export function goldenItem(key: string): GoldenItem | undefined {
  return GOLDEN_ITEMS.find((i) => i.key === key);
}

export type SampleMeta = { provider?: string; model?: string };

function makeStyleSample(
  item: GoldenItem,
  styleId: StyleFamilyId,
  variation: number,
  imageUrl: string,
  prompt: string,
  batch: string,
  meta: SampleMeta,
  kind: "real" | "dry_run",
): StyleSample {
  const provider = meta.provider ?? "openai";
  return {
    id: `style-${slugify(item.key)}-${styleId}-${provider}-${batch}-${variation}`,
    itemKey: item.key,
    category: item.category,
    subject: item.subject,
    styleId,
    provider,
    model: meta.model ?? "",
    variation,
    prompt,
    imageUrl,
    seed: variation + 1,
    decision: "pending",
    closest: false,
    kind,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build N **dry-run placeholder** variations for a golden item. These use
 * `/samples/...` placeholder paths and cost nothing — used ONLY for dry runs. Real
 * generation must use {@link realStyleSamples}.
 */
export function buildStyleSamples(
  item: GoldenItem,
  styleId: StyleFamilyId = DEFAULT_STYLE_FAMILY,
  options: { count?: number; batch?: string } & SampleMeta = {},
): StyleSample[] {
  const count = options.count ?? VARIATIONS_PER_ITEM;
  const batch = options.batch ?? Date.now().toString(36);
  const prompt = buildStyledPrompt(item.category, styleId, { subject: item.subject });
  const provider = options.provider ?? "openai";
  return Array.from({ length: count }, (_, i) =>
    makeStyleSample(item, styleId, i, `/samples/style-${item.key}-${styleId}-${provider}-${i}.png`, prompt, batch, options, "dry_run"),
  );
}

/**
 * Build variations from REAL generated image URLs. One sample per non-empty URL —
 * placeholders are NEVER fabricated here, so a failed/empty real generation yields
 * an empty array (the caller surfaces an error instead of showing placeholders).
 */
export function realStyleSamples(
  item: GoldenItem,
  styleId: StyleFamilyId,
  imageUrls: (string | null | undefined)[],
  options: { batch?: string } & SampleMeta = {},
): StyleSample[] {
  const batch = options.batch ?? Date.now().toString(36);
  const prompt = buildStyledPrompt(item.category, styleId, { subject: item.subject });
  const urls = imageUrls.filter((u): u is string => typeof u === "string" && u.length > 0);
  return urls.map((url, i) => makeStyleSample(item, styleId, i, url, prompt, batch, options, "real"));
}

export type StyleGenerationResult =
  | { ok: true; imageUrls: string[] }
  | { ok: false; error: string };

/**
 * Interpret a `/api/generate/style` response for the client (pure + testable).
 * A non-OK response, or an OK response with no real image URLs, is an ERROR —
 * never a reason to show placeholder images in real mode.
 */
export function parseStyleResult(ok: boolean, data: { imageUrls?: unknown; error?: unknown }): StyleGenerationResult {
  if (!ok) {
    return { ok: false, error: typeof data?.error === "string" ? data.error : "Generation failed." };
  }
  const urls = Array.isArray(data?.imageUrls)
    ? data.imageUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  if (urls.length === 0) {
    return { ok: false, error: typeof data?.error === "string" ? data.error : "No images were returned by the provider." };
  }
  return { ok: true, imageUrls: urls };
}

/** Apply an approve/reject decision to a sample (pure). */
export function decideSample(samples: StyleSample[], id: string, decision: StyleSample["decision"]): StyleSample[] {
  return samples.map((s) => (s.id === id ? { ...s, decision } : s));
}

/** Mark a sample as closest — exactly one per (item, style), toggled (pure). */
export function markClosest(samples: StyleSample[], id: string): StyleSample[] {
  const target = samples.find((s) => s.id === id);
  if (!target) return samples;
  return samples.map((s) => {
    if (s.itemKey !== target.itemKey || s.styleId !== target.styleId) return s;
    return { ...s, closest: s.id === id ? !s.closest : false };
  });
}

/** Attach/replace the five-dimension calibration scores on a sample (pure). */
export function scoreSample(samples: StyleSample[], id: string, scores: SampleScores): StyleSample[] {
  return samples.map((s) => (s.id === id ? { ...s, scores } : s));
}

/** Attach/replace a reviewer note on a sample (pure). */
export function noteSample(samples: StyleSample[], id: string, note: string): StyleSample[] {
  return samples.map((s) => (s.id === id ? { ...s, note } : s));
}

// ── Per-item scoring (calibration progress) ──────────────────────────────────

export type ItemScore = {
  key: string;
  label: string;
  generated: number;
  approved: number;
  rejected: number;
  hasClosest: boolean;
  /** Calibrated = at least one approved variation AND a chosen closest pick. */
  calibrated: boolean;
};

export type StyleLabScore = {
  items: ItemScore[];
  itemsCalibrated: number;
  itemsTotal: number;
  overall: number;
};

export function scoreStyleLab(samples: StyleSample[]): StyleLabScore {
  const items: ItemScore[] = GOLDEN_ITEMS.map((item) => {
    const mine = samples.filter((s) => s.itemKey === item.key);
    const approved = mine.filter((s) => s.decision === "approved").length;
    const hasClosest = mine.some((s) => s.closest);
    return {
      key: item.key,
      label: item.label,
      generated: mine.length,
      approved,
      rejected: mine.filter((s) => s.decision === "rejected").length,
      hasClosest,
      calibrated: approved > 0 && hasClosest,
    };
  });
  const itemsCalibrated = items.filter((i) => i.calibrated).length;
  return {
    items,
    itemsCalibrated,
    itemsTotal: GOLDEN_ITEMS.length,
    overall: Math.round((itemsCalibrated / GOLDEN_ITEMS.length) * 100),
  };
}

/** The chosen closest sample(s). */
export function goldenPicks(samples: StyleSample[]): StyleSample[] {
  return samples.filter((s) => s.closest);
}

// ── Persistence helpers (V3.7) ───────────────────────────────────────────────
// Generation must APPEND (never silently overwrite real renders). Dry-run may only
// replace OTHER dry-run placeholders, never real samples. Explicit removal only.

/** A dry-run placeholder: tagged "dry_run", or (legacy) a `/samples/` placeholder path. */
export function isDryRunSample(s: StyleSample): boolean {
  if (s.kind) return s.kind === "dry_run";
  return s.imageUrl.startsWith("/samples/");
}

/** A real provider render. */
export function isRealSample(s: StyleSample): boolean {
  return !isDryRunSample(s);
}

/** Append fresh samples, de-duped by id — existing samples are never dropped. */
export function appendSamples(all: StyleSample[], fresh: StyleSample[]): StyleSample[] {
  const ids = new Set(all.map((s) => s.id));
  return [...all, ...fresh.filter((s) => !ids.has(s.id))];
}

/**
 * Replace ONLY the dry-run placeholders for the item(s) present in `fresh`, then add
 * `fresh`. Real samples (for those items and all others) are preserved untouched.
 */
export function replaceDryRunSamples(all: StyleSample[], fresh: StyleSample[]): StyleSample[] {
  const items = new Set(fresh.map((s) => s.itemKey));
  const kept = all.filter((s) => !(items.has(s.itemKey) && isDryRunSample(s)));
  return [...kept, ...fresh];
}

/** Remove a single sample by id (explicit user delete). */
export function removeSample(all: StyleSample[], id: string): StyleSample[] {
  return all.filter((s) => s.id !== id);
}

/** Drop dry-run placeholders (all, or just one item) — clears 404 placeholders. */
export function clearDryRunSamples(all: StyleSample[], itemKey?: string): StyleSample[] {
  return all.filter((s) => !(isDryRunSample(s) && (itemKey === undefined || s.itemKey === itemKey)));
}

// ── Approved library + export (V3.7) ─────────────────────────────────────────

/** Real samples that are approved OR starred — the "saved candidates" library. */
export function approvedLibrary(samples: StyleSample[]): StyleSample[] {
  return samples.filter((s) => isRealSample(s) && (s.decision === "approved" || s.closest));
}

/** Overall 0–100 from the five-dimension scores (inlined to avoid a calibration cycle). */
function overallScore(scores?: SampleScores): number | null {
  if (!scores) return null;
  const total = scores.consistency + scores.readability + scores.silhouette + scores.styleFit + scores.productionReadiness;
  return Math.round((total / 50) * 100);
}

function sampleName(s: StyleSample): string {
  const label = CATEGORY_META[s.category]?.label ?? s.category;
  return s.personality ? `${s.personality} ${label}` : label;
}

export type ApprovedExportRow = {
  id: string;
  name: string;
  category: FactoryCategory;
  placement: AssetPlacement;
  personality: string;
  imageUrl: string;
  prompt: string;
  model: string;
  provider: string;
  score: number | null;
  notes: string;
  starred: boolean;
  kind: "real";
};

/** Export rows for the library: approved/starred REAL samples ONLY (dry-runs excluded). */
export function exportApprovedSamples(samples: StyleSample[]): ApprovedExportRow[] {
  return approvedLibrary(samples).map((s) => ({
    id: s.id,
    name: sampleName(s),
    category: s.category,
    placement: CATEGORY_META[s.category]?.placement ?? "any",
    personality: s.personality ?? "",
    imageUrl: s.imageUrl,
    prompt: s.prompt,
    model: s.model,
    provider: s.provider,
    score: overallScore(s.scores),
    notes: s.note ?? "",
    starred: s.closest,
    kind: "real",
  }));
}

// ── Save approved samples into the candidate library (V3.7.2) ─────────────────
// Approved/starred REAL Style Lab samples become normal AssetCandidates so they flow
// through the existing Review → export pipeline. Samples stay for calibration; this
// just mirrors the good ones into the library. Dry-runs are never saved.

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).slice(0, 6);
}

/** Map one Style Lab sample to an AssetCandidate (status from the sample, or overridden). */
export function sampleToCandidate(s: StyleSample, statusOverride?: AssetStatus): AssetCandidate {
  const meta = CATEGORY_META[s.category];
  const name = sampleName(s);
  const slug = `${slugify(name)}-${shortHash(s.id)}`;
  const status: AssetStatus = statusOverride ?? (s.decision === "approved" ? "approved" : "needs_review");
  const now = new Date().toISOString();
  const tags = Array.from(new Set([
    s.personality?.toLowerCase(),
    meta.group,
    s.category,
  ].filter((t): t is string => !!t)));
  return {
    id: `sl-${s.id}`,
    name,
    slug,
    category: s.category,
    pack: "style-lab",
    status,
    imageUrl: s.imageUrl,
    prompt: s.prompt,
    negativePrompt: "",
    modelProvider: s.provider,
    modelName: s.model,
    seed: s.seed,
    width: 1024,
    height: 1024,
    transparent: false, // raw provider render — background removal is a later step
    tags,
    compatibleZones: meta.compatibleZones,
    placementType: meta.placement,
    defaultScale: meta.defaultScale,
    defaultActionType: meta.defaultActionType,
    styleScore: overallScore(s.scores) ?? 0,
    qualityNotes: s.note || "Saved from Style Lab (real provider render).",
    reviewer: "style-lab",
    reviewedAt: now,
    personality: s.personality,
    source: "style_lab",
    sourceSampleId: s.id,
    createdAt: now,
  };
}

/**
 * The NEW candidates to add for the approved library: approved/starred REAL samples
 * that aren't already saved. Dedupe by sample id, candidate id, AND imageUrl (so the
 * same image is never saved twice, but a different render of the same item can be).
 */
export function approvedSamplesToCandidates(
  samples: StyleSample[],
  existing: AssetCandidate[],
  statusOverride?: AssetStatus,
): AssetCandidate[] {
  const savedSampleIds = new Set(existing.map((c) => c.sourceSampleId).filter((x): x is string => !!x));
  const ids = new Set(existing.map((c) => c.id));
  const urls = new Set(existing.map((c) => c.imageUrl));
  const out: AssetCandidate[] = [];
  for (const s of approvedLibrary(samples)) {
    const cand = sampleToCandidate(s, statusOverride);
    if (savedSampleIds.has(s.id) || ids.has(cand.id) || urls.has(s.imageUrl)) continue;
    out.push(cand);
    savedSampleIds.add(s.id);
    ids.add(cand.id);
    urls.add(s.imageUrl);
  }
  return out;
}

/** True when a sample already has a saved candidate (by sample id). */
export function isSampleSaved(s: StyleSample, candidates: AssetCandidate[]): boolean {
  return candidates.some((c) => c.sourceSampleId === s.id);
}

/** Candidates that originated from the Style Lab. */
export function savedFromStyleLab(candidates: AssetCandidate[]): AssetCandidate[] {
  return candidates.filter((c) => c.source === "style_lab");
}

/** Per-category counts for a set of candidates (for the library stats). */
export function categoryCounts(candidates: AssetCandidate[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of candidates) out[c.category] = (out[c.category] ?? 0) + 1;
  return out;
}

export { STYLE_FAMILIES };
