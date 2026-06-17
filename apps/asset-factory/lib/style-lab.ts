import { type FactoryCategory, type StyleSample } from "@/lib/types";
import { buildPrompt, STYLE_ID } from "@/lib/prompts";
import { slugify } from "@/lib/slug";

// Style Lab (V3.1, Golden Style Pack). Pure helpers to generate, score, and decide
// among style-calibration variations. The goal is to choose ONE visual identity
// (Nestudio Premium Game Style V1) before scaling generation — quality over
// quantity. No catalog writes; samples live in their own local store.

export type GoldenItem = {
  key: string;
  label: string;
  category: FactoryCategory;
  subject: string;
};

/** The ten golden items to calibrate the style against. */
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

/**
 * Build N variation samples for a golden item. `imageUrls` supplies real generated
 * images; when omitted (dry-run) placeholders are used so the workflow runs at zero
 * cost. Deterministic id per (item, variation, batch).
 */
export function buildStyleSamples(
  item: GoldenItem,
  options: { count?: number; imageUrls?: (string | null | undefined)[]; batch?: string } = {},
): StyleSample[] {
  const count = options.count ?? VARIATIONS_PER_ITEM;
  const batch = options.batch ?? Date.now().toString(36);
  const prompt = buildPrompt(item.category, { subject: item.subject });
  const out: StyleSample[] = [];
  for (let i = 0; i < count; i += 1) {
    const url = options.imageUrls?.[i];
    out.push({
      id: `style-${slugify(item.key)}-${batch}-${i}`,
      itemKey: item.key,
      category: item.category,
      subject: item.subject,
      styleId: STYLE_ID,
      variation: i,
      prompt,
      imageUrl: url ?? `/samples/style-${item.key}-${i}.png`,
      seed: i + 1,
      decision: "pending",
      closest: false,
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/** Apply an approve/reject decision to a sample (pure). */
export function decideSample(samples: StyleSample[], id: string, decision: StyleSample["decision"]): StyleSample[] {
  return samples.map((s) => (s.id === id ? { ...s, decision } : s));
}

/** Mark a sample as the closest to Nestudio — exactly one per item (pure). */
export function markClosest(samples: StyleSample[], id: string): StyleSample[] {
  const target = samples.find((s) => s.id === id);
  if (!target) return samples;
  return samples.map((s) => {
    if (s.itemKey !== target.itemKey) return s;
    return { ...s, closest: s.id === id ? !s.closest : false };
  });
}

export type ItemScore = {
  key: string;
  label: string;
  generated: number;
  approved: number;
  rejected: number;
  hasClosest: boolean;
  /** Calibrated = has at least one approved variation AND a chosen closest pick. */
  calibrated: boolean;
};

export type StyleLabScore = {
  items: ItemScore[];
  itemsCalibrated: number;
  itemsTotal: number;
  /** 0–100: share of golden items that are calibrated. */
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

/** The chosen golden reference (closest sample) per item, where one exists. */
export function goldenPicks(samples: StyleSample[]): StyleSample[] {
  return GOLDEN_ITEMS.map((item) => samples.find((s) => s.itemKey === item.key && s.closest)).filter(
    (s): s is StyleSample => !!s,
  );
}
