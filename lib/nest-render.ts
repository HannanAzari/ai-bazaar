// ── Nestudio V2 — Golden Nest render helpers (M2) ───────────────────────────
//
// Pure, framework-free helpers that turn a `ComposedNest` + its `NestTemplate` +
// asset/interaction lookups into an ordered list of render pieces with the layout
// + interaction metadata the React stage needs. No DOM, no React, no I/O — so the
// rendering logic is unit-testable on its own.
//
// This is **not** the Composer: it consumes an already-composed Nest manifest and
// prepares it for display. It is additive and does not touch V1 code. Camera +
// contract: ADR-028 / lib/nest-types.ts.

import { findSlot, resolveInteractionId } from "@/lib/nest-types";
import type {
  ComposedNest,
  Interaction,
  NestAsset,
  NestAssetVariant,
  NestAspectRatio,
  NestTemplate,
  SceneSlot,
  SlotAssignment,
} from "@/lib/nest-types";

/** One asset placed in its slot, resolved for rendering and ordered by z-index. */
export type NestRenderPiece = {
  slot: SceneSlot;
  assignment: SlotAssignment;
  /** The library asset, or undefined when the assignment references a missing id. */
  asset?: NestAsset;
  /** The resolved variant (if the assignment chose one and it exists). */
  variant?: NestAssetVariant;
  /** The interaction id that applies (assignment → asset → slot precedence). */
  interactionId?: string;
  /** The resolved interaction behaviour, when the id maps to a known interaction. */
  interaction?: Interaction;
  /** True when the referenced asset is not in the library (renders a fallback). */
  missing: boolean;
};

/** Aspect ratio as a numeric width/height (e.g. "3:4" → 0.75). */
export function aspectRatioValue(ratio: NestAspectRatio): number {
  switch (ratio) {
    case "3:4":
      return 3 / 4;
    case "9:16":
      return 9 / 16;
    case "4:3":
      return 4 / 3;
    case "16:9":
      return 16 / 9;
  }
}

/** A CSS `aspect-ratio` string for the template (e.g. "3 / 4"). */
export function aspectRatioCss(ratio: NestAspectRatio): string {
  return ratio.replace(":", " / ");
}

/** A slot's footprint as CSS percentage box values (left/top/width/height). */
export type SlotBoxStyle = { left: string; top: string; width: string; height: string };

const pct = (n: number): string => `${+(n * 100).toFixed(4)}%`;

export function slotBoxStyle(slot: SceneSlot): SlotBoxStyle {
  return {
    left: pct(slot.bounds.x),
    top: pct(slot.bounds.y),
    width: pct(slot.bounds.width),
    height: pct(slot.bounds.height),
  };
}

/**
 * Resolve a ComposedNest into ordered render pieces. Assignments whose slot does
 * not exist on the template are dropped (a malformed manifest shouldn't crash the
 * renderer); a missing *asset* is kept but flagged `missing` so the stage can draw
 * a graceful fallback. Pieces are sorted by slot z-index (back to front).
 */
export function resolveRenderPieces(
  nest: ComposedNest,
  template: NestTemplate,
  assetsById: Record<string, NestAsset>,
  interactionsById: Record<string, Interaction>,
): NestRenderPiece[] {
  const pieces: NestRenderPiece[] = [];
  for (const assignment of nest.slotAssignments) {
    const slot = findSlot(template, assignment.slotId);
    if (!slot) continue; // unknown slot — skip gracefully
    const asset = assetsById[assignment.assetId];
    const interactionId = asset
      ? resolveInteractionId(slot, asset, assignment)
      : (assignment.interactionId ?? slot.defaultInteractionId);
    const interaction = interactionId ? interactionsById[interactionId] : undefined;
    const variant =
      asset && assignment.variantId
        ? asset.variants.find((v) => v.id === assignment.variantId)
        : undefined;
    pieces.push({
      slot,
      assignment,
      asset,
      variant,
      interactionId,
      interaction,
      missing: !asset,
    });
  }
  return pieces.sort((a, b) => a.slot.zIndex - b.slot.zIndex);
}

/** Whether a piece responds to tap/click (it resolved a real interaction). */
export function isInteractivePiece(piece: NestRenderPiece): boolean {
  return Boolean(piece.interaction);
}

/** The visual effect family a placeholder animation belongs to. */
export type NestEffect = "glow" | "open" | "ambience" | "zoom" | "wiggle" | "none";

/** Map an interaction's animation to a placeholder effect family for the stage. */
export function interactionEffect(interaction?: Interaction): NestEffect {
  if (!interaction) return "none";
  switch (interaction.animation) {
    case "glow":
    case "screen_on":
    case "pulse":
    case "shine":
      return "glow";
    case "open":
      return "open";
    case "light":
      return "ambience";
    case "zoom":
      return "zoom";
    case "leaf_sway":
    case "wave":
      return "wiggle";
    case "none":
      return "none";
  }
}

/** The call-to-action label shown in the selected-object panel. */
export function interactionActionLabel(interaction?: Interaction): string {
  if (!interaction) return "";
  switch (interaction.contentType) {
    case "video":
      return "Open YouTube";
    case "article":
      return "Open Article";
    case "gallery":
      return "Open Gallery";
    case "website":
      return "Open Website";
    case "music":
      return "Open Music";
    case "podcast":
      return "Open Podcast";
    case "shop":
      return "Open Shop";
    case "achievements":
      return "View Achievements";
    case "intro":
      return "View Intro";
    case "ambience":
      return "Toggle Ambience";
    case "none":
      return "";
  }
}
