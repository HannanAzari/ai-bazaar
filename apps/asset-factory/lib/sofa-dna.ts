import { type StyleSample } from "@/lib/types";
import { buildStyledPrompt, DEFAULT_STYLE_FAMILY } from "@/lib/styles";
import { type SampleMeta } from "@/lib/style-lab";
import { slugify } from "@/lib/slug";

// Sofa DNA Discovery (V3.5). A sofa-ONLY experiment to discover the Nestudio visual
// DNA: ten sofa personalities that all share the same identity (the DNA folded into
// nestudio_v2) but differ in silhouette, material, colour, and character — "same
// world, different personality". Personality lives ONLY in the per-variation subject;
// the camera, transparency, object isolation, and DNA are untouched and shared.
//
// These samples flow through the existing nestudio_v2 calibration workflow: they are
// ordinary StyleSamples under itemKey "sofa", so they appear in the Sofa panel and
// feed the calibration score / report. OpenAI GPT Image is the only provider.

export const SOFA_ITEM_KEY = "sofa";
export const SOFA_CATEGORY = "sofa" as const;
/** This experiment is OpenAI-only by constraint. */
export const SOFA_DNA_PROVIDER = "openai";

export type SofaVariation = {
  key: string;
  name: string;
  silhouette: string;
  material: string;
  color: string;
  personality: string;
  /** The subject sent to the generator — overrides the category descriptor. */
  subject: string;
};

/**
 * Ten sofa personalities. Each varies silhouette / material / colour / character so
 * no two are clones, while the shared DNA (Scandinavian, soft rounded geometry, warm
 * cohesive palette, one lighting signature) keeps them in one world.
 */
export const SOFA_VARIATIONS: SofaVariation[] = [
  {
    key: "scandi-oak", name: "Scandi Oak",
    silhouette: "low-slung two-seater, slim legs", material: "oiled oak + woven wool", color: "warm oatmeal",
    personality: "calm, minimal, cozy",
    subject: "a single two-seat sofa with a low-slung profile and slim oiled-oak legs, woven wool upholstery in warm oatmeal, calm and minimal",
  },
  {
    key: "boucle-cloud", name: "Bouclé Cloud",
    silhouette: "softly rounded, tailored", material: "cream bouclé", color: "cream ivory",
    personality: "friendly, inviting",
    subject: "a single two-seat sofa with a softly rounded yet tailored silhouette, cream bouclé upholstery, friendly and inviting",
  },
  {
    key: "midcentury-walnut", name: "Mid-Century Walnut",
    silhouette: "gently angled mid-century lines, tapered legs", material: "soft leather + walnut", color: "cognac tan",
    personality: "refined, characterful",
    subject: "a single two-seat sofa with gently angled mid-century lines and tapered walnut legs, cognac soft-leather upholstery, refined and characterful",
  },
  {
    key: "modular-felt", name: "Modular Felt",
    silhouette: "clean boxy modular blocks, rounded corners", material: "felt", color: "sage green",
    personality: "modern, practical",
    subject: "a single two-seat sofa with clean boxy modular blocks and rounded corners, sage-green felt upholstery, modern and practical",
  },
  {
    key: "tubular-sage", name: "Tubular Sage",
    silhouette: "single curved tubular frame, slim cushion", material: "powder-coated steel + cushion", color: "muted sage",
    personality: "light, playful",
    subject: "a single two-seat sofa built on a single curved tubular powder-coated steel frame with a slim cushion, muted sage, light and playful",
  },
  {
    key: "cozy-terracotta", name: "Cozy Terracotta",
    silhouette: "deep soft rounded seat, plump cushions", material: "corduroy", color: "terracotta rust",
    personality: "warm, relaxed",
    subject: "a single two-seat sofa with a deep soft rounded seat and plump back cushions, terracotta corduroy upholstery, warm and relaxed",
  },
  {
    key: "slim-nordic", name: "Slim Nordic",
    silhouette: "slim track-arm, pale legs", material: "wool + ash", color: "soft grey-blue",
    personality: "understated, elegant",
    subject: "a single two-seat sofa with a slim track-arm profile and pale ash legs, soft grey-blue wool upholstery, understated and elegant",
  },
  {
    key: "pebble-lounge", name: "Pebble Lounge",
    silhouette: "organic pebble-like sculptural form", material: "matte microfibre", color: "dusty rose",
    personality: "friendly, sculptural",
    subject: "a single two-seat sofa with an organic pebble-like sculptural form, dusty-rose matte microfibre upholstery, friendly and sculptural",
  },
  {
    key: "linen-bolster", name: "Linen Bolster",
    silhouette: "low profile, rounded bolster cushions", material: "natural linen", color: "sand beige",
    personality: "airy, relaxed",
    subject: "a single low two-seat sofa with rounded bolster cushions, natural sand-beige linen upholstery, airy and relaxed",
  },
  {
    key: "accent-mustard", name: "Accent Mustard",
    silhouette: "compact, rounded arms, slim feet", material: "matte velvet + oak", color: "mustard yellow",
    personality: "bold, cheerful",
    subject: "a single compact two-seat sofa with rounded arms and slim oak feet, matte mustard-yellow velvet upholstery, bold and cheerful",
  },
];

/** The full positive prompt for one variation (shared DNA spine + personality subject). */
export function sofaVariationPrompt(v: SofaVariation): string {
  return buildStyledPrompt(SOFA_CATEGORY, DEFAULT_STYLE_FAMILY, { subject: v.subject });
}

/** All ten variation prompts (for preview + tests). */
export function buildSofaDnaPrompts(): { key: string; name: string; prompt: string }[] {
  return SOFA_VARIATIONS.map((v) => ({ key: v.key, name: v.name, prompt: sofaVariationPrompt(v) }));
}

type Opts = SampleMeta & { batch?: string };

function makeSofaSample(v: SofaVariation, index: number, imageUrl: string, batch: string, meta: SampleMeta): StyleSample {
  const provider = meta.provider ?? SOFA_DNA_PROVIDER;
  return {
    id: `sofa-dna-${slugify(v.key)}-${provider}-${batch}-${index}`,
    itemKey: SOFA_ITEM_KEY,
    category: SOFA_CATEGORY,
    // The personality NAME is prefixed for display; the prompt itself uses only the subject.
    subject: `${v.name} — ${v.subject}`,
    styleId: DEFAULT_STYLE_FAMILY,
    provider,
    model: meta.model ?? "",
    variation: index,
    prompt: sofaVariationPrompt(v),
    imageUrl,
    seed: index + 1,
    decision: "pending",
    closest: false,
    createdAt: new Date().toISOString(),
  };
}

/** Build one real sample for a variation (used incrementally during generation). */
export function sofaDnaSample(v: SofaVariation, index: number, imageUrl: string, options: Opts = {}): StyleSample {
  return makeSofaSample(v, index, imageUrl, options.batch ?? Date.now().toString(36), options);
}

/** Ten dry-run placeholder samples (zero cost) for workflow testing. */
export function dryRunSofaDnaSamples(options: Opts = {}): StyleSample[] {
  const batch = options.batch ?? Date.now().toString(36);
  const provider = options.provider ?? SOFA_DNA_PROVIDER;
  return SOFA_VARIATIONS.map((v, i) => makeSofaSample(v, i, `/samples/sofa-dna-${v.key}-${provider}.png`, batch, options));
}

/** Build real samples from generated URLs (index-aligned with SOFA_VARIATIONS; empties skipped). */
export function realSofaDnaSamples(imageUrls: (string | null | undefined)[], options: Opts = {}): StyleSample[] {
  const batch = options.batch ?? Date.now().toString(36);
  const out: StyleSample[] = [];
  SOFA_VARIATIONS.forEach((v, i) => {
    const url = imageUrls[i];
    if (typeof url === "string" && url.length > 0) out.push(makeSofaSample(v, i, url, batch, options));
  });
  return out;
}
