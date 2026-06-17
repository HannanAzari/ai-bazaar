import { type FactoryCategory, type StyleSample } from "@/lib/types";
import { buildStyledPrompt, STYLE_FAMILIES, STYLE_FAMILY_IDS, type StyleFamilyId } from "@/lib/styles";
import { slugify } from "@/lib/slug";

// Style Lab (V3.1 → V3.2 multi-style). Pure helpers to generate, score, and decide
// among style-calibration variations across THREE style families. The goal is to
// compare the same asset across visual identities and choose ONE before scaling.
// No catalog writes; samples live in their own local store.

export type GoldenItem = {
  key: string;
  label: string;
  category: FactoryCategory;
  subject: string;
};

/** The ten golden items to calibrate the styles against. */
export const GOLDEN_ITEMS: GoldenItem[] = [
  { key: "chair", label: "Chair", category: "chair", subject: "accent chair" },
  { key: "sofa", label: "Sofa", category: "sofa", subject: "two-seat sofa" },
  { key: "desk", label: "Desk", category: "desk", subject: "writing desk" },
  { key: "lamp", label: "Lamp", category: "lamp", subject: "floor lamp" },
  { key: "bookshelf", label: "Bookshelf", category: "shelf", subject: "bookshelf" },
  { key: "plant", label: "Plant", category: "plant", subject: "potted plant" },
  { key: "microphone", label: "Microphone", category: "microphone", subject: "studio microphone" },
  { key: "monitor", label: "Monitor", category: "computer", subject: "computer monitor" },
  { key: "coffee_table", label: "Coffee Table", category: "table", subject: "coffee table" },
  { key: "rug", label: "Rug", category: "rug", subject: "round rug" },
];

export const VARIATIONS_PER_ITEM = 5;

export function goldenItem(key: string): GoldenItem | undefined {
  return GOLDEN_ITEMS.find((i) => i.key === key);
}

function makeStyleSample(
  item: GoldenItem,
  styleId: StyleFamilyId,
  variation: number,
  imageUrl: string,
  prompt: string,
  batch: string,
): StyleSample {
  return {
    id: `style-${slugify(item.key)}-${styleId}-${batch}-${variation}`,
    itemKey: item.key,
    category: item.category,
    subject: item.subject,
    styleId,
    variation,
    prompt,
    imageUrl,
    seed: variation + 1,
    decision: "pending",
    closest: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build N **dry-run placeholder** variations for a golden item in a style. These
 * use `/samples/...` placeholder paths and cost nothing — used ONLY for dry runs.
 * Real generation must use {@link realStyleSamples}.
 */
export function buildStyleSamples(
  item: GoldenItem,
  styleId: StyleFamilyId,
  options: { count?: number; batch?: string } = {},
): StyleSample[] {
  const count = options.count ?? VARIATIONS_PER_ITEM;
  const batch = options.batch ?? Date.now().toString(36);
  const prompt = buildStyledPrompt(item.category, styleId, { subject: item.subject });
  return Array.from({ length: count }, (_, i) =>
    makeStyleSample(item, styleId, i, `/samples/style-${item.key}-${styleId}-${i}.png`, prompt, batch),
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
  options: { batch?: string } = {},
): StyleSample[] {
  const batch = options.batch ?? Date.now().toString(36);
  const prompt = buildStyledPrompt(item.category, styleId, { subject: item.subject });
  const urls = imageUrls.filter((u): u is string => typeof u === "string" && u.length > 0);
  return urls.map((url, i) => makeStyleSample(item, styleId, i, url, prompt, batch));
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

// ── Per-item scoring (any style) ─────────────────────────────────────────────

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

// ── Per-style scoring (V3.2 multi-style comparison) ──────────────────────────

export type StyleFamilyScore = {
  styleId: StyleFamilyId;
  generated: number;
  approved: number;
  rejected: number;
  /** Items with at least one approved variation in this style. */
  itemsApproved: number;
  /** Items where this style has a chosen closest pick. */
  closestSelections: number;
  /** Approval rate 0–100 (approved / generated). */
  score: number;
};

export type StyleComparison = {
  families: StyleFamilyScore[];
  /** Average approval-rate score across families that have output. */
  averageScore: number;
  /** Style with the most closest selections (tiebreak: approved, then score). */
  winningStyle: StyleFamilyId | null;
};

function scoreFamily(samples: StyleSample[], styleId: StyleFamilyId): StyleFamilyScore {
  const mine = samples.filter((s) => s.styleId === styleId);
  const approved = mine.filter((s) => s.decision === "approved").length;
  const itemsApproved = new Set(mine.filter((s) => s.decision === "approved").map((s) => s.itemKey)).size;
  const closestSelections = new Set(mine.filter((s) => s.closest).map((s) => s.itemKey)).size;
  return {
    styleId,
    generated: mine.length,
    approved,
    rejected: mine.filter((s) => s.decision === "rejected").length,
    itemsApproved,
    closestSelections,
    score: mine.length > 0 ? Math.round((approved / mine.length) * 100) : 0,
  };
}

export function compareStyles(samples: StyleSample[]): StyleComparison {
  const families = STYLE_FAMILY_IDS.map((id) => scoreFamily(samples, id));
  const withOutput = families.filter((f) => f.generated > 0);
  const averageScore = withOutput.length
    ? Math.round(withOutput.reduce((s, f) => s + f.score, 0) / withOutput.length)
    : 0;

  let winningStyle: StyleFamilyId | null = null;
  let best: StyleFamilyScore | null = null;
  for (const f of families) {
    if (f.closestSelections === 0 && f.approved === 0) continue;
    if (
      !best ||
      f.closestSelections > best.closestSelections ||
      (f.closestSelections === best.closestSelections && f.approved > best.approved) ||
      (f.closestSelections === best.closestSelections && f.approved === best.approved && f.score > best.score)
    ) {
      best = f;
      winningStyle = f.styleId;
    }
  }
  return { families, averageScore, winningStyle };
}

/** The chosen closest sample per (item, style). */
export function goldenPicks(samples: StyleSample[]): StyleSample[] {
  return samples.filter((s) => s.closest);
}

export { STYLE_FAMILIES };
