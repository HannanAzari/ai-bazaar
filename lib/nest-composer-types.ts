// ── Nestudio V2 — Nest Composer contract (M4) ──────────────────────────────
//
// The additive input/output contract for the **deterministic Nest Composer**: the
// engine that turns a structured creator profile + the approved catalogs (one
// NestTemplate, NestAsset[], Interaction[]) + a typed composition policy into a
// valid `ComposedNest` manifest. It SELECTS and BINDS existing approved data — it
// never generates art, coordinates, or content, never calls an AI provider, and
// never uses randomness (see docs/nest-composer-v1.md).
//
// Purely additive: this file introduces no changes to the V1 room engine
// (`lib/types.ts`) or to the locked V2 contract (`lib/nest-types.ts`). It is
// framework-independent (no React, no I/O) so the engine is unit-testable on its
// own. Masters: docs/nest-data-contract.md, docs/golden-nest-production-bible.md.

import type { ComposedNest, NestContentType } from "@/lib/nest-types";

// ── Creator profile ──────────────────────────────────────────────────────────

/**
 * The kinds of content a creator can link from their Nest. These map (via the
 * composition policy) onto the slot content-type priorities and onto
 * `NestContentType` for the eventual `NestContentBinding`.
 */
export type CreatorContentType =
  | "youtube"
  | "video"
  | "website"
  | "article"
  | "gallery"
  | "instagram"
  | "tiktok"
  | "spotify"
  | "shop"
  | "bio";

/**
 * One link/media item the creator wants surfaced. `priority` is the creator's own
 * ranking (lower number = more important); it is a deterministic tie-break signal,
 * never a source of randomness.
 */
export interface CreatorContentSource {
  id: string;
  type: CreatorContentType;
  title: string;
  url: string;
  thumbnailUrl?: string;
  /** Creator-declared importance — lower is more important. */
  priority: number;
}

/**
 * A structured creator profile — the Composer's only creator input. It carries
 * tags (creator types, personality, interests) used as deterministic scoring
 * signals, a preferred ambience, and the content sources to bind. No free-form
 * placement, no coordinates, no generated art is ever expressed here.
 */
export interface CreatorNestProfile {
  id: string;
  displayName: string;
  /** e.g. "founder", "musician", "photographer". Matched against asset tags. */
  creatorTypes: string[];
  /** e.g. "warm", "minimal". A soft scoring signal. */
  personalityTags: string[];
  /** e.g. "AI", "guitar", "travel". A soft scoring signal. */
  interests: string[];
  /** Preferred ambience preset id; falls back (with a warning) if invalid. */
  preferredAmbienceId?: string;
  contentSources: CreatorContentSource[];
  accessLevel: "public" | "followers" | "private";
}

// ── Composition policy ───────────────────────────────────────────────────────

/**
 * The per-slot content-binding rule: which slot, the creator content types it can
 * carry (in priority order — first match wins), and the `NestContentType` to stamp
 * on the resulting binding. A slot with an empty `contentPriority` (lamp/plant) is
 * ambience/decoration only and binds no creator content.
 */
export interface SlotContentRule {
  slotId: string;
  /** Creator content types this slot can host, most-preferred first. */
  contentPriority: CreatorContentType[];
  /** The contentType stamped on the bound `NestContentBinding`. */
  bindContentType: NestContentType;
}

/**
 * The typed, deterministic policy for one template. It declares which slots must /
 * may / must-not be filled, the per-slot content priorities, fallback assets, the
 * ambience fallback, and the global object cap. The policy is data — it carries no
 * logic and no randomness.
 */
export interface NestCompositionPolicy {
  templateId: string;
  /** Hard cap on active objects in the composed Nest (Golden Nest V2 = 7). */
  maxObjects: number;
  /** Slots that MUST be filled — a missing one is a composition error. */
  requiredSlotIds: string[];
  /** Slots that MAY be filled (only when a good asset+reason exists). */
  optionalSlotIds: string[];
  /** Slots the policy forbids filling (e.g. the bookshelf, read as architecture). */
  excludedSlotIds: string[];
  /** Per-slot content-binding rules (slots absent here bind no creator content). */
  contentRules: SlotContentRule[];
  /** Preferred asset id per slot when scoring ties or no better signal exists. */
  fallbackAssetBySlot: Record<string, string>;
  /** Ambience preset id used when the profile's preference is absent/invalid. */
  fallbackAmbienceId: string;
  /** Whether one asset may occupy more than one slot (default: false). */
  allowAssetReuse: boolean;
}

// ── Decision trace + result ──────────────────────────────────────────────────

/**
 * One auditable composition decision for a slot — what was selected and *why*. The
 * `reasons` are human-readable strings surfaced in the internal "Why this Nest?"
 * panel; `score` is the deterministic total used to rank the chosen asset.
 */
export interface CompositionDecision {
  slotId: string;
  assetId?: string;
  interactionId?: string;
  contentSourceId?: string;
  score: number;
  reasons: string[];
}

/**
 * The Composer's full output: the validated `ComposedNest`, the per-slot decision
 * trace, and any soft warnings (e.g. an invalid ambience preference that fell
 * back). A result is only returned `ok` when it passes `validateComposedNest`.
 */
export interface ComposeNestResult {
  nest: ComposedNest;
  decisions: CompositionDecision[];
  warnings: string[];
}

/** The inputs to `composeNest` — all approved catalogs + the policy + the profile. */
export interface ComposeNestInput {
  profile: CreatorNestProfile;
  /** The approved templates to choose from (V1 composes against exactly one). */
  templates: import("@/lib/nest-types").NestTemplate[];
  assets: import("@/lib/nest-types").NestAsset[];
  interactions: import("@/lib/nest-types").Interaction[];
  policy: NestCompositionPolicy;
}
