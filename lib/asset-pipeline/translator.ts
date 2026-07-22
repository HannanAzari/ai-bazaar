/**
 * lib/asset-pipeline/translator.ts — the Nestudio Translator.
 * -----------------------------------------------------------------------------
 * Founder Edition. The user says WHAT they want in plain language; the Translator
 * decides HOW it belongs in Nestudio — mapping free text into a structured spec that
 * inherits the frozen DNA (classes, material families, pose, interaction patterns,
 * brand-neutral Beta policy). The founder reviews + may edit this spec BEFORE spending.
 *
 * The raw system prompt is never exposed in the UI; intent is translated into DNA first,
 * so wording can't bypass the Nestudio visual language.
 *
 * PURE TYPES + a small prompt builder. The LLM call lives in app/api/ai/translate.
 */

import type { MaterialFamily } from "./materials";

/** The four Alphabet classes. */
export type NestClass = "Story" | "Identity" | "Portal" | "Memory";
/** The five visual roles (Grammar). */
export type VisualRole = "Hero" | "Supporting" | "Atmosphere" | "Memory" | "Background";
/** The 8 interaction patterns (+ static). */
export type Interaction = "SCREEN" | "OPEN" | "BOOK" | "DRAWER" | "DISPLAY" | "PLAY" | "EXAMINE" | "TOGGLE" | "static";
/** Surface channel types an object can expose. */
export type SurfaceCapability = "none" | "link-grid" | "gallery" | "video" | "feed" | "player" | "product" | "story" | "profile";
/** Where it lives. */
export type PlacementType = "floor" | "surface" | "wall" | "floor-or-surface";

/** The structured, DNA-aligned interpretation shown to the founder before generating. */
export type NestudioSpec = {
  /** Clean display name. */
  name: string;
  objectClass: NestClass;
  /** Discovery tags (the "creator tags"). */
  tags: string[];
  /** Material families (primary first). */
  materials: MaterialFamily[];
  /** Canonical pose — always the one Nestudio camera; described for the founder. */
  canonicalPose: string;
  visualRole: VisualRole;
  interaction: Interaction;
  surface: SurfaceCapability;
  placement: PlacementType;
  /** Estimated USD generation cost (reference + asset). */
  estimatedCostUsd: number;
  /** Brand-neutrality read of the request. */
  brandNeutral: { ok: boolean; note: string };
  /** Safety/moderation read of the request. */
  moderation: { ok: boolean; note: string };
  /** The clean subject string handed to the generation pipeline (brand-neutral). */
  generationSubject: string;
};

/** Cost model (matches the live pipeline): a studio reference (~$0.17) + an asset (~$0.28). */
export const COST_REFERENCE = 0.17;
export const COST_ASSET = 0.28;
export function estimateCost(hasUploadedReference: boolean): number {
  return Math.round(((hasUploadedReference ? 0 : COST_REFERENCE) + COST_ASSET) * 100) / 100;
}

/**
 * The system instruction for the translation model. Enumerates the ONLY allowed vocabulary
 * so the output always inherits the Nestudio DNA. Not shown to the user.
 */
export function buildTranslatorSystemPrompt(): string {
  return [
    "You are the Nestudio Translator. Turn a user's plain-language object request into a STRICT JSON spec for the Nestudio asset pipeline. The user says WHAT; you decide HOW it belongs in Nestudio.",
    "Return ONLY JSON matching this shape (no prose):",
    '{ "name": string, "objectClass": "Story|Identity|Portal|Memory", "tags": string[], "materials": string[], "canonicalPose": string, "visualRole": "Hero|Supporting|Atmosphere|Memory|Background", "interaction": "SCREEN|OPEN|BOOK|DRAWER|DISPLAY|PLAY|EXAMINE|TOGGLE|static", "surface": "none|link-grid|gallery|video|feed|player|product|story|profile", "placement": "floor|surface|wall|floor-or-surface", "brandNeutral": {"ok": boolean, "note": string}, "moderation": {"ok": boolean, "note": string}, "generationSubject": string }',
    "materials MUST be from: timber, matte-metal, warm-metal, polymer, screen, glass, ceramic, fabric, leather, paper, rubber, greenery.",
    "Class guide: Story = furniture/atmosphere; Identity = the 'I am a ___' objects (cameras, instruments, consoles); Portal = interactive screens/surfaces; Memory = keepsakes.",
    "canonicalPose: always the one Nestudio camera — a front-facing, slightly-elevated view. Describe briefly (e.g. 'front-facing, slightly elevated').",
    "BRAND POLICY (Beta): the object must be generic. If the request names or implies a real brand/product (MacBook, iPhone, PS5, Fender, Nike, Canon…), set brandNeutral.ok=false with a short note, and rewrite generationSubject to a clean brand-neutral description (keep the category, drop the brand).",
    "moderation: flag disallowed/unsafe requests (weapons designed to harm, explicit content, hateful symbols) with ok=false; otherwise ok=true.",
    "generationSubject: a concise, brand-neutral noun phrase for the image model (e.g. 'a modern acoustic guitar with a warm timber body').",
  ].join("\n");
}
