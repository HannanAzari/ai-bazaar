// ── Nestudio V2 — deterministic Nest Composer (M4) ──────────────────────────
//
// The smallest production-quality deterministic Nest Composer. Given a structured
// creator profile + the approved catalogs (one NestTemplate, NestAsset[],
// Interaction[]) + a typed composition policy, it returns a validated
// `ComposedNest` manifest by SELECTING and BINDING existing approved data.
//
// HARD GUARANTEES (enforced by code + tests, see docs/nest-composer-v1.md):
//   • No AI/provider call, no network, no image generation — pure data in/out.
//   • No `Math.random`, no `Date.now()`, no timestamps — same input ⇒ same output.
//   • No coordinate generation — Scene Slots own all geometry; we only choose which
//     approved, compatible asset snaps into each slot.
//   • No Supabase / persistence, no mutation of inputs.
//   • Never places an incompatible or unapproved asset; a hard failure throws a
//     clear error rather than silently degrading.
//
// Additive: consumes the locked V2 contract (`lib/nest-types.ts`) + the Composer
// contract (`lib/nest-composer-types.ts`). Touches no V1 code and never alters the
// locked Golden Nest art, slots, or camera.

import type {
  ComposedNest,
  Interaction,
  NestAccessLevel,
  NestAsset,
  NestContentBinding,
  NestQuickLink,
  NestTemplate,
  SceneSlot,
  SlotAssignment,
} from "@/lib/nest-types";
import { isSlotCompatible, resolveInteractionId, validateComposedNest } from "@/lib/nest-types";
import type {
  ComposeNestInput,
  ComposeNestResult,
  CompositionDecision,
  CreatorContentSource,
  CreatorNestProfile,
  NestCompositionPolicy,
  SlotContentRule,
} from "@/lib/nest-composer-types";

/**
 * A hard composition failure (missing template, an unfillable required slot, or a
 * result that fails `validateComposedNest`). Thrown — never returned as a
 * successful result — so callers cannot mistake a broken Nest for a valid one.
 */
export class NestCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NestCompositionError";
  }
}

/** Fixed, deterministic timestamp for composed manifests (no `Date.now()`). */
const COMPOSED_AT = "2026-06-28T00:00:00.000Z";

// ── Deterministic scoring weights ────────────────────────────────────────────
// Stable integer weights so scores are reproducible and easy to reason about in
// the "Why this Nest?" panel. Higher score wins; ties break on asset id (asc).
const WEIGHT = {
  slotMatch: 10, // base: asset is slot/category compatible
  defaultInteraction: 4, // asset's default interaction equals the slot's default
  creatorTypeOverlap: 3, // per matching creator-type tag
  interestOverlap: 2, // per matching interest tag
  personalityOverlap: 1, // per matching personality tag
  variantMatch: 1, // a variant accent/material echoes an interest/personality tag
  fallbackPreference: 1, // policy names this asset as the slot's fallback
} as const;

const lower = (s: string): string => s.toLowerCase();

/** Count tags from `signals` that appear in the asset's tag list (case-insensitive). */
function tagOverlap(assetTags: string[], signals: string[]): string[] {
  const set = new Set(assetTags.map(lower));
  return signals.filter((s) => set.has(lower(s)));
}

/** A scored candidate asset for one slot, with its human-readable reasons. */
type ScoredAsset = { asset: NestAsset; score: number; reasons: string[] };

/**
 * Score one eligible asset for a slot using deterministic signals only. Assumes the
 * asset has already passed the hard eligibility filters.
 */
function scoreAsset(
  asset: NestAsset,
  slot: SceneSlot,
  profile: CreatorNestProfile,
  policy: NestCompositionPolicy,
): ScoredAsset {
  let score = WEIGHT.slotMatch;
  const reasons: string[] = [`Fits the ${slot.slotType} slot (${asset.category})`];

  if (asset.defaultInteractionId && asset.defaultInteractionId === slot.defaultInteractionId) {
    score += WEIGHT.defaultInteraction;
    reasons.push(`Carries the slot's default interaction (${asset.defaultInteractionId})`);
  }

  const creatorHits = tagOverlap(asset.tags, profile.creatorTypes);
  if (creatorHits.length) {
    score += WEIGHT.creatorTypeOverlap * creatorHits.length;
    reasons.push(`Matches creator type: ${creatorHits.join(", ")}`);
  }

  const interestHits = tagOverlap(asset.tags, profile.interests);
  if (interestHits.length) {
    score += WEIGHT.interestOverlap * interestHits.length;
    reasons.push(`Matches interests: ${interestHits.join(", ")}`);
  }

  const personalityHits = tagOverlap(asset.tags, profile.personalityTags);
  if (personalityHits.length) {
    score += WEIGHT.personalityOverlap * personalityHits.length;
    reasons.push(`Matches personality: ${personalityHits.join(", ")}`);
  }

  const variantSignals = [...profile.interests, ...profile.personalityTags].map(lower);
  const variantHit = asset.variants.find(
    (v) =>
      (v.material && variantSignals.includes(lower(v.material))) ||
      variantSignals.includes(lower(v.name)),
  );
  if (variantHit) {
    score += WEIGHT.variantMatch;
    reasons.push(`Has a fitting variant (${variantHit.name})`);
  }

  if (policy.fallbackAssetBySlot[slot.id] === asset.id) {
    score += WEIGHT.fallbackPreference;
    reasons.push("Policy fallback for this slot");
  }

  return { asset, score, reasons };
}

/**
 * Hard-filter the catalog to the assets eligible for a slot, then return them
 * scored and sorted by the stable rule (score desc, then asset id asc). Already
 * placed assets are excluded unless the policy allows reuse.
 */
function rankEligibleAssets(
  slot: SceneSlot,
  template: NestTemplate,
  assets: NestAsset[],
  profile: CreatorNestProfile,
  policy: NestCompositionPolicy,
  usedAssetIds: Set<string>,
): ScoredAsset[] {
  const eligible = assets.filter((asset) => {
    if (asset.approvalStatus !== "approved") return false; // humans approve; raw AI never ships
    if (asset.dnaVersion !== template.dnaVersion) return false; // DNA lineage must match
    if (asset.cameraContractVersion !== template.cameraContractVersion) return false; // camera contract must match
    if (!isSlotCompatible(slot, asset)) return false; // both directions must agree
    if (!policy.allowAssetReuse && usedAssetIds.has(asset.id)) return false; // one asset, one slot
    return true;
  });

  return eligible
    .map((asset) => scoreAsset(asset, slot, profile, policy))
    .sort((a, b) => (b.score - a.score) || (a.asset.id < b.asset.id ? -1 : a.asset.id > b.asset.id ? 1 : 0));
}

/**
 * Pick the best unconsumed content source for a slot's rule. Selection order:
 *   1. content-type priority for the slot (first type with any match wins)
 *   2. source.priority (lower = more important)
 *   3. source id (asc) — stable final tie-break
 * Returns undefined when no unconsumed compatible source exists.
 */
function pickContentSource(
  rule: SlotContentRule,
  sources: CreatorContentSource[],
  consumed: Set<string>,
): CreatorContentSource | undefined {
  for (const type of rule.contentPriority) {
    const matches = sources
      .filter((s) => !consumed.has(s.id) && s.type === type)
      .sort((a, b) => (a.priority - b.priority) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (matches.length) return matches[0];
  }
  return undefined;
}

/** Map a profile access level onto the ComposedNest's `NestAccessLevel`. */
function toNestAccessLevel(level: CreatorNestProfile["accessLevel"]): NestAccessLevel {
  switch (level) {
    case "public":
      return "public";
    case "private":
      return "private";
    case "followers":
      return "unlisted"; // followers-only ≈ unlisted in the V2 access model
  }
}

/** Resolve the ambience preset id, falling back (with a warning) on an invalid pref. */
function resolveAmbience(
  profile: CreatorNestProfile,
  template: NestTemplate,
  policy: NestCompositionPolicy,
  warnings: string[],
): string {
  const has = (id?: string): boolean =>
    Boolean(id) && template.ambiencePresets.some((p) => p.id === id);

  if (profile.preferredAmbienceId) {
    if (has(profile.preferredAmbienceId)) return profile.preferredAmbienceId;
    warnings.push(
      `Preferred ambience "${profile.preferredAmbienceId}" is not on template "${template.id}" — using fallback.`,
    );
  }
  if (has(policy.fallbackAmbienceId)) return policy.fallbackAmbienceId;
  // Last resort: the template's first preset (templates always declare ≥1).
  return template.ambiencePresets[0]?.id ?? policy.fallbackAmbienceId;
}

/**
 * Deterministically compose one creator's Nest. Pure: no I/O, no randomness, no
 * provider calls. Throws `NestCompositionError` on any hard failure (missing
 * template, an unfillable required slot, or a result that fails validation).
 */
export function composeNest(input: ComposeNestInput): ComposeNestResult {
  const { profile, templates, assets, interactions, policy } = input;
  const warnings: string[] = [];

  // ── Resolve the template the policy targets ────────────────────────────────
  const template = templates.find((t) => t.id === policy.templateId);
  if (!template) {
    throw new NestCompositionError(
      `No template "${policy.templateId}" in the provided catalog (got: ${templates.map((t) => t.id).join(", ") || "none"}).`,
    );
  }

  const assetsById: Record<string, NestAsset> = {};
  for (const a of assets) assetsById[a.id] = a;
  const interactionsById: Record<string, Interaction> = {};
  for (const i of interactions) interactionsById[i.id] = i;

  const requiredSet = new Set(policy.requiredSlotIds);
  const optionalSet = new Set(policy.optionalSlotIds);
  const excludedSet = new Set(policy.excludedSlotIds);

  const slotAssignments: SlotAssignment[] = [];
  const decisions: CompositionDecision[] = [];
  const usedAssetIds = new Set<string>();
  let avatarAssetId: string | undefined;

  // ── Phase A: pick assets for slots (required first, then optional) ─────────
  // Walk the template's own slot order so the result is stable and the locked
  // presentation order is preserved.
  const fillableSlots = template.slots.filter((s) => !excludedSet.has(s.id));

  // Process required slots before optional so the object cap and asset reuse can
  // never starve a required slot.
  const ordered = [
    ...fillableSlots.filter((s) => requiredSet.has(s.id)),
    ...fillableSlots.filter((s) => !requiredSet.has(s.id)),
  ];

  // Record excluded slots in the decision trace for transparency (panel + audit).
  for (const slot of template.slots) {
    if (excludedSet.has(slot.id)) {
      decisions.push({
        slotId: slot.id,
        score: 0,
        reasons: ["Excluded by policy — baked architecture, left empty"],
      });
    }
  }

  for (const slot of ordered) {
    const isRequired = requiredSet.has(slot.id);
    const isOptional = optionalSet.has(slot.id);
    if (!isRequired && !isOptional) continue; // unlisted slot — not composed

    const ranked = rankEligibleAssets(slot, template, assets, profile, policy, usedAssetIds);

    if (ranked.length === 0) {
      if (isRequired) {
        throw new NestCompositionError(
          `Required slot "${slot.id}" (${slot.slotType}) has no eligible approved asset — cannot compose a valid Nest.`,
        );
      }
      decisions.push({
        slotId: slot.id,
        score: 0,
        reasons: ["Optional slot left empty — no eligible asset"],
      });
      continue;
    }

    // Respect the global object cap: required slots always fit (cap ≥ required
    // count by construction); optional slots fill only while headroom remains —
    // never to pad the count beyond the curated maximum.
    if (!isRequired && slotAssignments.length >= policy.maxObjects) {
      decisions.push({
        slotId: slot.id,
        score: 0,
        reasons: [`Optional slot left empty — object cap (${policy.maxObjects}) reached`],
      });
      continue;
    }

    const chosen = ranked[0];
    const interactionId = resolveInteractionId(slot, chosen.asset, undefined);
    const assignment: SlotAssignment = { slotId: slot.id, assetId: chosen.asset.id };
    slotAssignments.push(assignment);
    usedAssetIds.add(chosen.asset.id);
    if (chosen.asset.category === "avatar") avatarAssetId = chosen.asset.id;

    decisions.push({
      slotId: slot.id,
      assetId: chosen.asset.id,
      interactionId,
      score: chosen.score,
      reasons: chosen.reasons,
    });
  }

  // ── Phase B: required-slot guarantee (defensive; the loop already throws) ───
  for (const id of policy.requiredSlotIds) {
    if (!slotAssignments.some((a) => a.slotId === id)) {
      throw new NestCompositionError(`Required slot "${id}" was not filled.`);
    }
  }

  // ── Phase C: bind creator content (each source consumed at most once) ──────
  const consumed = new Set<string>();
  // Bind in policy content-rule order for stable consumption across slots.
  for (const rule of policy.contentRules) {
    const assignment = slotAssignments.find((a) => a.slotId === rule.slotId);
    if (!assignment) continue; // slot not filled — nothing to bind to
    const source = pickContentSource(rule, profile.contentSources, consumed);
    if (!source) continue;

    const binding: NestContentBinding = {
      contentType: rule.bindContentType,
      url: source.url,
      title: source.title,
    };
    if (source.thumbnailUrl) binding.data = { thumbnailUrl: source.thumbnailUrl };
    assignment.content = binding;
    consumed.add(source.id);

    const decision = decisions.find((d) => d.slotId === rule.slotId);
    if (decision) {
      decision.contentSourceId = source.id;
      decision.reasons.push(`Bound content: ${source.title} (${source.type})`);
    }
  }

  // ── Phase D: leftover sources become quick links (stable order) ────────────
  const quickLinks: NestQuickLink[] = profile.contentSources
    .filter((s) => !consumed.has(s.id))
    .sort((a, b) => (a.priority - b.priority) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((s) => ({ id: `ql-${s.id}`, label: s.title, url: s.url }));

  // ── Phase E: ambience ──────────────────────────────────────────────────────
  const ambiencePresetId = resolveAmbience(profile, template, policy, warnings);

  // ── Phase F: assemble + validate ───────────────────────────────────────────
  const nest: ComposedNest = {
    id: `composed-${profile.id}`,
    ownerId: profile.id,
    houseId: `house-${profile.id}`,
    templateId: template.id,
    slotAssignments,
    avatarAssetId,
    personalAssetIds: [], // no runtime personal-object generation in V1
    ambiencePresetId,
    accessLevel: toNestAccessLevel(profile.accessLevel),
    quickLinks,
    createdAt: COMPOSED_AT,
    updatedAt: COMPOSED_AT,
  };

  const validation = validateComposedNest(nest, template, assetsById);
  warnings.push(...validation.warnings);
  if (!validation.ok) {
    throw new NestCompositionError(
      `Composed Nest failed validation: ${validation.errors.join("; ")}`,
    );
  }

  return { nest, decisions, warnings };
}
