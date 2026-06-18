import { type StyleSample } from "@/lib/types";
import { buildStyledPrompt, DEFAULT_STYLE_FAMILY } from "@/lib/styles";
import { type SampleMeta } from "@/lib/style-lab";
import { slugify } from "@/lib/slug";

// Sofa DNA Discovery (V3.5 → V3.6). A sofa-ONLY experiment to discover and STRENGTHEN
// the Nestudio visual DNA. V3.6 goals (no rendering/camera/transparency/isolation/
// lighting changes):
//   • Increase SILHOUETTE diversity so the personality is readable from shape alone,
//     before colour or material.
//   • Introduce PERSONALITY DNA — ten lifestyle groups that influence shape language,
//     materials, accent colours, and details (never props / scenes / extra objects).
//   • A DNA STRESS TEST: 5 "safe" personalities + 5 "bold" personalities that push
//     uniqueness while staying recognizably Nestudio.
//
// Personality lives ONLY in the per-variation subject; the camera, transparency,
// object isolation, and the shared DNA (incl. the signature shape language) are
// untouched. Samples flow through the existing nestudio_v2 calibration workflow as
// StyleSamples under itemKey "sofa". OpenAI GPT Image is the only provider.

export const SOFA_ITEM_KEY = "sofa";
export const SOFA_CATEGORY = "sofa" as const;
/** This experiment is OpenAI-only by constraint. */
export const SOFA_DNA_PROVIDER = "openai";

/** The ten Nestudio lifestyle personality groups (shared world, different lifestyles). */
export type PersonalityGroup =
  | "Creator" | "Musician" | "Gamer" | "Artist" | "Explorer"
  | "Reader" | "Minimalist" | "Collector" | "Dreamer" | "Adventurer";

export const PERSONALITY_GROUPS: PersonalityGroup[] = [
  "Creator", "Musician", "Gamer", "Artist", "Explorer",
  "Reader", "Minimalist", "Collector", "Dreamer", "Adventurer",
];

/** DNA stress-test tier: "safe" (restrained) or "bold" (pushes uniqueness). */
export type SofaTier = "safe" | "bold";

export type SofaVariation = {
  key: string;
  name: string;
  personality: PersonalityGroup;
  tier: SofaTier;
  /** The distinctive form — readable from silhouette alone. */
  silhouette: string;
  material: string;
  accent: string;
  /** Personality-driven details (shape/material/finish only — NEVER props or objects). */
  details: string;
  /** The subject sent to the generator — overrides the category descriptor. */
  subject: string;
};

// ── 5 SAFE personalities ─────────────────────────────────────────────────────
const SAFE: SofaVariation[] = [
  {
    key: "minimalist-lounge", name: "Minimalist Lounge", personality: "Minimalist", tier: "safe",
    silhouette: "long, low, single unbroken horizontal line", material: "light oak + flat wool cushions", accent: "soft sage",
    details: "slim recessed legs, clean seamless edges",
    subject: "a single two-seat sofa with a long, low, unbroken horizontal silhouette and slim recessed legs, light oak frame with flat wool cushions in muted tones, a soft sage accent, calm and minimal",
  },
  {
    key: "reader-nook", name: "Reader's Nook", personality: "Reader", tier: "safe",
    silhouette: "tall enveloping curved wrap-around back forming a snug nook", material: "warm boucle", accent: "caramel",
    details: "high rounded wrapping back, soft inner curve",
    subject: "a single two-seat sofa with a tall, gently enveloping curved back that wraps around the seat into a snug reading nook, warm boucle upholstery, a caramel accent, cozy and quiet",
  },
  {
    key: "dreamer-cloud", name: "Dreamer Cloud", personality: "Dreamer", tier: "safe",
    silhouette: "plump pillowy rounded cloud mass with no hard edges", material: "cream boucle", accent: "dusty lilac",
    details: "soft billowing rounded volumes",
    subject: "a single two-seat sofa shaped like a plump pillowy cloud with soft billowing rounded volumes and no hard edges, cream boucle upholstery, a dusty-lilac accent, soft and dreamy",
  },
  {
    key: "musician-loft", name: "Musician Loft", personality: "Musician", tier: "safe",
    silhouette: "relaxed low retro lounge, wide splayed seat, tapered legs", material: "cognac soft leather + walnut", accent: "mustard",
    details: "laid-back reclined back angle, warm loft feel",
    subject: "a single two-seat sofa with a relaxed low retro-lounge profile, a wide splayed seat, a laid-back reclined back and tapered walnut legs, cognac soft-leather upholstery, a mustard accent, warm and easygoing",
  },
  {
    key: "explorer-camp", name: "Explorer Camp", personality: "Explorer", tier: "safe",
    silhouette: "chunky rounded modular block with a sturdy grounded stance", material: "rugged woven canvas + oak", accent: "rust orange",
    details: "robust rounded chunky form, grounded base",
    subject: "a single two-seat sofa with a chunky, rounded, sturdy modular silhouette and a grounded stance, rugged woven-canvas upholstery with oak detailing, a rust-orange accent, robust and welcoming",
  },
];

// ── 5 BOLD personalities ─────────────────────────────────────────────────────
const BOLD: SofaVariation[] = [
  {
    key: "creator-float", name: "Creator Float", personality: "Creator", tier: "bold",
    silhouette: "cushion blocks lifted on a slim recessed under-frame so the seat appears to float", material: "felt blocks", accent: "teal",
    details: "floating modular blocks, gentle rounded corners, slim recessed under-frame",
    subject: "a single two-seat sofa made of soft felt cushion blocks lifted on a slim recessed under-frame so the seat appears to float, gentle rounded corners, a teal accent, modern and inventive",
  },
  {
    key: "artist-gallery", name: "Artist Gallery", personality: "Artist", tier: "bold",
    silhouette: "sculptural asymmetrical form with one sweeping high arm", material: "matte ceramic-like shell + boucle seat", accent: "cobalt",
    details: "asymmetrical single sweeping arm, gallery-piece curves",
    subject: "a single two-seat sofa as a sculptural asymmetrical piece with one dramatically sweeping high arm and elegant gallery curves, a matte ceramic-like shell with a boucle seat, a cobalt accent, expressive and artistic",
  },
  {
    key: "collector-tete", name: "Collector Tête", personality: "Collector", tier: "bold",
    silhouette: "serpentine S-curve conversation seat where the two ends face opposite ways", material: "velvet", accent: "emerald",
    details: "single connected S-curved seat-back, retro conversation form",
    subject: "a single connected two-seat conversation sofa with a serpentine S-curved seat-back whose two ends face opposite directions, soft velvet upholstery, an emerald accent, retro and characterful, one continuous piece",
  },
  {
    key: "gamer-pod", name: "Gamer Pod", personality: "Gamer", tier: "bold",
    silhouette: "reclined bucket pod with a high wrapping wing back and integrated headrest curve", material: "matte technical fabric + soft leather", accent: "electric violet",
    details: "reclined pod shell, high wing back, integrated curved headrest",
    subject: "a single two-seat sofa as a reclined bucket-pod shell with a high wrapping wing back and an integrated curved headrest, matte technical fabric with soft-leather panels, an electric-violet accent, immersive and focused",
  },
  {
    key: "adventurer-pebble", name: "Adventurer Pebble", personality: "Adventurer", tier: "bold",
    silhouette: "monolithic organic pebble mass, low, wide, smooth and continuous", material: "matte microfibre", accent: "clay terracotta",
    details: "single continuous organic pebble surface",
    subject: "a single two-seat sofa shaped like a monolithic organic pebble — low, wide, smooth and continuous with one flowing surface, matte microfibre upholstery, a clay-terracotta accent, grounded and adventurous",
  },
];

/**
 * Ten sofa personalities (5 safe + 5 bold). Each varies silhouette / material /
 * accent / character so no two are clones, while the shared DNA + signature shape
 * language keep them in one world.
 */
export const SOFA_VARIATIONS: SofaVariation[] = [...SAFE, ...BOLD];

export function safeVariations(): SofaVariation[] {
  return SOFA_VARIATIONS.filter((v) => v.tier === "safe");
}
export function boldVariations(): SofaVariation[] {
  return SOFA_VARIATIONS.filter((v) => v.tier === "bold");
}

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
    // Label encodes "Name · Personality · tier" for display; the prompt uses only the subject.
    subject: `${v.name} · ${v.personality} · ${v.tier} — ${v.subject}`,
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
