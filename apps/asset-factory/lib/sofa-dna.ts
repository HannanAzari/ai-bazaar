import { type FactoryCategory, type StyleSample } from "@/lib/types";
import { buildStyledPrompt, DEFAULT_STYLE_FAMILY } from "@/lib/styles";
import { type SampleMeta } from "@/lib/style-lab";
import { slugify } from "@/lib/slug";

// Nestudio DNA Lab (V3.5 → V3.7). The sofa experiment, generalized into a
// MANUFACTURER COLLECTION across multiple categories (sofa, chair, coffee table) to
// prove every product reads as one furniture family. V3.7 goal is family identity,
// NOT more silhouettes: the shared Signature Design Language (lib/prompts.ts
// NESTUDIO_SIGNATURE, folded into the DNA) does the heavy lifting; here we keep the
// ten lifestyle personalities (5 safe + 5 bold) and express each as a sofa, a chair,
// and a coffee table — same accent, same character, same line, category-appropriate
// form. Camera / transparency / isolation / lighting / calibration workflow unchanged.
// OpenAI GPT Image only. Samples are StyleSamples under the category's golden itemKey.

export const DNA_PROVIDER = "openai";

/** The ten Nestudio lifestyle personality groups (shared world, different lifestyles). */
export type PersonalityGroup =
  | "Creator" | "Musician" | "Gamer" | "Artist" | "Explorer"
  | "Reader" | "Minimalist" | "Collector" | "Dreamer" | "Adventurer";

export const PERSONALITY_GROUPS: PersonalityGroup[] = [
  "Minimalist", "Reader", "Dreamer", "Musician", "Explorer",
  "Creator", "Artist", "Collector", "Gamer", "Adventurer",
];

/** DNA stress-test tier: "safe" (restrained) or "bold" (pushes uniqueness). */
export type Tier = "safe" | "bold";

/** A lifestyle line, consistent across every category (accent + character + tier). */
export type Personality = { group: PersonalityGroup; tier: Tier; accent: string; character: string };

export const PERSONALITIES: Personality[] = [
  { group: "Minimalist", tier: "safe", accent: "soft sage", character: "calm and minimal" },
  { group: "Reader", tier: "safe", accent: "caramel", character: "cozy and quiet" },
  { group: "Dreamer", tier: "safe", accent: "dusty lilac", character: "soft and dreamy" },
  { group: "Musician", tier: "safe", accent: "mustard", character: "warm and easygoing" },
  { group: "Explorer", tier: "safe", accent: "rust orange", character: "robust and welcoming" },
  { group: "Creator", tier: "bold", accent: "teal", character: "modern and inventive" },
  { group: "Artist", tier: "bold", accent: "cobalt", character: "expressive and artistic" },
  { group: "Collector", tier: "bold", accent: "emerald", character: "retro and characterful" },
  { group: "Gamer", tier: "bold", accent: "electric violet", character: "immersive and focused" },
  { group: "Adventurer", tier: "bold", accent: "clay terracotta", character: "grounded and adventurous" },
];

/** The categories in the manufacturer collection (the V3.7 manufacturer test). */
export type CollectionCategory = {
  /** Golden-item key the samples land under (drives the calibration panel). */
  goldenKey: string;
  /** The FactoryCategory used for generation/prompting. */
  category: FactoryCategory;
  noun: string;
  label: string;
};

export const COLLECTION: CollectionCategory[] = [
  { goldenKey: "sofa", category: "sofa", noun: "two-seat sofa", label: "Sofa" },
  { goldenKey: "chair", category: "chair", noun: "accent chair", label: "Chair" },
  { goldenKey: "coffee_table", category: "table", noun: "coffee table", label: "Coffee Table" },
];

export const COLLECTION_KEYS: string[] = COLLECTION.map((c) => c.goldenKey);

export function collectionCategory(goldenKey: string): CollectionCategory {
  return COLLECTION.find((c) => c.goldenKey === goldenKey) ?? COLLECTION[0];
}

// Per-(category, personality) FORM — the only thing that varies by category. The
// accent + character + tier come from the personality (line consistency); the form +
// material are category-appropriate. Phrased so the noun is never duplicated.
type Form = { silhouette: string; form: string; material: string };

const SOFA_FORMS: Record<PersonalityGroup, Form> = {
  Minimalist: { silhouette: "long low unbroken horizontal", form: "with a long, low, unbroken horizontal silhouette and slim recessed legs", material: "light oak with flat wool cushions" },
  Reader: { silhouette: "tall wrap-around nook back", form: "with a tall, gently enveloping curved back that wraps into a snug nook", material: "warm boucle with oak feet" },
  Dreamer: { silhouette: "plump pillowy cloud", form: "shaped like a plump pillowy cloud with soft billowing rounded volumes", material: "cream boucle" },
  Musician: { silhouette: "low retro lounge, splayed seat", form: "with a low retro-lounge profile, a wide splayed seat and tapered walnut legs", material: "cognac soft leather" },
  Explorer: { silhouette: "chunky sturdy modular", form: "with a chunky, rounded, sturdy modular silhouette and a grounded stance", material: "rugged woven canvas with oak" },
  Creator: { silhouette: "floating modular blocks", form: "made of soft cushion blocks lifted on a slim recessed under-frame so it appears to float, with gentle rounded corners", material: "soft felt" },
  Artist: { silhouette: "asymmetrical sweeping arm", form: "as a sculptural asymmetrical piece with one sweeping high arm and elegant curves", material: "a matte ceramic-like shell with a boucle seat" },
  Collector: { silhouette: "serpentine S-curve conversation", form: "with a serpentine S-curved seat-back as one continuous conversation piece", material: "soft velvet with walnut feet" },
  Gamer: { silhouette: "reclined pod, high wing back", form: "as a reclined bucket-pod shell with a high wrapping wing back and an integrated curved headrest", material: "matte technical fabric with soft-leather panels" },
  Adventurer: { silhouette: "monolithic organic pebble", form: "shaped like a monolithic organic pebble, low and wide with one flowing surface", material: "matte microfibre" },
};

const CHAIR_FORMS: Record<PersonalityGroup, Form> = {
  Minimalist: { silhouette: "slim low-back, slim legs", form: "with a slim low back, clean unbroken lines and slim oak legs", material: "light oak with a flat wool seat" },
  Reader: { silhouette: "high wrapping wingback nook", form: "with a high, gently wrapping wingback that curves into a cozy nook", material: "warm boucle with oak feet" },
  Dreamer: { silhouette: "plump rounded bucket", form: "with a plump, rounded, pillowy bucket form and soft volumes", material: "cream boucle" },
  Musician: { silhouette: "low retro lounge, tapered legs", form: "with a low retro-lounge profile, a splayed seat and tapered walnut legs", material: "cognac soft leather" },
  Explorer: { silhouette: "chunky sturdy armchair", form: "with a chunky, sturdy, rounded armchair profile and a grounded stance", material: "rugged woven canvas with oak" },
  Creator: { silhouette: "floating seat shell", form: "with a rounded seat shell lifted on a slim recessed under-frame so it appears to float", material: "soft felt" },
  Artist: { silhouette: "asymmetrical sweeping backrest", form: "as a sculptural asymmetrical seat with one sweeping curved backrest", material: "a matte ceramic-like shell with a boucle seat" },
  Collector: { silhouette: "curved retro tub", form: "with a curved retro tub profile and a continuous wrapping backrest", material: "soft velvet with walnut feet" },
  Gamer: { silhouette: "reclined pod, high wing back", form: "with a reclined bucket-pod shell, a high wrapping wing back and an integrated headrest", material: "matte technical fabric with soft-leather panels" },
  Adventurer: { silhouette: "monolithic organic pebble", form: "shaped like a smooth monolithic organic pebble with one flowing surface", material: "matte microfibre" },
};

const TABLE_FORMS: Record<PersonalityGroup, Form> = {
  Minimalist: { silhouette: "long low rectangle, slim legs", form: "with a long, low rectangular top, softly rounded corners and slim oak legs", material: "oiled oak with a soft matte top" },
  Reader: { silhouette: "round top, lower shelf", form: "with a round top, softly rounded edges and a gentle lower shelf", material: "warm oak with a soft matte top" },
  Dreamer: { silhouette: "cloud-shaped top, curved foot", form: "with a soft, rounded cloud-shaped top over a gently curved rounded foot", material: "pale oak with a matte finish" },
  Musician: { silhouette: "low retro oval, splayed legs", form: "with a low retro oval top and tapered, splayed walnut legs", material: "walnut with a soft matte top" },
  Explorer: { silhouette: "chunky sturdy block", form: "with a chunky, rounded, sturdy block form and a grounded stance", material: "solid oak with a matte top" },
  Creator: { silhouette: "floating top", form: "with a rounded rectangular top lifted on a slim recessed under-frame so it appears to float", material: "oak with a soft matte top" },
  Artist: { silhouette: "asymmetrical free-form top", form: "as a sculptural asymmetrical free-form top with elegant curved edges", material: "a matte ceramic-like top on an oak frame" },
  Collector: { silhouette: "curved kidney retro top", form: "with a curved kidney-shaped retro top and softened edges", material: "walnut with a soft matte top" },
  Gamer: { silhouette: "low hexagonal, recessed channel", form: "with a low rounded hexagonal top and a recessed channel detail", material: "a matte technical-finish top on an oak frame" },
  Adventurer: { silhouette: "monolithic organic pebble", form: "shaped like a smooth monolithic organic pebble, low and solid", material: "a matte stone-like top on an oak frame" },
};

const FORMS: Record<string, Record<PersonalityGroup, Form>> = {
  sofa: SOFA_FORMS,
  chair: CHAIR_FORMS,
  coffee_table: TABLE_FORMS,
};

export type Variant = {
  key: string;
  itemKey: string;
  category: FactoryCategory;
  categoryLabel: string;
  name: string;
  personality: PersonalityGroup;
  tier: Tier;
  accent: string;
  silhouette: string;
  material: string;
  subject: string;
};

function buildVariant(c: CollectionCategory, p: Personality): Variant {
  const f = FORMS[c.goldenKey][p.group];
  const subject = `a single ${c.noun} ${f.form}, ${f.material}, a ${p.accent} accent, ${p.character}`;
  return {
    key: `${c.goldenKey}-${slugify(p.group)}`,
    itemKey: c.goldenKey,
    category: c.category,
    categoryLabel: c.label,
    name: `${p.group} ${c.label}`,
    personality: p.group,
    tier: p.tier,
    accent: p.accent,
    silhouette: f.silhouette,
    material: f.material,
    subject,
  };
}

/** The ten variants (5 safe + 5 bold) for a collection category. */
export function variantsForCategory(goldenKey: string): Variant[] {
  const c = collectionCategory(goldenKey);
  return PERSONALITIES.map((p) => buildVariant(c, p));
}

export function safeVariants(goldenKey: string): Variant[] {
  return variantsForCategory(goldenKey).filter((v) => v.tier === "safe");
}
export function boldVariants(goldenKey: string): Variant[] {
  return variantsForCategory(goldenKey).filter((v) => v.tier === "bold");
}

/** The full positive prompt for one variant (shared DNA spine + personality subject). */
export function variantPrompt(v: Variant): string {
  return buildStyledPrompt(v.category, DEFAULT_STYLE_FAMILY, { subject: v.subject });
}

/** All ten variant prompts for a category (for preview + tests). */
export function buildDnaPrompts(goldenKey: string): { key: string; name: string; prompt: string }[] {
  return variantsForCategory(goldenKey).map((v) => ({ key: v.key, name: v.name, prompt: variantPrompt(v) }));
}

type Opts = SampleMeta & { batch?: string };

function makeSample(v: Variant, index: number, imageUrl: string, batch: string, meta: SampleMeta): StyleSample {
  const provider = meta.provider ?? DNA_PROVIDER;
  return {
    id: `dna-${v.key}-${provider}-${batch}-${index}`,
    itemKey: v.itemKey,
    category: v.category,
    // Label encodes "Personality Category · tier" for display; the prompt uses only the subject.
    subject: `${v.personality} ${v.categoryLabel} · ${v.tier} — ${v.subject}`,
    styleId: DEFAULT_STYLE_FAMILY,
    provider,
    model: meta.model ?? "",
    variation: index,
    prompt: variantPrompt(v),
    imageUrl,
    seed: index + 1,
    decision: "pending",
    closest: false,
    createdAt: new Date().toISOString(),
  };
}

/** Build one real sample for a variant (used incrementally during generation). */
export function dnaSample(v: Variant, index: number, imageUrl: string, options: Opts = {}): StyleSample {
  return makeSample(v, index, imageUrl, options.batch ?? Date.now().toString(36), options);
}

/** Ten dry-run placeholder samples (zero cost) for a category. */
export function dryRunDnaSamples(goldenKey: string, options: Opts = {}): StyleSample[] {
  const batch = options.batch ?? Date.now().toString(36);
  const provider = options.provider ?? DNA_PROVIDER;
  return variantsForCategory(goldenKey).map((v, i) => makeSample(v, i, `/samples/dna-${v.key}-${provider}.png`, batch, options));
}

/** Build real samples for a category from generated URLs (index-aligned; empties skipped). */
export function realDnaSamples(goldenKey: string, imageUrls: (string | null | undefined)[], options: Opts = {}): StyleSample[] {
  const batch = options.batch ?? Date.now().toString(36);
  const variants = variantsForCategory(goldenKey);
  const out: StyleSample[] = [];
  variants.forEach((v, i) => {
    const url = imageUrls[i];
    if (typeof url === "string" && url.length > 0) out.push(makeSample(v, i, url, batch, options));
  });
  return out;
}
